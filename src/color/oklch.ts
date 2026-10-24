/** OKLab / OKLCH conversion, Björn Ottosson. */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function normalizeHex(input: string): string {
  const raw = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return '#111111';
  return `#${raw.toUpperCase()}`;
}

export function isHex(input: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(input.trim());
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function rgbToHex(rgb: [number, number, number]): string {
  const ch = rgb.map((v) => {
    const n = Math.round(Math.min(1, Math.max(0, v)) * 255);
    return n.toString(16).padStart(2, '0');
  });
  return `#${ch.join('')}`.toUpperCase();
}

function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear) as [number, number, number];
  const [L, a, b2] = linearSrgbToOklab(r, g, b);
  const c = Math.hypot(a, b2);
  let h = (Math.atan2(b2, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

export function oklchToLinearRgb(l: number, c: number, h: number): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;
  return oklabToLinearSrgb(l, a, b);
}

function inGamut(rgb: [number, number, number]): boolean {
  return rgb.every((v) => v >= -0.0005 && v <= 1.0005);
}

/** Max chroma at this L/h that stays inside sRGB, then hex. */
export function oklchToHex(l: number, c: number, h: number): string {
  let lo = 0;
  let hi = Math.max(0, c);
  let best: [number, number, number] = [l, l, l];
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const rgb = oklchToLinearRgb(l, mid, h);
    if (inGamut(rgb)) {
      lo = mid;
      best = rgb;
    } else {
      hi = mid;
    }
  }
  return rgbToHex(best.map(linearToSrgb) as [number, number, number]);
}

export function hexToLinearRgb(hex: string): [number, number, number] {
  return hexToRgb(hex).map(srgbToLinear) as [number, number, number];
}
