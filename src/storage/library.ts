import { openDB, type IDBPDatabase } from 'idb';

export type { ShareEntry, TransientRecord } from './shape';
import type { TransientRecord } from './shape';

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
  const all = (await (await db()).getAll(TRANSIENT_STORE)) as StoredRecord[];
  return all
    .map((record) => ({ ...record, png: pngBlob(record.png) }))
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
}

export async function saveTransient(record: TransientRecord): Promise<void> {
  if (!hasIdb()) {
    memory.unshift(record);
    return;
  }
  // The PNG is stored as bytes. Reads turn them back into a Blob, and older Blob records still load.
  await (await db()).put(TRANSIENT_STORE, { ...record, png: await record.png.arrayBuffer() });
}

type StoredPng = Blob | ArrayBuffer | Uint8Array;
type StoredRecord = Omit<TransientRecord, 'png'> & { png: StoredPng };

function pngBlob(value: StoredPng): Blob {
  if (value instanceof Blob) return value;
  const source = value instanceof Uint8Array ? value : new Uint8Array(value);
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return new Blob([bytes], { type: 'image/png' });
}

export async function deleteTransient(id: string): Promise<void> {
  if (!hasIdb()) {
    const index = memory.findIndex((item) => item.id === id);
    if (index >= 0) memory.splice(index, 1);
    return;
  }
  await (await db()).delete(TRANSIENT_STORE, id);
}
