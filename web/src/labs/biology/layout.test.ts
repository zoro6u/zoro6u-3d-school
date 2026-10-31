import { describe, expect, it } from 'vitest';
import { CELL_RADIUS, organelleIds, organelles } from './config';
import { BLOBS, buildLayout, ER_SHELLS, NUCLEUS } from './layout';
import { inCutaway, resolvePick } from './pick';
import en from '../../i18n/en.json';
import ar from '../../i18n/ar.json';

const d = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('biology data', () => {
  it('has the nine required items, each with i18n name/function in en and ar', () => {
    expect(organelleIds.sort()).toEqual(
      ['cytoplasm', 'golgi', 'lysosomes', 'membrane', 'mitochondria', 'nucleus', 'ribosomes', 'roughEr', 'smoothEr'].sort(),
    );
    for (const dict of [en, ar]) for (const o of organelles) {
      const entry = (dict.biology.organelles as Record<string, { name: string; function: string; fact: string }>)[o.id];
      expect(entry, o.id).toBeDefined();
      expect(entry!.name.length).toBeGreaterThan(0);
      expect(entry!.function.length).toBeGreaterThan(20);
      expect(entry!.fact.length).toBeGreaterThan(10);
    }
  });
  it('colours are valid hex and distinct', () => {
    const colors = organelles.map((o) => o.color);
    colors.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('cell layout', () => {
  const high = buildLayout('high');
  it('is deterministic', () => {
    expect(buildLayout('high')).toEqual(high);
  });
  it('low detail has fewer ribosomes', () => {
    const low = buildLayout('low');
    expect(low.erRibosomes.length + low.freeRibosomes.length).toBeLessThan(high.erRibosomes.length + high.freeRibosomes.length);
  });
  it('keeps every organelle inside the membrane with a margin', () => {
    for (const b of BLOBS) expect(Math.hypot(...b.center) + b.radius, b.id).toBeLessThan(CELL_RADIUS - 0.1);
    for (const p of [...high.erRibosomes, ...high.freeRibosomes]) expect(Math.hypot(...p)).toBeLessThan(CELL_RADIUS - 0.2);
    const outer = Math.max(...ER_SHELLS.map((s) => s.radius));
    expect(Math.hypot(...NUCLEUS.center) + outer).toBeLessThan(CELL_RADIUS - 0.2);
  });
  it('no two organelle bodies overlap', () => {
    for (let i = 0; i < BLOBS.length; i++)
      for (let j = i + 1; j < BLOBS.length; j++) {
        const a = BLOBS[i]!;
        const b = BLOBS[j]!;
        expect(d(a.center, b.center), `${a.id}/${b.id}`).toBeGreaterThan(a.radius + b.radius);
      }
  });
  it('free ribosomes stay out of other organelles', () => {
    for (const p of high.freeRibosomes) for (const b of BLOBS) expect(d(p, b.center)).toBeGreaterThan(b.radius);
  });
  it('ER-bound ribosomes lie on the ER sheets', () => {
    for (const p of high.erRibosomes) {
      const r = d(p, NUCLEUS.center);
      expect(ER_SHELLS.some((s) => Math.abs(r - (s.radius + 0.035)) < 1e-9)).toBe(true);
    }
  });
  it('smooth-ER tubes stay inside their bounding sphere and clear of the ER sheets', () => {
    const ser = BLOBS.find((b) => b.id === 'smoothEr')!;
    for (const tube of high.serTubes) for (const p of tube) {
      expect(d(p, ser.center)).toBeLessThanOrEqual(ser.radius);
      expect(d(p, NUCLEUS.center)).toBeGreaterThan(Math.max(...ER_SHELLS.map((s) => s.radius)) + 0.05);
    }
  });
  it('has a focus point for every item', () => {
    for (const id of organelleIds) expect(high.focus[id]).toHaveLength(3);
  });
});

describe('picking', () => {
  it('prefers an organelle behind the translucent membrane and cytoplasm', () => {
    expect(resolvePick(['membrane', 'cytoplasm', 'mitochondria', 'cytoplasm', 'membrane'])).toBe('mitochondria');
  });
  it('picks cytoplasm when the ray enters the cell but hits no organelle', () => {
    expect(resolvePick(['membrane', 'cytoplasm', 'cytoplasm', 'membrane'])).toBe('cytoplasm');
  });
  it('picks the membrane for a grazing ray that misses the cytoplasm', () => {
    expect(resolvePick(['membrane', 'membrane'])).toBe('membrane');
  });
  it('picks nothing for an empty hit list', () => {
    expect(resolvePick([])).toBeNull();
  });
});

describe('cutaway wedge', () => {
  it('removes only x > 0 and z > 0', () => {
    expect(inCutaway([1, 0, 1])).toBe(true);
    expect(inCutaway([-1, 0, 1])).toBe(false);
    expect(inCutaway([1, 5, -1])).toBe(false);
  });
});
