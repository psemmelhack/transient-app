import { nativeDb } from './nativeDb';
import type { TransientRecord } from './shape';

export type { ShareEntry, TransientRecord } from './shape';

export const TRANSIENT_DB = 'transient';
export const TRANSIENT_STORE = 'transients';

export async function listTransients(): Promise<TransientRecord[]> {
  const rows = nativeDb().getAllSync<{ json: string; png: Uint8Array | ArrayBuffer | number[] }>('SELECT json, png FROM transients ORDER BY capturedAt DESC');
  return rows.map((row) => {
    const stored = JSON.parse(row.json) as Omit<TransientRecord, 'png'>;
    return { ...stored, png: new Blob([bytesForBlob(asBytes(row.png))], { type: 'image/png' }) };
  });
}

export async function saveTransient(record: TransientRecord): Promise<void> {
  const { png, ...rest } = record;
  const bytes = new Uint8Array(await png.arrayBuffer());
  nativeDb().runSync('INSERT OR REPLACE INTO transients (id, capturedAt, json, png) VALUES (?, ?, ?, ?)', record.id, record.capturedAt, JSON.stringify(rest), bytes);
}

export async function deleteTransient(id: string): Promise<void> {
  nativeDb().runSync('DELETE FROM transients WHERE id = ?', id);
}

function bytesForBlob(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function asBytes(value: Uint8Array | ArrayBuffer | number[]): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return Uint8Array.from(value);
}
