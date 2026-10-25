import { describe, expect, it } from 'vitest';
import { heroScaleToClear, scaleClearanceBox } from './heroClearance';

describe('hero clearance', () => {
  it('leaves a hero that already sits above the metadata', () => {
    expect(heroScaleToClear(64, 700, 900, 36)).toBe(1);
  });

  it('shrinks the hero so its bottom clears the metadata by the gap', () => {
    const scale = heroScaleToClear(64, 980, 860, 36);
    const available = 860 - 36 - 64;
    expect(scale).toBeCloseTo(available / 980, 5);
    expect(64 + 980 * scale + 36).toBeCloseTo(860, 4);
  });

  it('ignores a footer that has not been laid out', () => {
    expect(heroScaleToClear(64, 900, 0, 36)).toBe(1);
  });

  it('rejects a non-finite measurement', () => {
    expect(heroScaleToClear(64, Number.NaN, 800)).toBe(1);
    expect(heroScaleToClear(64, 0, 800)).toBe(1);
  });

  it('scales the line box with the type', () => {
    const scaled = scaleClearanceBox({ fontSize: 100, height: 92, shiftTop: -4, shiftLeft: 2 }, 0.5);
    expect(scaled).toEqual({ fontSize: 50, height: 46, shiftTop: -2, shiftLeft: 1 });
    expect(scaleClearanceBox(scaled, 1)).toBe(scaled);
  });
});
