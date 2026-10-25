import { afterEach, describe, expect, it, vi } from 'vitest';
import { STYLE_KEY } from '../style/persist';
import { listTransients } from './library';
import { clearImportedForTests, encodeImportFragment, importTransients, parseImportFragment, type ImportPayload } from './import';

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFCSjAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'one',
    capturedAt: '2026-10-24T02:11:20.000Z',
    latitude: 38.244371,
    longitude: -122.15438,
    placeFull: 'Green Valley, California',
    timezone: 'America/Los_Angeles',
    message: 'A note',
    style: { backgroundColor: '#121110', textColor: '#CBA65E', align: 'right' },
    png: TINY_PNG,
    ...overrides,
  };
}

describe('import', () => {
  afterEach(async () => {
    await clearImportedForTests();
    vi.unstubAllGlobals();
  });

  it('round-trips a fragment without putting the payload on a server', () => {
    const payload: ImportPayload = { version: 1, transients: [entry({ message: 'café — here' })] };
    const parsed = parseImportFragment(encodeImportFragment(payload));
    expect(parsed?.transients?.[0]).toMatchObject({ message: 'café — here' });
    expect(parseImportFragment('#nope')).toBeNull();
  });

  it('merges by id and keeps the picture', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const first = await importTransients({ version: 1, transients: [entry()] });
    const second = await importTransients({ version: 1, transients: [entry({ message: 'again' })] });
    const saved = await listTransients();
    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(saved).toHaveLength(1);
    expect(saved[0].message).toBe('A note');
    expect(saved[0].png.size).toBeGreaterThan(32);
    expect(saved[0].png.type).toBe('image/png');
  });

  it('merges a record with no id by time and place', async () => {
    const payload = { version: 1, transients: [entry({ id: undefined })] };
    expect(await importTransients(payload)).toBe(1);
    expect(await importTransients(payload)).toBe(0);
    expect(await listTransients()).toHaveLength(1);
  });

  it('keeps two ids that share a place', async () => {
    const count = await importTransients({
      version: 1,
      transients: [entry({ id: 'a' }), entry({ id: 'b', message: 'second' })],
    });
    expect(count).toBe(2);
  });

  it('adopts old settings only when this origin has none', async () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const style = { backgroundColor: '#111111', textColor: '#ffffff', align: 'center', presetId: '03' };
    await importTransients({ version: 1, style, transients: [] });
    expect(storage.getItem(STYLE_KEY)).toContain('#111111');
    storage.setItem(STYLE_KEY, JSON.stringify({ backgroundColor: '#D2231C', textColor: '#ffffff' }));
    await importTransients({ version: 1, style: { backgroundColor: '#000000', textColor: '#ffffff' }, transients: [] });
    expect(storage.getItem(STYLE_KEY)).toContain('#D2231C');
  });

  it('skips a row that has no place or time', async () => {
    const count = await importTransients({
      version: 1,
      transients: [entry({ latitude: 'nope' }), entry({ capturedAt: 'yesterday' }), entry({ id: 'ok' })],
    });
    expect(count).toBe(1);
  });
});
