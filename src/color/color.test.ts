import { describe, expect, it } from 'vitest';
import { complementaryBackground, complementaryHue, MIN_AUTO_CONTRAST } from './complement';
import { contrastRatio } from './contrast';
import { hexToOklch, normalizeHex, oklchToHex } from './oklch';

describe('contrast', () => {
  it('rates black on white at 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#D2231C', '#DCEFE4')).toBeCloseTo(contrastRatio('#DCEFE4', '#D2231C'), 8);
  });

  it('keeps the reference posters readable', () => {
    expect(contrastRatio('#D2231C', '#DCEFE4')).toBeGreaterThan(4);
    expect(contrastRatio('#F2E8D5', '#14203A')).toBeGreaterThan(7);
    expect(contrastRatio('#4B1C40', '#F7E4E1')).toBeGreaterThan(7);
    expect(contrastRatio('#CBA65E', '#121110')).toBeGreaterThan(7);
    expect(contrastRatio('#111111', '#E3F03A')).toBeGreaterThan(7);
    expect(contrastRatio('#1E3A2D', '#F1EADC')).toBeGreaterThan(7);
  });
});

describe('oklch', () => {
  it('round-trips a saturated red', () => {
    const { l, c, h } = hexToOklch('#D2231C');
    const back = oklchToHex(l, c, h);
    const [r1, g1, b1] = [0xd2, 0x23, 0x1c];
    const parsed = back.slice(1).match(/../g)!.map((b) => parseInt(b, 16));
    expect(Math.abs(parsed[0] - r1)).toBeLessThanOrEqual(1);
    expect(Math.abs(parsed[1] - g1)).toBeLessThanOrEqual(1);
    expect(Math.abs(parsed[2] - b1)).toBeLessThanOrEqual(1);
  });

  it('normalizes hex', () => {
    expect(normalizeHex('d2231c')).toBe('#D2231C');
  });
});

describe('complementary background', () => {
  it('rotates hue by 180 degrees', () => {
    const text = hexToOklch('#D2231C');
    expect(complementaryHue('#D2231C')).toBeCloseTo((text.h + 180) % 360, 5);
  });

  it('clears the contrast threshold for light and dark type', () => {
    for (const hex of ['#111111', '#FFFFFF', '#14203A', '#F2E8D5', '#1E3A2D', '#E3F03A']) {
      const bg = complementaryBackground(hex);
      expect(contrastRatio(hex, bg)).toBeGreaterThanOrEqual(MIN_AUTO_CONTRAST);
    }
  });

  it('tints a mid color toward its complement without dropping below AA', () => {
    const hex = '#D2231C';
    const bg = complementaryBackground(hex);
    expect(contrastRatio(hex, bg)).toBeGreaterThan(4.5);
    const hue = hexToOklch(bg).h;
    const target = complementaryHue(hex);
    const delta = Math.min(Math.abs(hue - target), 360 - Math.abs(hue - target));
    expect(delta).toBeLessThan(25);
  });
});
