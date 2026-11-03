import { storedPhoto, type PosterPhoto } from '../composition/posterPhoto';

/** Key shared by the web IndexedDB `kv` store and the phone sqlite `kv` table. */
export const POSTER_PHOTO_KEY = 'transient.poster-photo.v1';

export function encodePosterPhoto(photo: PosterPhoto): string | null {
  const kept = storedPhoto(photo);
  if (!kept) return null;
  return JSON.stringify(kept);
}

export function decodePosterPhoto(raw: string | null | undefined): PosterPhoto | null {
  if (!raw) return null;
  try {
    return storedPhoto(JSON.parse(raw));
  } catch {
    return null;
  }
}
