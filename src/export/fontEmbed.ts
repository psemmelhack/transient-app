import { familyLoaded, fontSnapshots } from '../composition/fontReady';
import { fontRelativePath } from '../native/fontFile';
import { requestNativeFont } from '../native/fontBridge';

export interface FontFaceSource {
  family: string;
  weight: string;
  style: string;
  url: string;
  format: string;
}

export interface EmbeddedFace extends FontFaceSource {
  dataUrl: string;
}

/** CSS plus a way to read each font file. Tests pass both. The page uses its stylesheets. */
export interface FontSources {
  css: string;
  bytes: (url: string) => Promise<string | null>;
  native?: (path: string) => Promise<string | null>;
}

const FACE_BLOCK = /@font-face\s*\{([^}]*)\}/gi;

function formatFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.woff2')) return 'woff2';
  if (lower.includes('.woff')) return 'woff';
  if (lower.includes('.otf')) return 'opentype';
  return 'truetype';
}

function mimeFor(format: string, url: string): string {
  const kind = format.toLowerCase();
  if (kind === 'woff2' || url.toLowerCase().includes('.woff2')) return 'font/woff2';
  if (kind === 'woff' || url.toLowerCase().includes('.woff')) return 'font/woff';
  if (kind === 'opentype' || url.toLowerCase().includes('.otf')) return 'font/otf';
  return 'font/ttf';
}

export function parseFontFaces(css: string): FontFaceSource[] {
  const faces: FontFaceSource[] = [];
  for (const match of css.matchAll(FACE_BLOCK)) {
    const body = match[1] ?? '';
    const family = body.match(/font-family:\s*(['"]?)([^;'"]+)\1/i)?.[2]?.trim();
    const src = body.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)(?:\s*format\(\s*(['"]?)([^'")]+)\3\s*\))?/i);
    if (!family || !src?.[2]) continue;
    const url = src[2].trim();
    if (url.startsWith('data:')) continue;
    faces.push({
      family,
      weight: body.match(/font-weight:\s*([^;]+)/i)?.[1]?.trim() || '400',
      style: body.match(/font-style:\s*([^;]+)/i)?.[1]?.trim() || 'normal',
      url,
      format: src[4]?.trim() || formatFromUrl(url),
    });
  }
  return faces;
}

export function facesForFamilies(faces: FontFaceSource[], families: string[]): FontFaceSource[] {
  const want = new Set(families.map((family) => family.trim().toLowerCase()).filter((family) => family.length > 0));
  return faces.filter((face) => want.has(face.family.toLowerCase()));
}

export function fontFaceCss(faces: EmbeddedFace[]): string {
  return faces
    .map(
      (face) =>
        `@font-face{font-family:'${face.family.replace(/'/g, '')}';src:url('${face.dataUrl}') format('${face.format}');font-weight:${face.weight};font-style:${face.style};font-display:block;}`,
    )
    .join('\n');
}

function absoluteUrl(url: string): string {
  if (/^(data|blob|https?|file):/i.test(url)) return url;
  if (typeof document === 'undefined') return url;
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return url;
  }
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const step = 0x2000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

async function fetchBase64(url: string): Promise<string | null> {
  if (typeof fetch === 'function') {
    try {
      const response = await fetch(url);
      if (response.ok) return bufferToBase64(await response.arrayBuffer());
    } catch {
      // file: URLs in WKWebView reject fetch. The native read is next.
    }
  }
  if (typeof XMLHttpRequest === 'undefined') return null;
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      const buffer = xhr.response;
      if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
        resolve(null);
        return;
      }
      if (xhr.status !== 0 && xhr.status !== 200) {
        resolve(null);
        return;
      }
      try {
        resolve(bufferToBase64(buffer));
      } catch {
        resolve(null);
      }
    };
    xhr.onerror = () => resolve(null);
    xhr.send();
  });
}

async function readDocumentCss(): Promise<string> {
  if (typeof document === 'undefined') return '';
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let text = '';
    try {
      text = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n');
    } catch {
      const href = sheet.href;
      if (!href) continue;
      try {
        const response = await fetch(href);
        if (response.ok) text = await response.text();
      } catch {
        text = '';
      }
    }
    if (text.includes('@font-face')) chunks.push(text);
  }
  if (chunks.length > 0) return chunks.join('\n');
  try {
    const href = new URL('fonts.css', document.baseURI).href;
    const response = await fetch(href);
    if (response.ok) return await response.text();
  } catch {
    // The stylesheet did not load. Capture still refits so the fallback cannot spill.
  }
  return '';
}

async function bytesForFace(face: FontFaceSource, sources?: FontSources): Promise<string | null> {
  const relative = fontRelativePath(face.url);
  if (sources) {
    const inline = await sources.bytes(face.url);
    if (inline) return inline;
    if (relative && sources.native) return sources.native(relative);
    return null;
  }
  if (!relative && !face.url.startsWith('data:')) return null;
  const remote = await fetchBase64(absoluteUrl(face.url));
  if (remote) return remote;
  if (!relative) return null;
  return requestNativeFont(relative);
}

/** Load every embedded face and wait until `document.fonts` has decoded it. */
export async function confirmEmbeddedFonts(cssText: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const fonts = document.fonts;
  const pending: Promise<unknown>[] = [];
  const blocks = cssText.match(/@font-face\s*\{[^}]*\}/gi) ?? [];
  for (const block of blocks) {
    const family = block.match(/font-family:\s*(['"]?)([^;'"]+)\1/i)?.[2]?.trim();
    const url = block.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i)?.[2];
    if (!family || !url) continue;
    if (familyLoaded(fontSnapshots([family]), family)) continue;
    const weight = block.match(/font-weight:\s*([^;]+)/i)?.[1]?.trim() || '400';
    const style = block.match(/font-style:\s*([^;]+)/i)?.[1]?.trim() || 'normal';
    try {
      const loaded = new FontFace(family, `url("${url}")`, { weight, style, display: 'block' });
      fonts.add(loaded);
      pending.push(loaded.load().then(() => undefined, () => undefined));
    } catch {
      pending.push(fonts.load(`16px "${family}"`).then(() => undefined, () => undefined));
    }
  }
  await Promise.all(pending);
  await fonts.ready.then(() => undefined, () => undefined);
}

/**
 * `@font-face` rules whose files are base64, for the families the scene paints.
 * modern-screenshot otherwise fetches each file. That fetch fails for a `file:` pack, and the
 * headline is drawn with the serif fallback.
 */
export async function embedSceneFonts(families: string[], sources?: FontSources): Promise<string> {
  const wanted = [...new Set(families.map((family) => family.trim()).filter((family) => family.length > 0))];
  if (!wanted.length) return '';
  const css = sources?.css ?? (await readDocumentCss());
  const faces = facesForFamilies(parseFontFaces(css), wanted);
  const embedded: EmbeddedFace[] = [];
  for (const face of faces) {
    const encoded = await bytesForFace(face, sources);
    if (!encoded) continue;
    embedded.push({ ...face, dataUrl: `data:${mimeFor(face.format, face.url)};base64,${encoded}` });
  }
  const cssText = fontFaceCss(embedded);
  if (cssText) await confirmEmbeddedFonts(cssText);
  return cssText;
}
