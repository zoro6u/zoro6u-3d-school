// Reactions are pure data (content/lessons/chemistry-*/reactions/<id>/). Nothing here is specific to one reaction.
export type Vec3 = [number, number, number];

export interface ElementDef {
  symbol: string;
  /** CPK colour. */
  color: string;
  /** Ball radius in angstrom-ish scene units. */
  radius: number;
}

export interface SpeciesDef {
  /** Display formula with Unicode subscripts, e.g. "H₂O". */
  formula: string;
  /** Element symbol → atom count. */
  atoms: Record<string, number>;
}

export interface EquationTerm {
  species: string;
  coeff: number;
}

export interface AtomDef {
  id: string;
  el: string;
}

export interface BondDef {
  a: string;
  b: string;
  order: 1 | 2 | 3;
  type?: 'covalent' | 'ionic';
}

export interface StageDef {
  id: string;
  /** Seconds to move from the previous stage into this one. */
  duration?: number;
  /** Seconds to dwell on this stage when playing continuously. */
  hold?: number;
  /** Exothermic glow, 0–1. */
  glow?: number;
  /** Qualitative energy level, used only when bond energies are not given. */
  energy?: number;
  positions: Record<string, Vec3>;
  bonds: BondDef[];
}

export interface ReactionData {
  id: string;
  order?: number;
  species: Record<string, SpeciesDef>;
  equation: { reactants: EquationTerm[]; products: EquationTerm[] };
  atoms: AtomDef[];
  stages: StageDef[];
  /** Mean bond energies in kJ/mol, keyed like "H-H", "O=O", "H-O" (element symbols sorted A–Z). */
  bondEnergies?: Record<string, number>;
  /** Measured enthalpy change in kJ for the equation as written. */
  deltaH?: number;
}

export interface ReactionText {
  title: string;
  tab: string;
  summary: string;
  species: Record<string, string>;
  stages: Record<string, { title: string; caption: string }>;
  notes: { mechanism?: string; thermo?: string };
}

export type Lang = 'en' | 'ar';

export interface Reaction {
  data: ReactionData;
  text: Record<Lang, ReactionText>;
}
