import { openDB, type IDBPDatabase } from 'idb';
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

/** IndexedDB database and object store. The migrate page reads these names. */
export const TRANSIENT_DB = 'transient';
export const TRANSIENT_STORE = 'transients';

const memory: TransientRecord[] = [];

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(TRANSIENT_DB, 1, {
      upgrade(database) {
        const store = database.createObjectStore(TRANSIENT_STORE, { keyPath: 'id' });
        store.createIndex('by-time', 'capturedAt');
      },
    });
  }
  return dbPromise;
}

export async function listTransients(): Promise<TransientRecord[]> {
  if (!hasIdb()) {
    return [...memory].sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }
  const all = await (await db()).getAll(TRANSIENT_STORE);
  return (all as TransientRecord[]).sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
}

export async function saveTransient(record: TransientRecord): Promise<void> {
  if (!hasIdb()) {
    memory.unshift(record);
    return;
  }
  await (await db()).put(TRANSIENT_STORE, record);
}

export async function deleteTransient(id: string): Promise<void> {
  if (!hasIdb()) {
    const index = memory.findIndex((item) => item.id === id);
    if (index >= 0) memory.splice(index, 1);
    return;
  }
  await (await db()).delete(TRANSIENT_STORE, id);
}
