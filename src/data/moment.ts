import type { SensorSample } from './telemetry';

export interface PlaceInfo {
  city: string | null;
  region: string | null;
  full: string | null;
}

export interface Moment {
  at: Date;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  /** Geolocation altitude accuracy, meters. Null when the fix omits it. */
  altitudeAccuracy: number | null;
  /** Speed over ground, m/s. Null when the fix omits it. */
  speed: number | null;
  /** Course over ground, degrees clockwise from north. Null when the fix omits it. */
  course: number | null;
  place: PlaceInfo | null;
  timezone: string;
  source: 'device' | 'example';
  temperatureC: number | null;
  /** Live sensor sample. Null until Telemetry is on and a reading arrives. */
  sensors: SensorSample | null;
}

export const EXAMPLE_PLACE: PlaceInfo = {
  city: 'Redondo Beach',
  region: 'California',
  full: 'Redondo Beach, California',
};

/** 22 Oct 2026, 6:12:07 PM PDT. */
export const EXAMPLE_INSTANT = new Date('2026-10-23T01:12:07Z');

export const EXAMPLE_TIME_ZONE = 'America/Los_Angeles';

export function exampleMoment(at: Date = new Date()): Moment {
  return {
    at,
    latitude: 33.834452,
    longitude: -118.383318,
    altitude: 18,
    accuracy: null,
    altitudeAccuracy: null,
    speed: null,
    course: null,
    place: EXAMPLE_PLACE,
    timezone: EXAMPLE_TIME_ZONE,
    source: 'example',
    temperatureC: null,
    sensors: null,
  };
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
