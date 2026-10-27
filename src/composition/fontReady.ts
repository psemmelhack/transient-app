import type { CssFont } from './fonts';
import type { FitFaceStatus } from './fitReport';

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

export function familyFromShorthand(spec: string): string {
  const match = spec.match(/px\s+(.+)$/);
  if (!match) return '';
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function plainFamily(family: string): string {
  return family.replace(/^["']|["']$/g, '').trim().toLowerCase();
}

/** Faces currently registered for these families. */
export function fontSnapshots(families?: string[]): FitFaceStatus[] {
  const fonts = fontReadyApi();
  if (!fonts) return [];
  const want = families?.map(plainFamily).filter((family) => family.length > 0);
  const out: FitFaceStatus[] = [];
  for (const face of fonts) {
    const family = face.family.replace(/^["']|["']$/g, '').trim();
    if (want && want.length > 0 && !want.includes(plainFamily(family))) continue;
    out.push({ family, weight: face.weight, style: face.style, status: face.status });
  }
  return out;
}

/** True when a registered face for this family has decoded. An unregistered family is not ready. */
export function familyLoaded(snapshots: FitFaceStatus[], family: string): boolean {
  const want = plainFamily(family);
  const faces = snapshots.filter((face) => plainFamily(face.family) === want);
  return faces.length > 0 && faces.some((face) => face.status === 'loaded');
}

export function familyReady(family: string): boolean {
  const fonts = fontReadyApi();
  if (!fonts) return true;
  return familyLoaded(fontSnapshots([family]), family);
}

export function fontsStatus(): string {
  const fonts = fontReadyApi();
  return fonts?.status ?? 'missing';
}

function facesSettled(snapshots: FitFaceStatus[], families: string[]): boolean {
  return families.every((family) => {
    const faces = snapshots.filter((face) => plainFamily(face.family) === plainFamily(family));
    if (faces.length === 0) return false;
    return faces.every((face) => face.status === 'loaded' || face.status === 'error');
  });
}

/**
 * Wait until `document.fonts.ready` and each `FontFace.load()` have decoded the
 * faces the composition draws with. Measuring earlier uses a fallback face.
 */
export async function ensureFonts(shorthands: string[]): Promise<void> {
  const fonts = fontReadyApi();
  if (!fonts?.load) return;
  const specs = [...new Set(shorthands.filter((spec) => spec.trim().length > 0))];
  if (specs.length === 0) return;
  const families = [...new Set(specs.map(familyFromShorthand).filter((family) => family.length > 0))];
  for (let attempt = 0; attempt < 6; attempt++) {
    await Promise.race([fonts.ready.then(() => undefined, () => undefined), delay(attempt === 0 ? 2500 : 700)]);
    const pending = fontSnapshots(families).filter((face) => face.status !== 'loaded' && face.status !== 'error');
    const loads: Promise<unknown>[] = [];
    for (const face of fonts) {
      const name = plainFamily(face.family);
      if (!families.some((family) => plainFamily(family) === name)) continue;
      if (face.status === 'loaded' || face.status === 'error') continue;
      loads.push(face.load().then(() => undefined, () => undefined));
    }
    if (pending.length > 0) await Promise.all(loads);
    await Promise.all(specs.map((spec) => fonts.load(spec, 'Hamburgefonsiv 38').then(() => undefined, () => undefined)));
    await fonts.ready.then(() => undefined, () => undefined);
    const seen = fontSnapshots(families);
    const checked = specs.every((spec) => faceChecked(fonts, spec));
    if (facesSettled(seen, families) && checked) return;
    if (seen.length === 0) {
      await delay(90 * (attempt + 1));
      continue;
    }
    if (facesSettled(seen, families)) return;
    await delay(120 * (attempt + 1));
  }
}
