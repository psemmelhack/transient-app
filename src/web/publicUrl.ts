/** Resolve a file shipped from `public/` against the document, including a `<base href>`. */
export function publicAssetUrl(file: string, baseHref?: string): string {
  const relative = file.replace(/^\/+/, '');
  const base = baseHref ?? (typeof document !== 'undefined' ? document.baseURI : undefined);
  if (!base) return relative;
  return new URL(relative, base).href;
}
