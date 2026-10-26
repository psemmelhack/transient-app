export const WEB_SOURCE = 'transient-web' as const;

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
  | { source: typeof WEB_SOURCE; type: 'capture'; id: string; filename: string; pngBase64: string };

/** Outbound command. A separate union so each member keeps its own fields. */
export type WebCommand =
  | { type: 'ready' }
  | { type: 'retry-location' }
  | { type: 'telemetry'; enabled: boolean }
  | { type: 'capture'; id: string; filename: string; pngBase64: string };

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
  return null;
}
