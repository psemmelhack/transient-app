/** Face used before a location fix. Stable, so the card does not flicker. */
export const DEFAULT_MADE_SEED = 0x4d414445;

const CELL = /^-?\d+\.\d{2},-?\d+\.\d{2}$/;

/** Two decimal places, the same string `toFixed(2)` produces. About a kilometer. */
export function madeCell(latitude: number | null | undefined, longitude: number | null | undefined): string | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

export function isMadeCell(value: unknown): value is string {
  return typeof value === 'string' && CELL.test(value);
}

/**
 * The default face is the rounded cell alone (variant 0).
 * A regenerate is variant 1, 2, … of that same cell, not a fresh random number.
 * No fix yet: variant 0 stays on the default face, and later variants stay repeatable.
 */
export function placeMadeSeed(latitude: number | null | undefined, longitude: number | null | undefined, variant = 0): number {
  return seedForCell(madeCell(latitude, longitude), variant);
}

export function seedForCell(cell: string | null, variant = 0): number {
  const n = variant >>> 0;
  if (!cell) return n === 0 ? DEFAULT_MADE_SEED : mix(DEFAULT_MADE_SEED, n);
  const place = fnv1a(cell);
  return n === 0 ? place : mix(place, n);
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mix(place: number, variant: number): number {
  let hash = place >>> 0;
  hash ^= Math.imul(variant, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  return (hash ^ (hash >>> 15)) >>> 0;
}
