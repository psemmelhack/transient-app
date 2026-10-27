import type { CssFont } from './fonts';

/** CSS font shorthand `document.fonts.load` and `check` accept. */
export function cssFontShorthand(font: Pick<CssFont, 'family' | 'weight' | 'style'>, size: number): string {
  const family = /[\s,]/.test(font.family) ? `"${font.family}"` : font.family;
  const px = Number.isFinite(size) && size > 0 ? size : 64;
  return `${font.style} ${font.weight} ${px}px ${family}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fontReadyApi(): FontFaceSet | null {
  if (typeof document === 'undefined' || !document.fonts) return null;
  return document.fonts;
}

function faceChecked(fonts: FontFaceSet, spec: string): boolean {
  try {
    return fonts.check(spec, 'Hamburgefonsiv 38');
  } catch {
    return false;
  }
}

/**
 * Load every face the composition draws with, then confirm `document.fonts.check`.
 * A face that is still pending is retried. Measurement before this returns a fallback
 * face, and WebKit on Firefox iOS then reports empty bounding boxes.
 */
export function familyFromShorthand(spec: string): string {
  const match = spec.match(/px\s+(.+)$/);
  if (!match) return '';
  return match[1].trim().replace(/^["']|["']$/g, '');
}

/** True once an @font-face for this family has decoded, not merely fallen back. */
export function familyReady(family: string): boolean {
  const fonts = fontReadyApi();
  if (!fonts) return true;
  const want = family.replace(/^["']|["']$/g, '').trim().toLowerCase();
  if (!want) return true;
  let seen = false;
  for (const face of fonts) {
    const name = face.family.replace(/^["']|["']$/g, '').trim().toLowerCase();
    if (name !== want) continue;
    seen = true;
    if (face.status === 'loaded') return true;
  }
  // No face registered yet: don't stall the fit. A face that is still loading must be waited out.
  return !seen;
}

export async function ensureFonts(shorthands: string[]): Promise<void> {
  const fonts = fontReadyApi();
  if (!fonts?.load) return;
  const specs = [...new Set(shorthands.filter((spec) => spec.trim().length > 0))];
  if (specs.length === 0) return;
  const families = [...new Set(specs.map(familyFromShorthand).filter((family) => family.length > 0))];
  for (let attempt = 0; attempt < 4; attempt++) {
    await Promise.race([fonts.ready.then(() => undefined, () => undefined), delay(attempt === 0 ? 1600 : 400)]);
    await Promise.all(specs.map((spec) => fonts.load(spec, 'Hamburgefonsiv 38').then(() => undefined, () => undefined)));
    if (specs.every((spec) => faceChecked(fonts, spec)) && families.every((family) => familyReady(family))) return;
    await delay(140 * (attempt + 1));
  }
}
