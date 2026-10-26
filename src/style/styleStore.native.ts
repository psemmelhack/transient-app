import { nativeDb } from '../storage/nativeDb';

const STYLE_KEY = 'transient.style.v1';

export function readStyleRaw(): string | null {
  try {
    const row = nativeDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', STYLE_KEY);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function writeStyleRaw(value: string): void {
  try {
    nativeDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', STYLE_KEY, value);
  } catch {
    /* A full disk should not break the maker. */
  }
}
