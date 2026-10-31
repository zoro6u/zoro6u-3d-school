import type { EquationTerm, ReactionData } from './types';

export type Coeffs = Record<string, number>;

/** Total atoms per element for one side of an equation, given coefficients per species. */
export function countAtoms(terms: EquationTerm[], species: ReactionData['species'], coeffs?: Coeffs): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of terms) {
    const n = coeffs ? (coeffs[t.species] ?? 0) : t.coeff;
    for (const [el, k] of Object.entries(species[t.species]?.atoms ?? {})) out[el] = (out[el] ?? 0) + n * k;
  }
  return out;
}

export interface BalanceRow {
  el: string;
  left: number;
  right: number;
  ok: boolean;
}
export interface BalanceReport {
  rows: BalanceRow[];
  balanced: boolean;
  unbalanced: string[];
}

export function balanceReport(data: ReactionData, coeffs?: Coeffs): BalanceReport {
  const left = countAtoms(data.equation.reactants, data.species, coeffs);
  const right = countAtoms(data.equation.products, data.species, coeffs);
  const els = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  const rows = els.map((el) => ({ el, left: left[el] ?? 0, right: right[el] ?? 0, ok: (left[el] ?? 0) === (right[el] ?? 0) }));
  const unbalanced = rows.filter((r) => !r.ok).map((r) => r.el);
  // Coefficients of zero everywhere count as "not balanced" so the student can't "solve" by deleting everything.
  const anyMolecule = [...data.equation.reactants, ...data.equation.products].every((t) => (coeffs ? (coeffs[t.species] ?? 0) : t.coeff) > 0);
  return { rows, balanced: unbalanced.length === 0 && anyMolecule, unbalanced };
}

export const correctCoeffs = (data: ReactionData): Coeffs =>
  Object.fromEntries([...data.equation.reactants, ...data.equation.products].map((t) => [t.species, t.coeff]));

export const onesCoeffs = (data: ReactionData): Coeffs =>
  Object.fromEntries([...data.equation.reactants, ...data.equation.products].map((t) => [t.species, 1]));
