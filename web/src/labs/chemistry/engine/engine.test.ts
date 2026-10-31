import { describe, expect, it } from 'vitest';
import { balanceReport, correctCoeffs, countAtoms, onesCoeffs } from './balance';
import { bondAccounting, bondEnergyKey, stageEnergies } from './energy';
import { reactionById, reactions } from './loader';
import { ReactionPlayer } from './player';
import { buildTimeline, sample } from './timeline';
import { componentsOf, validateAll, validateReaction } from './validate';
import type { ReactionData } from './types';

const water = reactionById('water-synthesis')!.data;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('every reaction data file (data-driven: new files are tested automatically)', () => {
  it('finds at least the two shipped reactions', () => {
    expect(reactions.map((r) => r.data.id)).toEqual(['water-synthesis', 'hcl-naoh']);
  });
  for (const r of reactions) {
    it(`${r.data.id}: structure, balance, stage molecules and en/ar text are valid`, () => {
      expect(validateAll(r)).toEqual([]);
    });
    it(`${r.data.id}: the animation conserves atoms (same atoms in every stage)`, () => {
      for (const st of r.data.stages) expect(Object.keys(st.positions).sort()).toEqual(r.data.atoms.map((a) => a.id).sort());
    });
  }
});

describe('water synthesis, 2H₂ + O₂ → 2H₂O', () => {
  it('is balanced: 4 H and 2 O on each side', () => {
    expect(countAtoms(water.equation.reactants, water.species)).toEqual({ H: 4, O: 2 });
    expect(countAtoms(water.equation.products, water.species)).toEqual({ H: 4, O: 2 });
  });
  it('starts as 2×H₂ + 1×O₂ and ends as 2×H₂O', () => {
    expect(componentsOf(water, water.stages[0]!)).toEqual(['H2', 'H2', 'O2']);
    expect(componentsOf(water, water.stages.at(-1)!)).toEqual(['H2O1', 'H2O1']);
  });
  it('uses real geometry: H–H 0.74 Å, O=O 1.21 Å, O–H 0.96 Å, H–O–H ≈ 104.5°', () => {
    const d = (st: number, a: string, b: string) => {
      const p = water.stages[st]!.positions;
      return Math.hypot(...(p[a]!.map((v, i) => v - p[b]![i]!) as [number, number, number]));
    };
    expect(d(0, 'H1', 'H2')).toBeCloseTo(0.74, 2);
    expect(d(0, 'O1', 'O2')).toBeCloseTo(1.21, 2);
    expect(d(4, 'O1', 'H1')).toBeCloseTo(0.96, 2);
    const p = water.stages[4]!.positions;
    const v1 = p.H1!.map((x, i) => x - p.O1![i]!);
    const v2 = p.H3!.map((x, i) => x - p.O1![i]!);
    const cos = (v1[0]! * v2[0]! + v1[1]! * v2[1]! + v1[2]! * v2[2]!) / (0.96 * 0.96);
    expect((Math.acos(cos) * 180) / Math.PI).toBeCloseTo(104.5, 0);
  });
  it('bond bookkeeping: 2·436 + 498 = 1370 absorbed, 4·463 = 1852 released, net −482 ≈ measured −483.6', () => {
    const acc = bondAccounting(water)!;
    expect(acc.absorbed).toBe(1370);
    expect(acc.released).toBe(1852);
    expect(acc.net).toBe(-482);
    expect(Math.abs(acc.net / water.deltaH! - 1)).toBeLessThan(0.01);
  });
  it('energy levels: reactants 0 → free atoms +1370 → products −482 (exothermic)', () => {
    const e = stageEnergies(water);
    expect(e.quantitative).toBe(true);
    expect(e.levels).toEqual([0, 0, 1370, 1370, -482, -482]);
  });
  it('bond key format', () => {
    expect(bondEnergyKey('O', 'H', 1)).toBe('H-O');
    expect(bondEnergyKey('O', 'O', 2)).toBe('O=O');
  });
});

describe('balancing', () => {
  it('all-ones is unbalanced for oxygen, correct coefficients are balanced', () => {
    const r1 = balanceReport(water, onesCoeffs(water));
    expect(r1.balanced).toBe(false);
    expect(r1.unbalanced).toEqual(['O']);
    expect(balanceReport(water, correctCoeffs(water)).balanced).toBe(true);
  });
  it('4 H₂ + 2 O₂ → 4 H₂O is also balanced, though not simplest', () => {
    expect(balanceReport(water, { H2: 4, O2: 2, H2O: 4 }).balanced).toBe(true);
  });
  it('zero coefficients never count as balanced', () => {
    expect(balanceReport(water, { H2: 0, O2: 0, H2O: 0 }).balanced).toBe(false);
  });
  it('HCl + NaOH → NaCl + H₂O balances with all ones', () => {
    expect(balanceReport(reactionById('hcl-naoh')!.data, onesCoeffs(reactionById('hcl-naoh')!.data)).balanced).toBe(true);
  });
});

describe('validation catches bad data', () => {
  it('rejects an unbalanced equation', () => {
    const d = clone(water);
    d.equation.products[0]!.coeff = 1;
    expect(validateReaction(d).join()).toMatch(/not balanced/);
  });
  it('rejects a stage with a missing atom position', () => {
    const d: ReactionData = clone(water);
    delete d.stages[2]!.positions.H1;
    expect(validateReaction(d).join()).toMatch(/missing position for H1/);
  });
  it('rejects animation whose last stage does not make the products', () => {
    const d = clone(water);
    d.stages.at(-1)!.bonds = d.stages.at(-1)!.bonds.slice(0, 2);
    expect(validateReaction(d).join()).toMatch(/last stage molecules/);
  });
  it('rejects unknown elements and overlapping atoms', () => {
    const d = clone(water);
    d.atoms[0]!.el = 'Xx';
    expect(validateReaction(d).join()).toMatch(/unknown element Xx/);
    const e = clone(water);
    e.stages[2]!.positions.H1 = [...e.stages[2]!.positions.H2!];
    expect(validateReaction(e).join()).toMatch(/overlap/);
  });
});

describe('timeline and player', () => {
  const tl = buildTimeline(water.stages);
  it('stage arrival times increase and the final one ends the timeline', () => {
    for (let i = 1; i < tl.arrive.length; i++) expect(tl.arrive[i]!).toBeGreaterThan(tl.arrive[i - 1]!);
    expect(tl.total).toBe(tl.holdEnd.at(-1));
  });
  it('sample: resting on a stage vs moving between two', () => {
    expect(sample(tl, 0)).toEqual({ from: 0, to: 0, u: 0, raw: 0 });
    const mid = (tl.holdEnd[0]! + tl.arrive[1]!) / 2;
    const s = sample(tl, mid);
    expect([s.from, s.to]).toEqual([0, 1]);
    expect(s.u).toBeCloseTo(0.5, 6);
    expect(sample(tl, tl.arrive[2]! + 0.01)).toEqual({ from: 2, to: 2, u: 0, raw: 0 });
  });

  it('positions at each stage arrival equal the data keyframes exactly', () => {
    const p = new ReactionPlayer(water);
    water.stages.forEach((st, i) => {
      p.seek(tl.arrive[i]!);
      water.atoms.forEach((a, k) => {
        for (let c = 0; c < 3; c++) expect(p.positions[k * 3 + c]).toBeCloseTo(st.positions[a.id]![c]!, 9);
      });
    });
  });
  it('bond values: 1 for present bonds, 0 for absent, intermediate while transitioning', () => {
    const p = new ReactionPlayer(water);
    p.seek(tl.arrive[0]!);
    expect(p.bondValues.filter((v) => v === 1).length).toBe(3); // H–H, H–H, O=O
    p.seek(tl.arrive[2]!);
    expect([...p.bondValues].every((v) => v === 0)).toBe(true);
    p.seek((tl.holdEnd[1]! + tl.arrive[2]!) / 2);
    expect(p.bondValues.some((v) => v > 0 && v < 1)).toBe(true);
    p.seek(tl.arrive[5]!);
    expect(p.bondValues.filter((v) => v === 1).length).toBe(4);
  });
  it('glow peaks when new bonds form', () => {
    const p = new ReactionPlayer(water);
    p.seek(tl.arrive[4]!);
    expect(p.glow).toBe(1);
    p.seek(tl.arrive[0]!);
    expect(p.glow).toBe(0);
  });
  it('step mode: next() animates to the next stage boundary then pauses; prev() goes back', () => {
    const p = new ReactionPlayer(water);
    p.next();
    for (let i = 0; i < 200 && p.snapshot().moving; i++) p.update(0.05);
    expect(p.time).toBe(tl.arrive[1]);
    expect(p.snapshot().moving).toBe(false);
    expect(p.snapshot().stage).toBe(1);
    p.next();
    for (let i = 0; i < 200 && p.snapshot().moving; i++) p.update(0.05);
    expect(p.time).toBe(tl.arrive[2]);
    p.prev();
    for (let i = 0; i < 200 && p.snapshot().moving; i++) p.update(0.05);
    expect(p.time).toBe(tl.arrive[1]);
    p.prev();
    for (let i = 0; i < 200 && p.snapshot().moving; i++) p.update(0.05);
    expect(p.time).toBe(0);
    p.prev(); // already at the start: stays put
    p.update(1);
    expect(p.time).toBe(0);
  });
  it('step mode skips the dwell: the first next() takes only the transition time', () => {
    const p = new ReactionPlayer(water);
    p.next();
    let t = 0;
    while (p.snapshot().moving && t < 60) { p.update(0.01); t += 0.01; }
    expect(t).toBeCloseTo(water.stages[1]!.duration!, 1);
    expect(p.time).toBe(tl.arrive[1]);
  });
  it('at the last stage next() does nothing and the player reports atEnd', () => {
    const p = new ReactionPlayer(water);
    p.goToStage(5);
    for (let i = 0; i < 2000 && p.snapshot().moving; i++) p.update(0.05);
    expect(p.snapshot().atEnd).toBe(true);
    const before = p.time;
    p.next();
    p.update(1);
    expect(p.time).toBe(before);
  });
  it('prev() from a stage goes to the previous stage (not to the start of the same stage)', () => {
    const p = new ReactionPlayer(water);
    p.goToStage(3);
    for (let i = 0; i < 2000 && p.snapshot().moving; i++) p.update(0.05);
    p.prev();
    for (let i = 0; i < 2000 && p.snapshot().moving; i++) p.update(0.05);
    expect(p.snapshot().stage).toBe(2);
    expect(p.time).toBe(tl.arrive[2]);
  });
  it('continuous play runs to the end and stops; play() again restarts', () => {
    const p = new ReactionPlayer(water);
    p.play();
    for (let i = 0; i < 2000 && p.playing; i++) p.update(0.05);
    expect(p.snapshot().atEnd).toBe(true);
    expect(p.playing).toBe(false);
    p.play();
    expect(p.time).toBe(0);
    expect(p.playing).toBe(true);
  });
  it('speed scales playback and seek clamps to the timeline', () => {
    const p = new ReactionPlayer(water);
    p.speed = 2;
    p.play();
    p.update(1);
    expect(p.time).toBeCloseTo(2, 9);
    p.seek(1e6);
    expect(p.time).toBe(tl.total);
    p.seek(-5);
    expect(p.time).toBe(0);
  });
  it('works for the second reaction too (no reaction-specific code)', () => {
    const d = reactionById('hcl-naoh')!.data;
    const p = new ReactionPlayer(d);
    p.seek(p.timeline.total);
    expect(p.energyQuantitative).toBe(false);
    expect(p.bonds.some((b) => b.type === 'ionic')).toBe(true);
    expect(componentsOf(d, d.stages.at(-1)!)).toEqual(['Cl1Na1', 'H2O1']);
  });
});
