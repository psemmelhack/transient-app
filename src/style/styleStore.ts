const STYLE_KEY = 'transient.style.v1';

export function readStyleRaw(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STYLE_KEY);
  } catch {
    return null;
  }
}

export function writeStyleRaw(value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STYLE_KEY, value);
  } catch {
    /* private mode and full disks should not break the maker */
  }
}
