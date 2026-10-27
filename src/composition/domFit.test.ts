import { describe, expect, it } from 'vitest';
import { lineCanTrim, sizeFromDomLayout } from './domFit';

describe('sizeFromDomLayout', () => {
  it('fits the DOM advance to the target width', () => {
    const sized = sizeFromDomLayout({ probeSize: 200, advance: 858, lineBox: 200, trimmed: 160, trim: true }, 952);
    expect(sized.fontSize).toBeCloseTo((200 * 952) / 858, 5);
    expect(sized.source).toBe('dom-trim');
    expect(sized.height).toBeCloseTo(160 * (sized.fontSize / 200), 5);
  });

  it('keeps the full line box when cap trim did not shrink it', () => {
    const sized = sizeFromDomLayout({ probeSize: 200, advance: 400, lineBox: 200, trimmed: 200, trim: true }, 800);
    expect(sized.source).toBe('dom-line');
    expect(sized.height).toBeCloseTo(sized.fontSize, 5);
  });

  it('refuses a collapsed trim and uses the line box', () => {
    const sized = sizeFromDomLayout({ probeSize: 200, advance: 858, lineBox: 200, trimmed: 40, trim: true }, 900);
    expect(sized.source).toBe('dom-line');
    expect(sized.height).toBeGreaterThan(sized.fontSize * 0.9);
  });

  it('uses the line box for a face that cannot be trimmed', () => {
    const sized = sizeFromDomLayout({ probeSize: 200, advance: 500, lineBox: 210, trimmed: 0, trim: false }, 500);
    expect(sized.source).toBe('dom-line');
    expect(sized.height).toBeCloseTo(sized.fontSize * (210 / 200), 5);
  });
});

describe('lineCanTrim', () => {
  it('trims coordinate and date lines', () => {
    expect(lineCanTrim('33.834452')).toBe(true);
    expect(lineCanTrim('-118.383318')).toBe(true);
    expect(lineCanTrim('\u2212118.383318')).toBe(true);
    expect(lineCanTrim('OCT 27 2026')).toBe(true);
    expect(lineCanTrim('4:12 PM')).toBe(true);
  });

  it('leaves lowercase and descenders on the full line box', () => {
    expect(lineCanTrim('Friday')).toBe(false);
    expect(lineCanTrim('Green Valley')).toBe(false);
    expect(lineCanTrim('')).toBe(false);
  });
});
