import { describe, expect, it } from 'vitest';
import { EXAMPLE_INSTANT } from './moment';
import { sunPosition } from './solar';

describe('sunPosition', () => {
  it('puts the sun near the horizon in Redondo Beach at 6:12 pm', () => {
    const sun = sunPosition(EXAMPLE_INSTANT, 33.834452, -118.383318);
    expect(sun.azimuth).toBeGreaterThan(240);
    expect(sun.azimuth).toBeLessThan(275);
    expect(sun.altitude).toBeGreaterThan(-3);
    expect(sun.altitude).toBeLessThan(2);
  });

  it('puts midday sun high and to the south', () => {
    const noon = sunPosition(new Date('2026-10-22T19:45:00Z'), 33.834452, -118.383318);
    expect(noon.azimuth).toBeGreaterThan(160);
    expect(noon.azimuth).toBeLessThan(200);
    expect(noon.altitude).toBeGreaterThan(40);
  });
});
