import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../color/contrast';
import { MIN_AUTO_CONTRAST } from '../color/complement';
import { getFont } from '../composition/fonts';
import { defaultStyle } from './presets';
import { randomStyle } from './randomize';

describe('randomStyle', () => {
  it('keeps the format and clears the contrast bar', () => {
    const current = defaultStyle();
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed & 0xffff) / 0xffff;
    };
    for (let i = 0; i < 24; i++) {
      const next = randomStyle(current, rng);
      expect(next.format).toBe(current.format);
      expect(getFont(next.displayFontId).category).not.toBe('mono');
      expect(getFont(next.monoFontId).category).toBe('mono');
      expect(contrastRatio(next.textColor, next.backgroundColor)).toBeGreaterThanOrEqual(MIN_AUTO_CONTRAST);
      expect(next.backgroundMode).toBe('auto');
      expect(next.presetId).toBeNull();
    }
  });
});
