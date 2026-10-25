import { sanitizeStyle, hasSavedStyle, saveStyle, STYLE_KEY } from '../style/persist';
import { importedLabel } from '../ui/actions';
import { deleteTransient, listTransients, saveTransient, TRANSIENT_DB, TRANSIENT_STORE, type ShareEntry, type TransientRecord } from './library';

/**
 * Old captures live on https://psemmelhack.github.io (IndexedDB `transient` /
 * store `transients`, localStorage `transient.style.v1`). Pictures make a URL
 * fragment too large, so the migrate page sends them with postMessage.
 * A small library can still arrive as `#import=<base64url JSON>`.
 */
export const MIGRATE_ORIGIN = 'https://psemmelhack.github.io';
export { STYLE_KEY, TRANSIENT_DB, TRANSIENT_STORE };

export interface ImportPayload {
  version?: number;
  style?: unknown;
  transients?: unknown[];
}

const listeners = new Set<(text: string) => void>();
let notice: string | null = null;
let stashed: ImportPayload | null = null;
let stashedReady = false;

export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeImportFragment(payload: ImportPayload): string {
  return `#import=${encodeBase64Url(JSON.stringify(payload))}`;
}

export function parseImportFragment(hash: string): ImportPayload | null {
  const prefix = '#import=';
  if (!hash.startsWith(prefix)) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(hash.slice(prefix.length))) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as ImportPayload;
  } catch {
    return null;
  }
}

/** Read the fragment once, adopt a missing style, and drop it from the address bar. */
export function stashLocationImport(): void {
  if (stashedReady || typeof window === 'undefined') return;
  stashedReady = true;
  const payload = parseImportFragment(window.location.hash);
  if (!payload) return;
  stashed = payload;
  adoptStyle(payload);
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

export function consumeStashedImport(): ImportPayload | null {
  const payload = stashed;
  stashed = null;
  return payload;
}

export function publishImportNotice(count: number): void {
  notice = importedLabel(count);
  listeners.forEach((listener) => listener(notice!));
}

export function watchImportNotice(listener: (text: string) => void): () => void {
  listeners.add(listener);
  if (notice) listener(notice);
  return () => listeners.delete(listener);
}

export function adoptStyle(payload: ImportPayload): boolean {
  if (payload.style == null || hasSavedStyle()) return false;
  const style = sanitizeStyle(payload.style);
  saveStyle(style);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('transient-style-adopted', { detail: style }));
  }
  return true;
}

export async function importTransients(payload: ImportPayload): Promise<number> {
  adoptStyle(payload);
  const existing = await listTransients();
  const ids = new Set(existing.map((record) => record.id));
  const places = new Set(existing.map((record) => placeKey(record.capturedAt, record.latitude, record.longitude)));
  let count = 0;
  for (const raw of payload.transients ?? []) {
    const normalized = await normalizeRecord(raw);
    if (!normalized) continue;
    const { record, hadId } = normalized;
    if (hadId && ids.has(record.id)) continue;
    const place = placeKey(record.capturedAt, record.latitude, record.longitude);
    if (!hadId && places.has(place)) continue;
    await saveTransient(record);
    ids.add(record.id);
    places.add(place);
    count += 1;
  }
  return count;
}

/** Test helper. Production never needs to empty the library. */
export async function clearImportedForTests(): Promise<void> {
  const all = await listTransients();
  for (const record of all) await deleteTransient(record.id);
  notice = null;
  stashed = null;
  stashedReady = false;
}

function placeKey(capturedAt: string, latitude: number, longitude: number): string {
  return `${capturedAt}|${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
}

async function normalizeRecord(raw: unknown): Promise<{ record: TransientRecord; hadId: boolean } | null> {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.capturedAt !== 'string' || Number.isNaN(Date.parse(item.capturedAt))) return null;
  if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') return null;
  if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) return null;
  const hadId = typeof item.id === 'string' && item.id.length > 0;
  const style = sanitizeStyle(item.style);
  return {
    hadId,
    record: {
      id: hadId ? (item.id as string) : crypto.randomUUID(),
      capturedAt: item.capturedAt,
      savedAt: typeof item.savedAt === 'string' ? item.savedAt : item.capturedAt,
      latitude: item.latitude,
      longitude: item.longitude,
      altitude: numberOrNull(item.altitude),
      accuracy: numberOrNull(item.accuracy),
      placeFull: stringOrNull(item.placeFull),
      placeCity: stringOrNull(item.placeCity),
      timezone: typeof item.timezone === 'string' && item.timezone ? item.timezone : 'UTC',
      message: typeof item.message === 'string' ? item.message : '',
      temperatureC: numberOrNull(item.temperatureC),
      sunAzimuth: numberOrNull(item.sunAzimuth),
      sunAltitude: numberOrNull(item.sunAltitude),
      lines: linesOf(item.lines),
      telemetry: item.telemetry && typeof item.telemetry === 'object' ? (item.telemetry as TransientRecord['telemetry']) : null,
      style,
      width: typeof item.width === 'number' ? item.width : 1080,
      height: typeof item.height === 'number' ? item.height : 1080,
      format: style.format,
      png: await pngBlob(item.png),
      shares: sharesOf(item.shares),
      locationSource: item.locationSource === 'example' ? 'example' : 'device',
    },
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function linesOf(value: unknown): { id: string; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((line) => {
    if (!line || typeof line !== 'object') return [];
    const raw = line as { id?: unknown; text?: unknown };
    if (typeof raw.text !== 'string') return [];
    return [{ id: typeof raw.id === 'string' ? raw.id : 'line', text: raw.text }];
  });
}

function sharesOf(value: unknown): ShareEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const raw = entry as Partial<ShareEntry>;
    const channel = raw.channel === 'sms' || raw.channel === 'email' || raw.channel === 'share' ? raw.channel : 'share';
    return [
      {
        id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
        at: typeof raw.at === 'string' ? raw.at : new Date(0).toISOString(),
        channel,
        recipient: typeof raw.recipient === 'string' ? raw.recipient : undefined,
        address: typeof raw.address === 'string' ? raw.address : undefined,
      },
    ];
  });
}

async function pngBlob(value: unknown): Promise<Blob> {
  if (value instanceof Blob) return value;
  if (typeof value !== 'string' || !value) return new Blob([], { type: 'image/png' });
  const data = value.startsWith('data:') ? value.slice(value.indexOf(',') + 1) : value;
  try {
    const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: 'image/png' });
  } catch {
    return new Blob([], { type: 'image/png' });
  }
}
