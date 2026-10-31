import { countAtoms } from './balance';
import { elementDef } from './elements';
import type { BondDef, Reaction, ReactionData, ReactionText, StageDef } from './types';

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** Canonical key for a molecule's composition, e.g. {H:2,O:1} → "H2O1". */
const compKey = (c: Record<string, number>) =>
  Object.keys(c).sort().map((el) => `${el}${c[el]}`).join('');

/** Connected components of a stage's bond graph, as composition keys. */
export function componentsOf(data: ReactionData, stage: StageDef): string[] {
  const parent = new Map(data.atoms.map((a) => [a.id, a.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  for (const b of stage.bonds) parent.set(find(b.a), find(b.b));
  const groups = new Map<string, Record<string, number>>();
  for (const a of data.atoms) {
    const r = find(a.id);
    const g = groups.get(r) ?? {};
    g[a.el] = (g[a.el] ?? 0) + 1;
    groups.set(r, g);
  }
  return [...groups.values()].map(compKey).sort();
}

function expectedMolecules(data: ReactionData, side: 'reactants' | 'products'): string[] {
  const out: string[] = [];
  for (const t of data.equation[side]) for (let i = 0; i < t.coeff; i++) out.push(compKey(data.species[t.species]!.atoms));
  return out.sort();
}

/** Returns a list of human-readable problems; empty means the reaction is valid. */
export function validateReaction(data: ReactionData): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(`${data.id}: ${m}`);

  const ids = data.atoms.map((a) => a.id);
  if (new Set(ids).size !== ids.length) err('duplicate atom ids');
  for (const a of data.atoms) if (!elementDef(a.el)) err(`atom ${a.id}: unknown element ${a.el}`);

  for (const [sid, s] of Object.entries(data.species))
    for (const el of Object.keys(s.atoms)) if (!elementDef(el)) err(`species ${sid}: unknown element ${el}`);
  for (const t of [...data.equation.reactants, ...data.equation.products]) {
    if (!data.species[t.species]) err(`equation uses undefined species ${t.species}`);
    if (!Number.isInteger(t.coeff) || t.coeff < 1) err(`species ${t.species}: coefficient must be a positive integer`);
  }
  if (errs.length) return errs; // later checks assume the above

  const left = countAtoms(data.equation.reactants, data.species);
  const right = countAtoms(data.equation.products, data.species);
  const els = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const el of els) if ((left[el] ?? 0) !== (right[el] ?? 0)) err(`equation not balanced for ${el}: ${left[el] ?? 0} vs ${right[el] ?? 0}`);
  const atomCounts: Record<string, number> = {};
  for (const a of data.atoms) atomCounts[a.el] = (atomCounts[a.el] ?? 0) + 1;
  for (const el of els) if ((atomCounts[el] ?? 0) !== (left[el] ?? 0)) err(`animation has ${atomCounts[el] ?? 0} ${el} atoms but the equation needs ${left[el] ?? 0}`);

  if (data.stages.length < 2) err('needs at least 2 stages');
  const stageIds = data.stages.map((s) => s.id);
  if (new Set(stageIds).size !== stageIds.length) err('duplicate stage ids');
  const elOf = new Map(data.atoms.map((a) => [a.id, a.el]));

  for (const st of data.stages) {
    const e = (m: string) => err(`stage ${st.id}: ${m}`);
    for (const id of ids) if (!st.positions[id]) e(`missing position for ${id}`);
    for (const id of Object.keys(st.positions)) if (!elOf.has(id)) e(`position for unknown atom ${id}`);
    if (st.glow !== undefined && (st.glow < 0 || st.glow > 1)) e('glow must be within 0–1');
    const seen = new Set<string>();
    for (const b of st.bonds) {
      if (!elOf.has(b.a) || !elOf.has(b.b)) { e(`bond ${b.a}-${b.b} references unknown atom`); continue; }
      const key = bondId(b);
      if (seen.has(key)) e(`duplicate bond ${key}`);
      seen.add(key);
      const pa = st.positions[b.a];
      const pb = st.positions[b.b];
      if (pa && pb) {
        const d = dist(pa, pb);
        if (d < 0.5 || d > 3.5) e(`bond ${key} has implausible length ${d.toFixed(2)}`);
      }
    }
    // keyframes shouldn't have non-bonded atoms intersecting
    const bonded = new Set(st.bonds.flatMap((b) => [`${b.a}|${b.b}`, `${b.b}|${b.a}`]));
    for (let i = 0; i < data.atoms.length; i++)
      for (let j = i + 1; j < data.atoms.length; j++) {
        const A = data.atoms[i]!;
        const B = data.atoms[j]!;
        const pa = st.positions[A.id];
        const pb = st.positions[B.id];
        if (!pa || !pb || bonded.has(`${A.id}|${B.id}`)) continue;
        const min = 0.9 * (elementDef(A.el)!.radius + elementDef(B.el)!.radius);
        if (dist(pa, pb) < min) e(`atoms ${A.id} and ${B.id} overlap`);
      }
  }
  if (errs.length) return errs;

  const first = componentsOf(data, data.stages[0]!);
  const last = componentsOf(data, data.stages[data.stages.length - 1]!);
  if (JSON.stringify(first) !== JSON.stringify(expectedMolecules(data, 'reactants'))) err(`first stage molecules ${first.join(',')} ≠ reactants ${expectedMolecules(data, 'reactants').join(',')}`);
  if (JSON.stringify(last) !== JSON.stringify(expectedMolecules(data, 'products'))) err(`last stage molecules ${last.join(',')} ≠ products ${expectedMolecules(data, 'products').join(',')}`);

  const needsEnergy = !data.bondEnergies;
  if (needsEnergy) for (const st of data.stages) if (st.energy === undefined) err(`stage ${st.id}: needs "energy" because the reaction has no bondEnergies`);
  return errs;
}

export function validateText(data: ReactionData, text: ReactionText, lang: string): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(`${data.id}/${lang}: ${m}`);
  if (!text.title) err('missing title');
  if (!text.tab) err('missing tab label');
  for (const s of data.stages) {
    const t = text.stages?.[s.id];
    if (!t?.title || !t?.caption) err(`missing text for stage ${s.id}`);
  }
  for (const sid of Object.keys(data.species)) if (!text.species?.[sid]) err(`missing species name ${sid}`);
  return errs;
}

export const validateAll = (r: Reaction): string[] => [
  ...validateReaction(r.data),
  ...(['en', 'ar'] as const).flatMap((l) => validateText(r.data, r.text[l], l)),
];

export const bondId = (b: Pick<BondDef, 'a' | 'b'>): string => (b.a < b.b ? `${b.a}|${b.b}` : `${b.b}|${b.a}`);
