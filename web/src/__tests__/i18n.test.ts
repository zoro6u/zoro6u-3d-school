import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import ar from '../i18n/ar.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  it('English and Arabic have identical key sets', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
  it('has no empty strings', () => {
    for (const dict of [en, ar]) for (const k of keys(dict)) {
      const val = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], dict);
      expect(String(val).trim().length, k).toBeGreaterThan(0);
    }
  });
});
