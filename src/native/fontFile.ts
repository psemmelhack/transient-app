const FONT_FILE = /^fonts\/[A-Za-z0-9._-]+\.(?:ttf|otf|woff2?)$/i;

/**
 * A font read may only name one file in the pack's font folder.
 * The page sends that relative path. The shell joins it to the directory the WebView can already read.
 */
export function fontFileAllowed(relative: string, readAccessUrl: string): string | null {
  if (typeof relative !== 'string' || typeof readAccessUrl !== 'string') return null;
  if (!FONT_FILE.test(relative)) return null;
  const root = readAccessUrl.trim().replace(/\/+$/, '');
  if (!root || root.includes('..') || root.includes('\0')) return null;
  return `${root}/fonts/${relative.slice('fonts/'.length)}`;
}

/** Pull `fonts/File.ttf` out of a stylesheet url. Anything else is not a pack font. */
export function fontRelativePath(url: string): string | null {
  if (typeof url !== 'string') return null;
  const cleaned = url.split(/[?#]/, 1)[0]?.trim() ?? '';
  if (!cleaned || cleaned.startsWith('data:')) return null;
  let path = cleaned;
  try {
    path = decodeURIComponent(new URL(cleaned, 'https://transient.local/').pathname);
  } catch {
    path = cleaned;
  }
  const match = path.match(/(?:^|\/)(fonts\/[A-Za-z0-9._-]+\.(?:ttf|otf|woff2?))$/i);
  return match ? match[1] : null;
}
