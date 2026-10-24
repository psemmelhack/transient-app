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
    expect(loaded.format).toBe('square');
    expect(loaded.backgroundMode).toBe('manual');
  });

  it('restores whether Auto is on', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const manual = { ...defaultStyle(), presetId: null, backgroundMode: 'manual' as const, textColor: '#E3F03A', backgroundColor: '#112233' };
    saveStyle(manual);
    const loadedManual = loadStyle();
    expect(loadedManual.backgroundMode).toBe('manual');
    expect(loadedManual.backgroundColor).toBe('#112233');
    expect(loadedManual.textColor).toBe('#E3F03A');
    saveStyle({ ...manual, backgroundMode: 'auto', backgroundColor: '#ABCDEF' });
    const loadedAuto = loadStyle();
    expect(loadedAuto.backgroundMode).toBe('auto');
    expect(loadedAuto.backgroundColor).toBe('#ABCDEF');
    expect(loadedAuto.textColor).toBe('#E3F03A');
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
    expect(loaded.backgroundMode).toBe('auto');
    expect(loaded.displayFontId).toBe(defaultStyle().displayFontId);
    expect(loaded.format).toBe('square');
  });

  it('overrides a stored Story or Feed ratio and keeps every other field', () => {
    const antonio = styleFromPreset(presetById('05'));
    const loaded = sanitizeStyle({ ...antonio, format: 'story', measurements: { ...antonio.measurements, temperature: true } });
    expect(loaded.format).toBe('square');
    expect(loaded.presetId).toBe('05');
    expect(loaded.recipeId).toBe('poster-antonio');
    expect(loaded.layout).toBe('poster');
    expect(loaded.align).toBe('right');
    expect(loaded.textColor).toBe('#111111');
    expect(loaded.backgroundColor).toBe('#E3F03A');
    expect(loaded.footerColor).toBeNull();
    expect(loaded.displayFontId).toBe('antonio');
    expect(loaded.monoFontId).toBe('plex');
    expect(loaded.temperatureUnit).toBe('F');
    expect(loaded.measurements.temperature).toBe(true);
    expect(loaded.measurements.sun).toBe(false);

    const feed = sanitizeStyle({ ...styleFromPreset(presetById('01')), format: 'feed' });
    expect(feed.format).toBe('square');
    expect(feed.presetId).toBe('01');
    expect(feed.recipeId).toBe('poster-anton');
    expect(feed.textColor).toBe('#D2231C');
    expect(feed.backgroundColor).toBe('#DCEFE4');
    expect(feed.footerColor).toBe('#B01E18');
  });
});
