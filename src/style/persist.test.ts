import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadStyle, sanitizeStyle, saveStyle } from './persist';
import { defaultStyle, presetById, styleFromPreset } from './presets';

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value),
  };
}

describe('saved style', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens on Anton when nothing has been saved', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const style = loadStyle();
    expect(style.presetId).toBe('01');
    expect(style.recipeId).toBe('poster-anton');
    expect(style.textColor).toBe('#D2231C');
    expect(style.backgroundColor).toBe('#DCEFE4');
    expect(defaultStyle()).toEqual(style);
  });

  it('restores a saved preset instead of the first chip in the row', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const saved = styleFromPreset(presetById('03'));
    saved.measurements = { ...saved.measurements, sun: true };
    saveStyle(saved);
    const loaded = loadStyle();
    expect(loaded.presetId).toBe('03');
    expect(loaded.recipeId).toBe('quiet-bodoni');
    expect(loaded.layout).toBe('quiet');
    expect(loaded.align).toBe('center');
    expect(loaded.textColor).toBe('#4B1C40');
    expect(loaded.backgroundColor).toBe('#F7E4E1');
    expect(loaded.displayFontId).toBe('bodoni');
    expect(loaded.monoFontId).toBe('plex');
    expect(loaded.measurements.sun).toBe(true);
    expect(loaded.measurements.temperature).toBe(false);
  });

  it('keeps a customized style that is no longer a preset', () => {
    const saved = {
      ...defaultStyle(),
      presetId: null,
      recipeId: 'poster-generic',
      textColor: '#14203A',
      backgroundColor: '#F6F1E6',
      backgroundMode: 'auto' as const,
    };
    const loaded = sanitizeStyle(saved);
    expect(loaded.presetId).toBeNull();
    expect(loaded.recipeId).toBe('poster-generic');
    expect(loaded.textColor).toBe('#14203A');
    expect(loaded.backgroundColor).toBe('#F6F1E6');
    expect(loaded.displayFontId).toBe(defaultStyle().displayFontId);
  });
});
