import type { Scene } from '../composition/scene';
import { measurementLines } from '../data/plugins';
import type { Moment } from '../data/moment';
import { sunPosition } from '../data/solar';
import type { Style } from '../style/types';
import type { ShareEntry, TransientRecord } from './library';

export function makeRecord(input: {
  moment: Moment;
  style: Style;
  message: string;
  scene: Scene;
  png: Blob;
  shares: ShareEntry[];
}): TransientRecord {
  const sun = sunPosition(input.moment.at, input.moment.latitude, input.moment.longitude);
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
    lines: measurementLines(input.style.measurements, input.style.temperatureUnit, input.moment),
    style: input.style,
    width: input.scene.width,
    height: input.scene.height,
    format: input.style.format,
    png: input.png,
    shares: input.shares,
    locationSource: input.moment.source,
  };
}
