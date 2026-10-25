import type { Scene } from '../composition/scene';
import { isTelemetryEnabled, measurementLines } from '../data/plugins';
import type { Moment } from '../data/moment';
import { omitSupersededAccuracy, telemetryLineText, telemetryLines, telemetrySnapshot } from '../data/telemetry';
import { sunPosition } from '../data/solar';
import type { Style } from '../style/types';
import type { ShareEntry, TransientRecord } from './library';

/** A blank name is a capture with no recipient. A name is one share on the map. */
export function sharesForCapture(name: string, at = new Date()): ShareEntry[] {
  const recipient = name.trim();
  if (!recipient) return [];
  return [{ id: crypto.randomUUID(), at: at.toISOString(), channel: 'share', recipient }];
}

export function makeRecord(input: {
  moment: Moment;
  style: Style;
  message: string;
  scene: Scene;
  png: Blob;
  shares: ShareEntry[];
}): TransientRecord {
  const sun = sunPosition(input.moment.at, input.moment.latitude, input.moment.longitude);
  const telemetryOn = isTelemetryEnabled(input.style.measurements);
  const telemetry = telemetryOn ? telemetryLines(input.moment) : [];
  const lines = [
    ...omitSupersededAccuracy(measurementLines(input.style.measurements, input.style.temperatureUnit, input.moment), telemetry),
    ...telemetry.map((line) => ({ id: line.id, text: telemetryLineText(line) })),
  ];
  return {
    id: crypto.randomUUID(),
    capturedAt: input.moment.at.toISOString(),
    savedAt: new Date().toISOString(),
    latitude: input.moment.latitude,
    longitude: input.moment.longitude,
    altitude: input.moment.altitude,
    accuracy: input.moment.accuracy,
    placeFull: input.moment.place?.full ?? null,
    placeCity: input.moment.place?.city ?? null,
    timezone: input.moment.timezone,
    message: input.message.trim(),
    temperatureC: input.moment.temperatureC,
    sunAzimuth: sun.azimuth,
    sunAltitude: sun.altitude,
    lines,
    telemetry: telemetrySnapshot(telemetryOn, input.moment),
    style: input.style,
    width: input.scene.width,
    height: input.scene.height,
    format: input.style.format,
    png: input.png,
    shares: input.shares,
    locationSource: input.moment.source,
  };
}
