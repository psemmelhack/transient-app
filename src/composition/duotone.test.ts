import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../color/contrast';
import { rgbToHex } from '../color/oklch';
import { applyDuotone, duotoneStops } from './duotone';

function solid(r: number, g: number, b: number, count = 1): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i += 1) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}

describe('duotone', () => {
  it('keeps the original pixels when the level is zero', () => {
    const source = solid(40, 90, 180);
    const stops = duotoneStops('#C4483A', '#F4F1EA');
    const toned = applyDuotone(source, stops, 0);
    expect(Array.from(toned.pixels)).toEqual(Array.from(source));
  });

  it('maps black to the shadow and white to the highlight at full level', () => {
    const stops = duotoneStops('#2F6B4F', '#161513');
    const black = applyDuotone(solid(0, 0, 0), stops, 1);
    const white = applyDuotone(solid(255, 255, 255), stops, 1);
    expect(black.pixels[0]).toBe(Math.round(stops.shadow[0] * 255));
    expect(white.pixels[0]).toBe(Math.round(stops.highlight[0] * 255));
    expect(white.pixels[1]).toBe(Math.round(stops.highlight[1] * 255));
  });

  it('lands a mid level between the original and the full tone', () => {
    const stops = duotoneStops('#1F4E9A', '#F4F1EA');
    const source = solid(200, 40, 40);
    const full = applyDuotone(source, stops, 1);
    const mid = applyDuotone(source, stops, 0.5);
    expect(mid.pixels[0]).toBeGreaterThan(Math.min(source[0]!, full.pixels[0]!));
    expect(mid.pixels[0]).toBeLessThan(Math.max(source[0]!, full.pixels[0]!));
  });

  it('keeps a dark field for light ink and a lifted field for dark ink', () => {
    const light = duotoneStops('#1E3A2D', '#F4F1EA');
    const dark = duotoneStops('#1E3A2D', '#161513');
    const lightHighlight = 0.2126 * light.highlight[0] + 0.7152 * light.highlight[1] + 0.0722 * light.highlight[2];
    const darkHighlight = 0.2126 * dark.highlight[0] + 0.7152 * dark.highlight[1] + 0.0722 * dark.highlight[2];
    expect(lightHighlight).toBeLessThan(0.4);
    expect(darkHighlight).toBeGreaterThan(0.6);
    expect(contrastRatio('#F4F1EA', rgbToHex(light.highlight))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#161513', rgbToHex(dark.highlight))).toBeGreaterThanOrEqual(4.5);
    expect(dark.highlight[1]).toBeGreaterThan(dark.highlight[0]);
    expect(dark.highlight[1]).toBeGreaterThan(dark.highlight[2]);
    const navy = duotoneStops('#14203A', '#161513');
    expect(navy.highlight[2]).toBeGreaterThan(navy.highlight[0]);
  });

  it('is deterministic', () => {
    const source = solid(12, 80, 200, 4);
    const stops = duotoneStops('#E6A817', '#161513');
    const first = applyDuotone(source, stops, 0.7);
    const second = applyDuotone(source, stops, 0.7);
    expect(Array.from(first.pixels)).toEqual(Array.from(second.pixels));
  });
});
