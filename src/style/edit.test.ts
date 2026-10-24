import { describe, expect, it } from 'vitest';
import { complementaryBackground } from '../color/complement';
import { contrastRatio } from '../color/contrast';
import { formatChoiceEnabled } from '../composition/formats';
import { withAutoBackground, withBackground, withFormat, withLayout, withManualBackground, withMeasurement, withPreset, withTextColor } from './edit';
import { defaultStyle, presetById } from './presets';

describe('style edits', () => {
  it('switches layout onto the generic recipe and clears the preset', () => {
    const next = withLayout(defaultStyle(), 'quiet');
    expect(next.layout).toBe('quiet');
    expect(next.recipeId).toBe('quiet-generic');
    expect(next.presetId).toBeNull();
    expect(next.footerColor).toBeNull();
  });

  it('keeps the background when Auto is off', () => {
    const current = defaultStyle();
    expect(current.backgroundMode).toBe('manual');
    const next = withTextColor(current, '#14203A');
    expect(next.textColor).toBe('#14203A');
    expect(next.backgroundMode).toBe('manual');
    expect(next.backgroundColor).toBe(current.backgroundColor);
    expect(next.presetId).toBeNull();
  });

  it('picks a complementary background when Auto is on', () => {
    const current = withAutoBackground(defaultStyle());
    const next = withTextColor(current, '#14203A');
    expect(next.textColor).toBe('#14203A');
    expect(next.backgroundMode).toBe('auto');
    expect(next.backgroundColor).toBe(complementaryBackground('#14203A'));
    expect(contrastRatio(next.textColor, next.backgroundColor)).toBeGreaterThan(4.5);
  });

  it('turns Auto off without moving the background, and back on from the current text color', () => {
    const on = withAutoBackground(defaultStyle());
    const off = withManualBackground(on);
    expect(off.backgroundMode).toBe('manual');
    expect(off.backgroundColor).toBe(on.backgroundColor);
    expect(off.textColor).toBe(on.textColor);
    const again = withAutoBackground(off);
    expect(again.backgroundMode).toBe('auto');
    expect(again.backgroundColor).toBe(complementaryBackground(off.textColor));
  });

  it('turns Auto off when a background is chosen', () => {
    const next = withBackground(withAutoBackground(defaultStyle()), '#F6F1E6');
    expect(next.backgroundMode).toBe('manual');
    expect(next.backgroundColor).toBe('#F6F1E6');
    const text = withTextColor(next, '#111111');
    expect(text.backgroundColor).toBe('#F6F1E6');
    expect(text.backgroundMode).toBe('manual');
    expect(text.textColor).toBe('#111111');
  });

  it('keeps a preset’s colors with Auto off', () => {
    const next = withPreset(withAutoBackground(defaultStyle()), presetById('05'));
    expect(next.presetId).toBe('05');
    expect(next.backgroundMode).toBe('manual');
    expect(next.textColor).toBe('#111111');
    expect(next.backgroundColor).toBe('#E3F03A');
  });

  it('remembers a measurement toggle without dropping the others', () => {
    const next = withMeasurement(defaultStyle(), 'sun', true);
    expect(next.measurements.sun).toBe(true);
    expect(next.measurements.temperature).toBe(false);
    expect(withMeasurement(next, 'telemetry', true).measurements.telemetry).toBe(true);
    expect(withMeasurement(next, 'telemetry', true).presetId).toBe(next.presetId);
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
