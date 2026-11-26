import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  DEFAULT_GRADIENT,
  gradientContrast,
  gradientCss,
  gradientSamples,
  randomGradient,
  visibleGradientColors,
} from './gradient';
import { hexToOklch } from './oklch';

function rngFrom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state & 0xffff) / 0xffff;
  };
}

describe('gradient', () => {
  it('pins the chosen colors and samples the blend in OKLCH', () => {
    const css = gradientCss(DEFAULT_GRADIENT);
    expect(css.startsWith('linear-gradient(162deg,')).toBe(true);
    expect(css).toContain('#E7F2FC 0.00%');
    expect(css).toContain('#FBF3EA 100.00%');
    const wide = gradientSamples({ stops: 2, colors: ['#2F6BFF', '#F4E6D6', '#FF7A3C'], angle: 180 });
    const mid = hexToOklch(wide[Math.floor(wide.length / 2)] ?? '#000000');
    expect(mid.c).toBeGreaterThan(0.04);
    expect(wide[0]).toBe('#2F6BFF');
    expect(wide[wide.length - 1]).toBe('#FF7A3C');
  });

  it('puts the third color between the ends', () => {
    const gradient = { stops: 3 as const, colors: ['#E7F2FC', '#F7E7F3', '#FBF3EA'] as [string, string, string], angle: 90 };
    const samples = gradientSamples(gradient);
    expect(samples[0]).toBe('#E7F2FC');
    expect(samples[Math.round((samples.length - 1) / 2)]).toBe('#F7E7F3');
    expect(samples[samples.length - 1]).toBe('#FBF3EA');
    expect(visibleGradientColors(gradient)).toEqual(['#E7F2FC', '#F7E7F3', '#FBF3EA']);
  });

  it('draws light washes for dark type and deep washes for light type', () => {
    for (let seed = 1; seed < 28; seed += 1) {
      const dark = randomGradient('#14203A', seed % 2 === 0 ? 2 : 3, rngFrom(seed));
      const light = randomGradient('#F4EFE6', seed % 2 === 0 ? 3 : 2, rngFrom(seed + 90));
      expect(gradientContrast('#14203A', dark)).toBeGreaterThanOrEqual(4.5);
      expect(gradientContrast('#F4EFE6', light)).toBeGreaterThanOrEqual(4.5);
      const darkTones = visibleGradientColors(dark).map((hex) => hexToOklch(hex));
      for (const tone of darkTones) {
        expect(tone.l).toBeGreaterThan(0.68);
        expect(tone.c).toBeGreaterThan(0.03);
      }
      const hueGap = Math.abs(darkTones[0].h - darkTones[darkTones.length - 1].h);
      const hueSpan = Math.min(hueGap, 360 - hueGap);
      const lightSpan = Math.max(...darkTones.map((tone) => tone.l)) - Math.min(...darkTones.map((tone) => tone.l));
      expect(hueSpan > 20 || lightSpan > 0.06).toBe(true);
      for (const hex of visibleGradientColors(light)) {
        const tone = hexToOklch(hex);
        expect(tone.l).toBeLessThan(0.45);
        expect(tone.c).toBeGreaterThan(0.03);
      }
    }
    expect(contrastRatio('#D2231C', DEFAULT_GRADIENT.colors[0])).toBeGreaterThan(4.5);
    expect(contrastRatio('#D2231C', DEFAULT_GRADIENT.colors[2])).toBeGreaterThan(4.5);
  });
});
