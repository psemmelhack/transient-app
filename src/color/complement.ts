import { contrastRatio } from './contrast';
import { hexToOklch, normalizeHex, oklchToHex } from './oklch';

/** Auto backgrounds aim here when the text color can reach it. */
export const MIN_AUTO_CONTRAST = 7;

interface Candidate {
  hex: string;
  contrast: number;
  l: number;
}

/**
 * A complementary partner for `textHex`.
 * Hue rotates 180° in OKLCH. Lightness is a light paper or a dark ink,
 * whichever contrasts, and chroma stays quiet so the type remains the subject.
 * Mid-luminance colors cannot physically reach 7:1; those get the best pair available.
 */
export function complementaryBackground(textHex: string, minContrast = MIN_AUTO_CONTRAST): string {
  const hex = normalizeHex(textHex);
  const text = hexToOklch(hex);
  const hue = (text.h + 180) % 360;
  const preferLight = text.l < 0.62;
  const chromas = [Math.min(0.08, Math.max(0.028, text.c * 0.45)), 0.02, 0.01, 0];

  let bestPassing: Candidate | null = null;
  let bestAny: Candidate | null = null;

  for (const chroma of chromas) {
    for (let i = 0; i <= 28; i++) {
      const l = 0.05 + (0.95 - 0.05) * (i / 28);
      const bg = oklchToHex(l, chroma, hue);
      const contrast = contrastRatio(hex, bg);
      const candidate = { hex: bg, contrast, l };
      if (!bestAny || better(candidate, bestAny, preferLight, false)) bestAny = candidate;
      if (contrast >= minContrast && (!bestPassing || better(candidate, bestPassing, preferLight, true))) {
        bestPassing = candidate;
      }
    }
    if (bestPassing) return bestPassing.hex;
  }
  return bestAny?.hex ?? (preferLight ? '#F4F1EA' : '#141311');
}

function better(next: Candidate, prev: Candidate, preferLight: boolean, passing: boolean): boolean {
  const nextSide = sideScore(next.l, preferLight);
  const prevSide = sideScore(prev.l, preferLight);
  if (!passing && next.contrast > prev.contrast + 0.15) return true;
  if (!passing && prev.contrast > next.contrast + 0.15) return false;
  return nextSide < prevSide;
}

/** Lower is better. Preferred side (paper or ink) beats the opposite side. */
function sideScore(l: number, preferLight: boolean): number {
  const paper = Math.abs(l - 0.93);
  const ink = Math.abs(l - 0.15);
  const preferred = preferLight ? paper : ink;
  const other = preferLight ? ink : paper;
  const onPreferredSide = preferLight ? l >= 0.72 : l <= 0.32;
  return onPreferredSide ? preferred : other + 2;
}

/** Hue of the auto background. Achromatic colors have an arbitrary hue. */
export function complementaryHue(textHex: string): number {
  const { h } = hexToOklch(textHex);
  return (h + 180) % 360;
}
