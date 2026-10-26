import { describe, expect, it } from 'vitest';
import { insertPngText, metadataFor, readPngText } from './pngMeta';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('png text metadata', () => {
  it('round-trips latitude, time, and the note', () => {
    const binary = atob(PNG_BASE64);
    const png = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const fields = metadataFor({
      latitude: 33.834452,
      longitude: -118.383318,
      altitude: 18,
      accuracy: null,
      utc: '2026-10-23 01:12:07 UTC',
      timezone: 'America/Los_Angeles',
      message: 'We were here.',
      place: 'Redondo Beach, California',
      temperatureC: 19.1,
      sunAzimuth: 257,
      sunAltitude: -0.86,
    });
    const next = insertPngText(png, fields);
    const read = readPngText(next);
    expect(read['transient:latitude']).toBe('33.834452');
    expect(read['transient:longitude']).toBe('-118.383318');
    expect(read['transient:utc']).toBe('2026-10-23 01:12:07 UTC');
    expect(read['transient:message']).toBe('We were here.');
    expect(read.Software).toBe('Transient');
    expect(read['transient:telemetry']).toBeUndefined();
    const withTelemetry = metadataFor({
      latitude: 33.834452,
      longitude: -118.383318,
      altitude: 18,
      accuracy: null,
      utc: '2026-10-23 01:12:07 UTC',
      timezone: 'America/Los_Angeles',
      message: '',
      place: null,
      temperatureC: null,
      sunAzimuth: null,
      sunAltitude: null,
      telemetry: ['BARO  1013.3 hPa', 'HDG  274° W', 'MAG  1  2  3'],
    });
    expect(readPngText(insertPngText(png, withTelemetry))['transient:telemetry']).toBe('BARO  1013.3 hPa\nHDG  274° W\nMAG  1  2  3');
    expect(next[0]).toBe(0x89);
    expect(String.fromCharCode(...next.subarray(next.length - 8, next.length - 4))).toBe('IEND');
  });
});
