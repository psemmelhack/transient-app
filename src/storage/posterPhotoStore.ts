import type { PosterPhoto } from '../composition/posterPhoto';
import { KV_STORE, transientDatabase } from './library';
import { POSTER_PHOTO_KEY, decodePosterPhoto, encodePosterPhoto } from './posterPhotoRecord';

const memory = new Map<string, string>();

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function readRaw(): Promise<string | null> {
  if (!hasIdb()) return memory.get(POSTER_PHOTO_KEY) ?? null;
  try {
    const value = await (await transientDatabase()).get(KV_STORE, POSTER_PHOTO_KEY);
    return typeof value === 'string' ? value : null;
  } catch {
    return memory.get(POSTER_PHOTO_KEY) ?? null;
  }
}

async function writeRaw(value: string): Promise<void> {
  memory.set(POSTER_PHOTO_KEY, value);
  if (!hasIdb()) return;
  await (await transientDatabase()).put(KV_STORE, value, POSTER_PHOTO_KEY);
}

async function deleteRaw(): Promise<void> {
  memory.delete(POSTER_PHOTO_KEY);
  if (!hasIdb()) return;
  await (await transientDatabase()).delete(KV_STORE, POSTER_PHOTO_KEY);
}

/** The working background. Absent after Clear, including on the next launch. */
export async function loadPosterPhoto(): Promise<PosterPhoto | null> {
  return decodePosterPhoto(await readRaw());
}

export async function savePosterPhoto(photo: PosterPhoto): Promise<void> {
  const encoded = encodePosterPhoto(photo);
  if (!encoded) return;
  await writeRaw(encoded);
}

export async function clearPosterPhoto(): Promise<void> {
  await deleteRaw();
}
