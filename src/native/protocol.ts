export const WEB_SOURCE = 'transient-web' as const;

/** The shell posts the running Expo update and the embedded pack on this event. */
export const NATIVE_BUILD_EVENT = 'transient-native-build';

export interface ShellPlace {
  city: string | null;
  region: string | null;
  full: string | null;
}

export interface ShellLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  course: number | null;
  place: ShellPlace | null;
}

export type ShellLocationDetail = { status: 'ready'; location: ShellLocation } | { status: 'unavailable' };

export type CaptureHandoff = 'shared' | 'cancelled' | 'failed';

export type WebToNative =
  | { source: typeof WEB_SOURCE; type: 'ready' }
  | { source: typeof WEB_SOURCE; type: 'retry-location' }
  | { source: typeof WEB_SOURCE; type: 'telemetry'; enabled: boolean }
  | { source: typeof WEB_SOURCE; type: 'capture'; id: string; filename: string; pngBase64: string }
  | { source: typeof WEB_SOURCE; type: 'capture-begin'; id: string; filename: string; count: number }
  | { source: typeof WEB_SOURCE; type: 'capture-chunk'; id: string; index: number; data: string }
  | { source: typeof WEB_SOURCE; type: 'capture-end'; id: string }
  | { source: typeof WEB_SOURCE; type: 'pick-photo'; id: string }
  | { source: typeof WEB_SOURCE; type: 'read-font'; id: string; path: string }
  | { source: typeof WEB_SOURCE; type: 'poster-photo-clear' }
  | { source: typeof WEB_SOURCE; type: 'poster-photo-begin'; id: string; count: number; luminance: number }
  | { source: typeof WEB_SOURCE; type: 'poster-photo-chunk'; id: string; index: number; data: string }
  | { source: typeof WEB_SOURCE; type: 'poster-photo-end'; id: string };

/** Outbound command. A separate union so each member keeps its own fields. */
export type WebCommand =
  | { type: 'ready' }
  | { type: 'retry-location' }
  | { type: 'telemetry'; enabled: boolean }
  | { type: 'capture'; id: string; filename: string; pngBase64: string }
  | { type: 'capture-begin'; id: string; filename: string; count: number }
  | { type: 'capture-chunk'; id: string; index: number; data: string }
  | { type: 'capture-end'; id: string }
  | { type: 'pick-photo'; id: string }
  | { type: 'read-font'; id: string; path: string }
  | { type: 'poster-photo-clear' }
  | { type: 'poster-photo-begin'; id: string; count: number; luminance: number }
  | { type: 'poster-photo-chunk'; id: string; index: number; data: string }
  | { type: 'poster-photo-end'; id: string };

/** Pieces of one PNG, posted separately so a large message is not dropped. */
export interface PendingCapture {
  id: string;
  filename: string;
  count: number;
  parts: Array<string | undefined>;
}

const MAX_CAPTURE_CHUNKS = 4096;
const MAX_POSTER_PHOTO_CHUNKS = 64;

function messageId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length < 80;
}

export function startCapture(id: string, filename: string, count: number): PendingCapture | null {
  if (!id || !filename || !Number.isInteger(count) || count < 1 || count > MAX_CAPTURE_CHUNKS) return null;
  return { id, filename, count, parts: Array.from({ length: count }, () => undefined) };
}

export function pushCaptureChunk(pending: PendingCapture, index: number, data: string): PendingCapture {
  if (!Number.isInteger(index) || index < 0 || index >= pending.count || typeof data !== 'string') return pending;
  const parts = pending.parts.slice();
  parts[index] = data;
  return { ...pending, parts };
}

export function joinedCapture(pending: PendingCapture): string | null {
  if (pending.parts.some((part) => typeof part !== 'string')) return null;
  return pending.parts.join('');
}

/** Pieces of the working poster JPEG, posted separately so WKWebView delivers each one. */
export interface PendingPosterPhoto {
  id: string;
  count: number;
  luminance: number;
  parts: Array<string | undefined>;
}

export function startPosterPhoto(id: string, count: number, luminance: number): PendingPosterPhoto | null {
  if (!id || !Number.isInteger(count) || count < 1 || count > MAX_POSTER_PHOTO_CHUNKS || !Number.isFinite(luminance)) return null;
  return { id, count, luminance, parts: Array.from({ length: count }, () => undefined) };
}

export function pushPosterPhotoChunk(pending: PendingPosterPhoto, index: number, data: string): PendingPosterPhoto {
  if (!Number.isInteger(index) || index < 0 || index >= pending.count || typeof data !== 'string') return pending;
  const parts = pending.parts.slice();
  parts[index] = data;
  return { ...pending, parts };
}

export function joinedPosterPhoto(pending: PendingPosterPhoto): { jpeg: string; luminance: number } | null {
  if (pending.parts.some((part) => typeof part !== 'string')) return null;
  return { jpeg: pending.parts.join(''), luminance: pending.luminance };
}

export function parseWebMessage(raw: unknown): WebToNative | null {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  if (message.source !== WEB_SOURCE) return null;
  if (message.type === 'ready' || message.type === 'retry-location') {
    return { source: WEB_SOURCE, type: message.type };
  }
  if (message.type === 'telemetry' && typeof message.enabled === 'boolean') {
    return { source: WEB_SOURCE, type: 'telemetry', enabled: message.enabled };
  }
  if (
    message.type === 'capture' &&
    typeof message.id === 'string' &&
    typeof message.filename === 'string' &&
    typeof message.pngBase64 === 'string'
  ) {
    return {
      source: WEB_SOURCE,
      type: 'capture',
      id: message.id,
      filename: message.filename,
      pngBase64: message.pngBase64,
    };
  }
  if (
    message.type === 'capture-begin' &&
    typeof message.id === 'string' &&
    typeof message.filename === 'string' &&
    typeof message.count === 'number' &&
    Number.isInteger(message.count) &&
    message.count >= 1 &&
    message.count <= MAX_CAPTURE_CHUNKS
  ) {
    return {
      source: WEB_SOURCE,
      type: 'capture-begin',
      id: message.id,
      filename: message.filename,
      count: message.count,
    };
  }
  if (
    message.type === 'capture-chunk' &&
    typeof message.id === 'string' &&
    typeof message.index === 'number' &&
    Number.isInteger(message.index) &&
    message.index >= 0 &&
    typeof message.data === 'string'
  ) {
    return {
      source: WEB_SOURCE,
      type: 'capture-chunk',
      id: message.id,
      index: message.index,
      data: message.data,
    };
  }
  if (message.type === 'capture-end' && typeof message.id === 'string') {
    return { source: WEB_SOURCE, type: 'capture-end', id: message.id };
  }
  if (message.type === 'pick-photo' && messageId(message.id)) {
    return { source: WEB_SOURCE, type: 'pick-photo', id: message.id };
  }
  if (message.type === 'poster-photo-clear') {
    return { source: WEB_SOURCE, type: 'poster-photo-clear' };
  }
  if (
    message.type === 'poster-photo-begin' &&
    messageId(message.id) &&
    typeof message.count === 'number' &&
    Number.isInteger(message.count) &&
    message.count >= 1 &&
    message.count <= MAX_POSTER_PHOTO_CHUNKS &&
    typeof message.luminance === 'number' &&
    Number.isFinite(message.luminance)
  ) {
    return {
      source: WEB_SOURCE,
      type: 'poster-photo-begin',
      id: message.id,
      count: message.count,
      luminance: message.luminance,
    };
  }
  if (
    message.type === 'poster-photo-chunk' &&
    messageId(message.id) &&
    typeof message.index === 'number' &&
    Number.isInteger(message.index) &&
    message.index >= 0 &&
    message.index < MAX_POSTER_PHOTO_CHUNKS &&
    typeof message.data === 'string'
  ) {
    return {
      source: WEB_SOURCE,
      type: 'poster-photo-chunk',
      id: message.id,
      index: message.index,
      data: message.data,
    };
  }
  if (message.type === 'poster-photo-end' && messageId(message.id)) {
    return { source: WEB_SOURCE, type: 'poster-photo-end', id: message.id };
  }
  if (
    message.type === 'read-font' &&
    typeof message.id === 'string' &&
    message.id.length > 0 &&
    message.id.length < 80 &&
    typeof message.path === 'string' &&
    /^fonts\/[A-Za-z0-9._-]+\.(?:ttf|otf|woff2?)$/i.test(message.path)
  ) {
    return { source: WEB_SOURCE, type: 'read-font', id: message.id, path: message.path };
  }
  return null;
}
