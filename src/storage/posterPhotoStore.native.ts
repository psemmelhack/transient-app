import type { PosterPhoto } from '../composition/posterPhoto';
import { nativeDb } from './nativeDb';
import { POSTER_PHOTO_KEY, decodePosterPhoto, encodePosterPhoto } from './posterPhotoRecord';

function readRaw(): string | null {
  const row = nativeDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', POSTER_PHOTO_KEY);
  return row?.value ?? null;
}

/** The working background in sqlite, so a phone reload cannot resurrect a cleared photo. */
export async function loadPosterPhoto(): Promise<PosterPhoto | null> {
  try {
    return decodePosterPhoto(readRaw());
  } catch {
    return null;
  }
}

export async function savePosterPhoto(photo: PosterPhoto): Promise<void> {
  const encoded = encodePosterPhoto(photo);
  if (!encoded) return;
  nativeDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', POSTER_PHOTO_KEY, encoded);
}

export async function clearPosterPhoto(): Promise<void> {
  nativeDb().runSync('DELETE FROM kv WHERE key = ?', POSTER_PHOTO_KEY);
}
