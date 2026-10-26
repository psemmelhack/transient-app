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
