import { onNativeEvent, postToNative } from './shell';

export const NATIVE_PHOTO_EVENT = 'transient-native-photo';

/** Same size the PNG handoff uses. WKWebView drops a larger injected script. */
export const PHOTO_CHUNK = 48_000;

export type NativePhotoStatus = 'ready' | 'cancelled' | 'denied' | 'failed';

export interface NativePhotoDetail {
  id: string;
  status: NativePhotoStatus;
  count?: number;
}

interface PhotoBag {
  id: string;
  parts: string[];
}

type PhotoWindow = Window & { __transientPhoto?: PhotoBag };

export function photoChunks(base64: string, size = PHOTO_CHUNK): string[] {
  if (!base64) return [];
  const parts: string[] = [];
  for (let index = 0; index < base64.length; index += size) parts.push(base64.slice(index, index + size));
  return parts;
}

export type NativePhotoResult = { status: 'ready'; base64: string } | { status: Exclude<NativePhotoStatus, 'ready'> };

/** Ask the Expo shell to open the camera or the library. The bytes come back in pieces. */
export function requestNativePhoto(): Promise<NativePhotoResult> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    let stop = () => {};
    const timer = window.setTimeout(() => {
      stop();
      resolve({ status: 'failed' });
    }, 120_000);
    stop = onNativeEvent<NativePhotoDetail>(NATIVE_PHOTO_EVENT, (detail) => {
      if (!detail || detail.id !== id) return;
      window.clearTimeout(timer);
      stop();
      if (detail.status !== 'ready') {
        resolve({ status: detail.status === 'cancelled' || detail.status === 'denied' ? detail.status : 'failed' });
        return;
      }
      const bag = (window as PhotoWindow).__transientPhoto;
      const count = detail.count ?? 0;
      if (!bag || bag.id !== id || count < 1 || bag.parts.length < count || bag.parts.slice(0, count).some((part) => typeof part !== 'string')) {
        resolve({ status: 'failed' });
        return;
      }
      resolve({ status: 'ready', base64: bag.parts.slice(0, count).join('') });
    });
    postToNative({ type: 'pick-photo', id });
  });
}
