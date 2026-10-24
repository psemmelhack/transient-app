import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../color/contrast';
import { formatChoiceEnabled } from '../composition/formats';
import { defaultStyle } from './presets';
import { withAutoBackground, withFormat, withLayout, withMeasurement, withTextColor } from './edit';

describe('style edits', () => {
  it('switches layout onto the generic recipe and clears the preset', () => {
    const next = withLayout(defaultStyle(), 'quiet');
    expect(next.layout).toBe('quiet');
    expect(next.recipeId).toBe('quiet-generic');
    expect(next.presetId).toBeNull();
    expect(next.footerColor).toBeNull();
  });

  it('picks a complementary background when the text color changes', () => {
    const next = withTextColor(defaultStyle(), '#14203A');
    expect(next.textColor).toBe('#14203A');
    expect(next.backgroundMode).toBe('auto');
    expect(contrastRatio(next.textColor, next.backgroundColor)).toBeGreaterThan(4.5);
  });

  it('remembers a measurement toggle without dropping the others', () => {
    const next = withMeasurement(defaultStyle(), 'sun', true);
    expect(next.measurements.sun).toBe(true);
    expect(next.measurements.temperature).toBe(false);
    const back = withAutoBackground(next);
    expect(back.measurements.sun).toBe(true);
    expect(back.backgroundMode).toBe('auto');
  });

  it('keeps Square while the format control is hidden', () => {
    const current = defaultStyle();
    const next = withFormat(current, 'story');
    if (formatChoiceEnabled) {
      expect(next.format).toBe('story');
      expect(next.presetId).toBeNull();
    } else {
      expect(next).toEqual(current);
      expect(next.format).toBe('square');
    }
  });
});
