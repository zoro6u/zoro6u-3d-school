import { bondId } from './validate';
import type { BondDef, ReactionData } from './types';

const ORDER_SYMBOL = { 1: '-', 2: '=', 3: '≡' } as const;

/** Key into bondEnergies, e.g. "H-O" (element symbols sorted A–Z) or "O=O". */
export function bondEnergyKey(elA: string, elB: string, order: BondDef['order']): string {
  const [x, y] = [elA, elB].sort();
  return `${x}${ORDER_SYMBOL[order]}${y}`;
}

function bondKeysOf(data: ReactionData, bonds: BondDef[]): string[] {
  const el = new Map(data.atoms.map((a) => [a.id, a.el]));
  return bonds.filter((b) => b.type !== 'ionic').map((b) => bondEnergyKey(el.get(b.a)!, el.get(b.b)!, b.order));
}

const tally = (keys: string[]) => keys.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});

export interface BondAccounting {
  broken: { key: string; count: number; each: number }[];
  formed: { key: string; count: number; each: number }[];
  absorbed: number;
  released: number;
  net: number;
}

/** Bonds broken/formed between the first and last stage (bonds present on both sides cancel). null if energies are missing. */
export function bondAccounting(data: ReactionData): BondAccounting | null {
  const E = data.bondEnergies;
  if (!E) return null;
  const a = tally(bondKeysOf(data, data.stages[0]!.bonds));
  const b = tally(bondKeysOf(data, data.stages[data.stages.length - 1]!.bonds));
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const broken: BondAccounting['broken'] = [];
  const formed: BondAccounting['formed'] = [];
  for (const k of keys) {
    if (E[k] === undefined) return null;
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (d > 0) broken.push({ key: k, count: d, each: E[k] });
    if (d < 0) formed.push({ key: k, count: -d, each: E[k] });
  }
  const absorbed = broken.reduce((s, x) => s + x.count * x.each, 0);
  const released = formed.reduce((s, x) => s + x.count * x.each, 0);
  return { broken, formed, absorbed, released, net: absorbed - released };
}

export interface EnergyLevels {
  /** One value per stage. */
  levels: number[];
  /** true when values are kJ derived from bond energies; false for the data's qualitative sketch. */
  quantitative: boolean;
}

/**
 * Potential energy of each stage relative to the reactants.
 * With bond energies: Σ(energy of bonds present at stage 0) − Σ(energy of bonds present now).
 * Ionic bonds have no tabulated energy, so reactions that contain them use the qualitative `energy` field.
 */
export function stageEnergies(data: ReactionData): EnergyLevels {
  const E = data.bondEnergies;
  if (E) {
    const sums = data.stages.map((st) => {
      const keys = bondKeysOf(data, st.bonds);
      return keys.every((k) => E[k] !== undefined) ? keys.reduce((s, k) => s + E[k]!, 0) : null;
    });
    if (sums.every((s) => s !== null)) {
      const base = sums[0]!;
      return { levels: sums.map((s) => base - s!), quantitative: true };
    }
  }
  return { levels: data.stages.map((s) => s.energy ?? 0), quantitative: false };
}

export { bondId };
