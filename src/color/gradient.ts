import { contrastRatio } from './contrast';
import { hexToOklch, normalizeHex, oklchToHex, type Oklch } from './oklch';
import type { CardGradient } from '../style/types';

/** Angles the controls offer. 162 leans off vertical, which reads as a modern wash. */
export const GRADIENT_ANGLES = [162, 180, 90, 200] as const;

export const DEFAULT_GRADIENT: CardGradient = {
  stops: 2,
  colors: ['#E7F2FC', '#F7E7F3', '#FBF3EA'],
  angle: 162,
};

/** Start and end, with the middle stop only when three colors are showing. */
export function visibleGradientColors(gradient: CardGradient): string[] {
  return gradient.stops === 2 ? [gradient.colors[0], gradient.colors[2]] : [...gradient.colors];
}

const SAMPLES = 16;
const MIN_CONTRAST = 4.5;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest hue step, so a wide pair stays chromatic instead of collapsing through gray. */
function lerpHue(a: number, b: number, t: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

function mix(from: Oklch, to: Oklch, t: number): Oklch {
  return { l: lerp(from.l, to.l, t), c: lerp(from.c, to.c, t), h: lerpHue(from.h, to.h, t) };
}

/** Even samples in OKLCH, with the chosen colors pinned at the knots. */
export function gradientSamples(gradient: CardGradient): string[] {
  const chosen = visibleGradientColors(gradient).map((hex) => normalizeHex(hex));
  const labs = chosen.map((hex) => hexToOklch(hex));
  const out: string[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const t = index / (SAMPLES - 1);
    const scaled = t * (labs.length - 1);
    const slot = Math.min(labs.length - 2, Math.floor(scaled));
    const local = scaled - slot;
    const from = labs[slot] ?? labs[0];
    const to = labs[slot + 1] ?? from;
    if (!from) {
      out.push('#111111');
      continue;
    }
    const mixed = mix(from, to, local);
    out.push(oklchToHex(mixed.l, mixed.c, mixed.h));
  }
  out[0] = chosen[0] ?? out[0];
  out[out.length - 1] = chosen[chosen.length - 1] ?? out[out.length - 1];
  if (chosen.length === 3) out[Math.round((SAMPLES - 1) / 2)] = chosen[1] ?? out[Math.round((SAMPLES - 1) / 2)];
  return out;
}

export function gradientCss(gradient: CardGradient): string {
  const angle = normalizeAngle(gradient.angle);
  const stops = gradientSamples(gradient).map((hex, index) => {
    const at = (index / (SAMPLES - 1)) * 100;
    return `${hex} ${at.toFixed(2)}%`;
  });
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}

export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return DEFAULT_GRADIENT.angle;
  return ((Math.round(angle) % 360) + 360) % 360;
}

export function gradientContrast(textHex: string, gradient: CardGradient): number {
  return visibleGradientColors(gradient).reduce((worst, hex) => Math.min(worst, contrastRatio(textHex, hex)), 21);
}

function prefersLight(textHex: string): boolean {
  return contrastRatio(textHex, '#F6F3EC') >= contrastRatio(textHex, '#171614');
}

function readable(textHex: string, l: number, c: number, h: number, light: boolean): string {
  let lightness = l;
  let hex = oklchToHex(lightness, c, h);
  const step = light ? 0.025 : -0.025;
  for (let pass = 0; pass < 8 && contrastRatio(textHex, hex) < MIN_CONTRAST; pass += 1) {
    lightness = Math.min(0.97, Math.max(0.1, lightness + step));
    hex = oklchToHex(lightness, c, h);
  }
  return hex;
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;
}

/**
 * A palette in one lightness band, so one text color stays readable.
 * Hue schemes stay analogous or split-complementary. Chroma stays up so the
 * blend cannot fall into gray or brown.
 */
export function randomGradient(textHex: string, stops: 2 | 3, rng: () => number = Math.random): CardGradient {
  const light = prefersLight(textHex);
  const lights: [number, number, number] = light ? [0.93, 0.77, 0.85] : [0.18, 0.36, 0.26];
  const baseChroma = light ? 0.09 + rng() * 0.05 : 0.06 + rng() * 0.04;
  const hue = rng() * 360;
  const scheme = stops === 3 ? pick(['analogous', 'split'] as const, rng) : pick(['analogous', 'complement', 'split'] as const, rng);
  const step = 42 + rng() * 28;
  const complement = 150 + rng() * 24;
  const split = 142 + rng() * 20;
  const offsets: [number, number, number] =
    scheme === 'analogous'
      ? [0, step, step + 14 + rng() * 12]
      : scheme === 'complement'
        ? [0, complement * 0.45, complement]
        : [0, split, split + 32 + rng() * 18];
  const order = [
    { light: lights[0], offset: offsets[0] },
    { light: lights[2], offset: offsets[1] },
    { light: lights[1], offset: offsets[2] },
  ];
  const colors = order.map((stop) => {
    const chroma = Math.max(0.04, baseChroma + (rng() - 0.5) * 0.02);
    return readable(textHex, stop.light, chroma, hue + stop.offset, light);
  }) as [string, string, string];
  return { stops, colors, angle: pick(GRADIENT_ANGLES, rng) };
}

export function gradientReads(textHex: string, gradient: CardGradient): boolean {
  return gradientContrast(textHex, gradient) >= MIN_CONTRAST;
}
