import type { FormatId } from '../composition/formats';
import type { TelemetrySnapshot } from '../data/telemetry';
import type { Style } from '../style/types';

export interface ShareEntry {
  id: string;
  at: string;
  channel: 'share' | 'sms' | 'email';
  recipient?: string;
  address?: string;
}

export interface TransientRecord {
  id: string;
  capturedAt: string;
  savedAt: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  placeFull: string | null;
  placeCity: string | null;
  timezone: string;
  message: string;
  temperatureC: number | null;
  sunAzimuth: number | null;
  sunAltitude: number | null;
  lines: { id: string; text: string }[];
  /** Sensor and GPS extras captured with the image. Absent on older records. */
  telemetry?: TelemetrySnapshot | null;
  style: Style;
  width: number;
  height: number;
  format: FormatId;
  png: Blob;
  shares: ShareEntry[];
  locationSource: 'device' | 'example';
}
