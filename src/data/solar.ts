import { getPosition } from 'suncalc';

export interface SunPosition {
  /** Degrees clockwise from true north. */
  azimuth: number;
  /** Degrees above the horizon. Negative means the sun is below it. */
  altitude: number;
}

/**
 * Solar azimuth and altitude for a moment.
 * SunCalc's azimuth is measured from south toward the west; this converts
 * it to the navigation convention (0° north, clockwise).
 */
export function sunPosition(date: Date, latitude: number, longitude: number): SunPosition {
  const pos = getPosition(date, latitude, longitude);
  let azimuth = (pos.azimuth * 180) / Math.PI + 180;
  azimuth = ((azimuth % 360) + 360) % 360;
  return {
    azimuth,
    altitude: (pos.altitude * 180) / Math.PI,
  };
}
