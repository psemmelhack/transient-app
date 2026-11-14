import { relativeLuminance } from '../color/contrast';
import { hexToRgb, normalizeHex } from '../color/oklch';
import { averageLuminance, type PosterPhoto } from './posterPhoto';

export type Rgb = [number, number, number];

export interface DuotoneStops {
  shadow: Rgb;
  highlight: Rgb;
}

function rgbToHsl(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let channel = t;
    if (channel < 0) channel += 1;
    if (channel > 1) channel -= 1;
    if (channel < 1 / 6) return p + (q - p) * 6 * channel;
    if (channel < 1 / 2) return q;
    if (channel < 2 / 3) return p + (q - p) * (2 / 3 - channel) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}

/**
 * Map photo luminance onto two stops of the chosen color.
 * Light ink gets a dark field in that hue. Dark ink gets the hue lifted toward paper
 * so the type still clears, without washing the color out to gray.
 */
export function duotoneStops(toneHex: string, textHex: string): DuotoneStops {
  const tone = hexToRgb(normalizeHex(toneHex));
  const [hue, saturation, lightness] = rgbToHsl(tone);
  const textLum = relativeLuminance(normalizeHex(textHex));
  const sat = saturation < 0.06 ? 0 : Math.min(0.85, Math.max(saturation, Math.min(0.62, saturation * 1.45)));
  const lightText = textLum >= 0.4;
  const shadowL = lightText ? 0.07 : 0.16;
  const highlightL = lightText ? (lightness > 0.72 ? 0.34 : 0.28) : 0.78;
  const highlightS = lightText ? sat : Math.min(0.72, sat * 0.9);
  return {
    shadow: hslToRgb(hue, sat, shadowL),
    highlight: hslToRgb(hue, highlightS, highlightL),
  };
}

function channel(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)));
}

function writeDuotone(source: Uint8ClampedArray, levels: ArrayLike<number> | null, stops: DuotoneStops, level: number, out: Uint8ClampedArray): void {
  const amount = Math.min(1, Math.max(0, level));
  if (amount <= 0) {
    out.set(source);
    return;
  }
  const shadow = stops.shadow.map((value) => value * 255);
  const highlight = stops.highlight.map((value) => value * 255);
  for (let pixel = 0, index = 0; index < source.length; pixel += 1, index += 4) {
    const y = levels ? levels[pixel]! : luma(source[index]!, source[index + 1]!, source[index + 2]!);
    const toneR = shadow[0]! + (highlight[0]! - shadow[0]!) * y;
    const toneG = shadow[1]! + (highlight[1]! - shadow[1]!) * y;
    const toneB = shadow[2]! + (highlight[2]! - shadow[2]!) * y;
    out[index] = channel(source[index]! + (toneR - source[index]!) * amount);
    out[index + 1] = channel(source[index + 1]! + (toneG - source[index + 1]!) * amount);
    out[index + 2] = channel(source[index + 2]! + (toneB - source[index + 2]!) * amount);
    out[index + 3] = source[index + 3]!;
  }
}

/** Rec.709 luma, eased so midtones keep some of the photograph. */
function luma(r: number, g: number, b: number): number {
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return y ** 0.85;
}

/**
 * Blend each pixel from the original toward the duotone.
 * Level 0 is the original. Level 1 is the full map.
 */
export function applyDuotone(pixels: Uint8ClampedArray, stops: DuotoneStops, level: number): { pixels: Uint8ClampedArray; luminance: number } {
  const out = new Uint8ClampedArray(pixels.length);
  writeDuotone(pixels, null, stops, level, out);
  return { pixels: out, luminance: averageLuminance(out) };
}

export interface HeldTone {
  /** Source JPEG the bake was made from. Not the baked image. */
  jpeg: string;
  level: number;
  tone: string;
  text: string;
  photo: PosterPhoto;
}

/**
 * The card keeps the last bake for this photo while a new level or color is still rendering.
 * Level 0 is the original. A different photo does not reuse the previous bake.
 */
export function selectDisplayedPhoto(photo: PosterPhoto | null, level: number, held: HeldTone | null): PosterPhoto | null {
  if (!photo) return null;
  if (level <= 0 || !held || held.jpeg !== photo.jpeg) return photo;
  return held.photo;
}

const decoded = new Map<string, ImageData>();
const lumaTables = new Map<string, Float32Array>();
const frameBuffers = new WeakMap<HTMLCanvasElement, ImageData>();

function remember(jpeg: string, image: ImageData): void {
  const count = image.width * image.height;
  const table = new Float32Array(count);
  const data = image.data;
  for (let pixel = 0, index = 0; pixel < count; pixel += 1, index += 4) {
    table[pixel] = luma(data[index]!, data[index + 1]!, data[index + 2]!);
  }
  decoded.set(jpeg, image);
  lumaTables.set(jpeg, table);
  while (decoded.size > 2) {
    const oldest = decoded.keys().next().value;
    if (!oldest) break;
    decoded.delete(oldest);
    lumaTables.delete(oldest);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the photo'));
    img.src = src;
  });
}

async function pixelsFor(jpeg: string): Promise<ImageData> {
  const cached = decoded.get(jpeg);
  if (cached) return cached;
  const img = await loadImage(jpeg);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not read the photo');
  context.drawImage(img, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  remember(jpeg, image);
  return image;
}

/** Decode the working photo so the next slider move can paint without waiting. */
export function ensureDuotonePixels(jpeg: string): Promise<void> {
  return pixelsFor(jpeg).then(() => undefined);
}

/**
 * Paint the current duotone into a canvas already on screen.
 * Returns null until the source pixels are decoded. The JPEG bake can follow later.
 */
export function paintDuotoneCanvas(canvas: HTMLCanvasElement, photo: PosterPhoto, toneHex: string, textHex: string, level: number): number | null {
  const source = decoded.get(photo.jpeg);
  const levels = lumaTables.get(photo.jpeg);
  if (!source || !levels) return null;
  const amount = Math.round(Math.min(1, Math.max(0, level)) * 100) / 100;
  const context = canvas.getContext('2d');
  if (!context) return null;
  if (canvas.width !== source.width || canvas.height !== source.height) {
    canvas.width = source.width;
    canvas.height = source.height;
  }
  let frame = frameBuffers.get(canvas);
  if (!frame || frame.width !== source.width || frame.height !== source.height) {
    frame = context.createImageData(source.width, source.height);
    frameBuffers.set(canvas, frame);
  }
  writeDuotone(source.data, levels, duotoneStops(toneHex, textHex), amount, frame.data);
  context.putImageData(frame, 0, 0);
  return averageLuminance(frame.data);
}

const results = new Map<string, PosterPhoto>();

/**
 * Bake the duotone into a JPEG the preview and the PNG capture both display.
 * The stored photo stays the original; this is a display copy.
 */
export async function tonePosterPhoto(photo: PosterPhoto, toneHex: string, textHex: string, level: number): Promise<PosterPhoto> {
  const amount = Math.round(Math.min(1, Math.max(0, level)) * 100) / 100;
  if (amount <= 0) return photo;
  const tone = normalizeHex(toneHex);
  const text = normalizeHex(textHex);
  const key = `${amount}|${tone}|${text}|${photo.jpeg}`;
  const cached = results.get(key);
  if (cached) return cached;
  const source = await pixelsFor(photo.jpeg);
  const stops = duotoneStops(tone, text);
  const toned = applyDuotone(source.data, stops, amount);
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) return photo;
  const image = context.createImageData(source.width, source.height);
  image.data.set(toned.pixels);
  context.putImageData(image, 0, 0);
  const next = { jpeg: canvas.toDataURL('image/jpeg', 0.9), luminance: toned.luminance };
  results.set(key, next);
  if (results.size > 8) {
    const oldest = results.keys().next().value;
    if (oldest) results.delete(oldest);
  }
  return next;
}
