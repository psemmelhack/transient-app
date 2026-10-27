import { describe, expect, it } from 'vitest';
import { boxOutside, boxesIntersect, layoutSpreadTelemetry, TELEMETRY_FONT_FLOOR } from './telemetryFit';

describe('extended telemetry layout', () => {
  it('adds columns before it steps the type down', () => {
    const easy = layoutSpreadTelemetry(10, 16, 1.45, 400);
    expect(easy).toEqual({ columns: 2, fontSize: 16 });
    const taller = layoutSpreadTelemetry(21, 16, 1.45, 200);
    expect(taller.columns).toBeGreaterThan(2);
    expect(taller.fontSize).toBe(16);
    const tight = layoutSpreadTelemetry(21, 16, 1.45, 70);
    expect(tight.columns).toBe(4);
    expect(tight.fontSize).toBeGreaterThanOrEqual(TELEMETRY_FONT_FLOOR);
    expect(tight.fontSize).toBeLessThan(16);
  });

  it('treats an overlap and a spill as a clash', () => {
    const card = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(boxOutside({ left: 10, top: 10, right: 40, bottom: 40 }, card)).toBe(false);
    expect(boxOutside({ left: 10, top: 10, right: 120, bottom: 40 }, card)).toBe(true);
    expect(boxesIntersect({ left: 0, top: 0, right: 20, bottom: 20 }, { left: 22, top: 22, right: 30, bottom: 30 })).toBe(false);
    expect(boxesIntersect({ left: 0, top: 0, right: 20, bottom: 20 }, { left: 10, top: 10, right: 30, bottom: 30 })).toBe(true);
  });
});
