import { relativeLuminance } from '../color/contrast';

/** The card is square. The stored JPEG is this edge, matching the PNG. */
export const POSTER_PHOTO_EDGE = 1080;

/** Longest edge decoded before the cover crop, so a camera original is not drawn at full size. */
export const POSTER_DECODE_EDGE = 2160;

const JPEG_QUALITY = 0.86;
const JPEG_QUALITY_TIGHT = 0.72;
const MAX_JPEG_CHARS = 1_600_000;

const DARK_VEIL = { rgb: '12, 16, 28', hex: '#0C101C' };
const LIGHT_VEIL = { rgb: '244, 241, 234', hex: '#F4F1EA' };
const PAPER = '#F4F1EA';
const INK = '#161513';
const READABLE = 4.5;

export interface PosterPhoto {
  /** Square JPEG data URL, already cover-cropped to the card. */
  jpeg: string;
  /** Average relative luminance of that crop, 0–1. */
  luminance: number;
}

export interface Legibility {
  scrim: string;
  textColor: string;
  footerColor: string;
  /** Luminance of the lightest part of the veil. Type is checked against this. */
  composite: number;
}

/** Center square of a bitmap, the same region CSS object-fit: cover would show. */
export function coverSquare(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(Math.max(width, 0), Math.max(height, 0));
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}

/** Fit inside maxEdge on the long side. Aspect stays. */
export function fittedEdge(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const long = Math.max(w, h);
  if (long <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / long;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Size a camera original so the short side can still fill the card, and the long side stays bounded.
 * A 16:9 frame becomes just wide enough to cover the square. A panorama is capped.
 */
export function resizeForCard(width: number, height: number, edge = POSTER_PHOTO_EDGE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: edge, height: edge };
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const capLong = edge * 2;
  if (short <= edge && long <= capLong) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = Math.min(edge / short, capLong / long);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function channelLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of RGBA pixels. Transparent pixels are skipped. */
export function averageLuminance(pixels: ArrayLike<number>): number {
  let sum = 0;
  let weight = 0;
  const step = pixels.length > 200_000 ? 8 : 1;
  for (let index = 0; index + 3 < pixels.length; index += 4 * step) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.06) continue;
    const lum =
      0.2126 * channelLinear(pixels[index]) +
      0.7152 * channelLinear(pixels[index + 1]) +
      0.0722 * channelLinear(pixels[index + 2]);
    sum += lum * alpha;
    weight += alpha;
  }
  if (weight === 0) return 0.5;
  return sum / weight;
}

function luminanceContrast(lighter: number, darker: number): number {
  const hi = Math.max(lighter, darker);
  const lo = Math.min(lighter, darker);
  return (hi + 0.05) / (lo + 0.05);
}

interface VeilHit {
  alpha: number;
  composite: number;
  minContrast: number;
  rgb: string;
}

/** Smallest veil in range that clears `lums`. Null when the colors cannot. */
function searchVeil(lums: number[], photo: number, veilLum: number, rgb: string, maxAlpha: number): VeilHit | null {
  for (let alpha = 0.28; alpha <= maxAlpha + 1e-6; alpha += 0.02) {
    const composite = alpha * veilLum + (1 - alpha) * photo;
    const minContrast = Math.min(...lums.map((lum) => luminanceContrast(lum, composite)));
    if (minContrast >= READABLE) return { alpha, composite, minContrast, rgb };
  }
  return null;
}

function preferVeil(dark: VeilHit | null, light: VeilHit | null, textLum: number): VeilHit | null {
  if (dark && light) {
    if (Math.abs(dark.alpha - light.alpha) > 0.04) return dark.alpha < light.alpha ? dark : light;
    return textLum >= 0.5 ? dark : light;
  }
  return dark ?? light;
}

/**
 * A vertical veil, a little stronger at the top and bottom, where the type sits.
 * The style's own colors stay when a moderate veil clears them.
 * A light color on a bright photo, or a dark color on a dark one, falls back to ink or paper
 * so the photograph is not buried under an opaque slab.
 */
export function legibilityFor(textColor: string, footerColor: string | null, photoLuminance: number): Legibility {
  const photo = Math.min(1, Math.max(0, photoLuminance));
  const footer = footerColor ?? textColor;
  const darkLum = relativeLuminance(DARK_VEIL.hex);
  const lightLum = relativeLuminance(LIGHT_VEIL.hex);
  const textLum = relativeLuminance(textColor);
  const lums = [textLum, relativeLuminance(footer)];
  let ink = textColor;
  let footerInk = footer;
  let chosen = preferVeil(
    searchVeil(lums, photo, darkLum, DARK_VEIL.rgb, 0.78),
    searchVeil(lums, photo, lightLum, LIGHT_VEIL.rgb, 0.78),
    textLum,
  );
  if (!chosen) {
    ink = photo >= textLum ? INK : PAPER;
    footerInk = photo >= relativeLuminance(footer) ? INK : PAPER;
    const next = [relativeLuminance(ink), relativeLuminance(footerInk)];
    chosen = preferVeil(
      searchVeil(next, photo, darkLum, DARK_VEIL.rgb, 0.78),
      searchVeil(next, photo, lightLum, LIGHT_VEIL.rgb, 0.78),
      relativeLuminance(ink),
    );
  }
  if (!chosen) {
    const rgb = textLum >= 0.5 ? DARK_VEIL.rgb : LIGHT_VEIL.rgb;
    const veilLum = textLum >= 0.5 ? darkLum : lightLum;
    const alpha = 0.62;
    chosen = { alpha, composite: alpha * veilLum + (1 - alpha) * photo, minContrast: 0, rgb };
  }
  const mid = chosen.alpha;
  const edge = Math.min(0.86, mid + 0.1);
  const scrim = `linear-gradient(180deg, rgba(${chosen.rgb}, ${edge.toFixed(3)}) 0%, rgba(${chosen.rgb}, ${mid.toFixed(3)}) 36%, rgba(${chosen.rgb}, ${mid.toFixed(3)}) 64%, rgba(${chosen.rgb}, ${edge.toFixed(3)}) 100%)`;
  return { scrim, textColor: ink, footerColor: footerInk, composite: chosen.composite };
}

/** Keep a saved JPEG. Anything else, including a huge payload, is dropped. */
export function storedPhoto(value: unknown): PosterPhoto | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { jpeg?: unknown; luminance?: unknown };
  if (typeof raw.jpeg !== 'string' || !raw.jpeg.startsWith('data:image/jpeg;base64,')) return null;
  if (raw.jpeg.length < 32 || raw.jpeg.length > MAX_JPEG_CHARS) return null;
  if (typeof raw.luminance !== 'number' || !Number.isFinite(raw.luminance)) return null;
  return { jpeg: raw.jpeg, luminance: Math.min(1, Math.max(0, raw.luminance)) };
}

export function jpegBase64ToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'image/jpeg' });
}

async function decodeOriented(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(blob);
  }
}

/**
 * Cover-crop to the card, honoring EXIF orientation, and remember the crop's luminance.
 * Big originals are scaled down before the final draw.
 */
export async function preparePosterPhoto(source: Blob): Promise<PosterPhoto> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new Error('Could not read that photo');
  }
  const decoded = await decodeOriented(source);
  let scaled: ImageBitmap | null = null;
  try {
    const fitted = fittedEdge(decoded.width, decoded.height, POSTER_DECODE_EDGE);
    let working = decoded;
    if (fitted.width !== decoded.width || fitted.height !== decoded.height) {
      try {
        scaled = await createImageBitmap(decoded, {
          resizeWidth: fitted.width,
          resizeHeight: fitted.height,
          resizeQuality: 'high',
        });
        working = scaled;
      } catch {
        working = decoded;
      }
    }
    const crop = coverSquare(working.width, working.height);
    const canvas = document.createElement('canvas');
    canvas.width = POSTER_PHOTO_EDGE;
    canvas.height = POSTER_PHOTO_EDGE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not read that photo');
    ctx.drawImage(working, crop.sx, crop.sy, crop.side, crop.side, 0, 0, POSTER_PHOTO_EDGE, POSTER_PHOTO_EDGE);
    const luminance = averageLuminance(ctx.getImageData(0, 0, POSTER_PHOTO_EDGE, POSTER_PHOTO_EDGE).data);
    let jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (jpeg.length > 900_000) jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY_TIGHT);
    return { jpeg, luminance };
  } finally {
    scaled?.close();
    decoded.close();
  }
}
