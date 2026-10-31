import { describe, expect, it } from 'vitest';
import { dirFor, useSettings } from '../store/settings';

describe('settings', () => {
  it('maps language to text direction', () => {
    expect(dirFor('ar')).toBe('rtl');
    expect(dirFor('en')).toBe('ltr');
  });
  it('updates language and flags', () => {
    useSettings.getState().setLang('ar');
    useSettings.getState().setLowGraphics(true);
    expect(useSettings.getState().lang).toBe('ar');
    expect(useSettings.getState().lowGraphics).toBe(true);
  });
});
