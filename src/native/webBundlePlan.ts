/** Cache folder for one Expo update and one embedded pack. A font or HTML change changes the revision; a new update changes the id. */
export function cacheFolderName(updateId: string | null | undefined, revision: string): string {
  return `transient-web-${segment(updateId) || 'embedded'}-${segment(revision) || 'pack'}`;
}

export function cacheRoot(cacheDirectory: string, folder: string): string {
  const base = cacheDirectory.endsWith('/') ? cacheDirectory : `${cacheDirectory}/`;
  return `${base}${folder}/`;
}

/** file, content, and asset URIs stay as they are. A bare absolute path becomes a file URL. */
export function normalizeLocalUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return '';
  if (/^(file|content|asset|https?):\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  return trimmed;
}

/** Android cannot fetch(file://). Remote URLs download; everything else is copied by the filesystem. */
export function assetTransferKind(uri: string): 'download' | 'copy' {
  return /^https?:\/\//i.test(uri) ? 'download' : 'copy';
}

/** Parent directory of a pack-relative path, or null when the file sits in the cache root. */
export function directoryFor(root: string, relative: string): string | null {
  const parts = relative.split('/').slice(0, -1).filter((part) => part.length > 0);
  if (!parts.length) return null;
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}${parts.join('/')}`;
}

export function isSafeRelative(relative: string): boolean {
  if (!relative || relative.startsWith('/') || relative.includes('\\')) return false;
  return relative.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function segment(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80);
}
