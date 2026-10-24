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
  place: PlaceInfo | null;
  timezone: string;
  source: 'device' | 'example';
  temperatureC: number | null;
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
    place: EXAMPLE_PLACE,
    timezone: EXAMPLE_TIME_ZONE,
    source: 'example',
    temperatureC: null,
  };
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
