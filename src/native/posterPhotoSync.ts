import type { PosterPhoto } from '../composition/posterPhoto';
import { photoChunks } from './photoBridge';
import { postToNative, isNativeShell } from './shell';

/**
 * Mirror the working photo into the phone's sqlite database.
 * The page itself stores it in IndexedDB. A browser has no shell, so this is a no-op there.
 */
export function syncPosterPhoto(photo: PosterPhoto | null): void {
  if (!isNativeShell()) return;
  if (!photo) {
    postToNative({ type: 'poster-photo-clear' });
    return;
  }
  const parts = photoChunks(photo.jpeg);
  if (!parts.length) {
    postToNative({ type: 'poster-photo-clear' });
    return;
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  postToNative({ type: 'poster-photo-begin', id, count: parts.length, luminance: photo.luminance });
  parts.forEach((data, index) => postToNative({ type: 'poster-photo-chunk', id, index, data }));
  postToNative({ type: 'poster-photo-end', id });
}
