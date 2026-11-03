import { describe, expect, it } from 'vitest';
import { clearPosterPhoto, loadPosterPhoto, savePosterPhoto } from './posterPhotoStore';
import { decodePosterPhoto, encodePosterPhoto, POSTER_PHOTO_KEY } from './posterPhotoRecord';

const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEA';

describe('poster photo store', () => {
  it('keeps a jpeg and drops anything else', () => {
    expect(encodePosterPhoto({ jpeg, luminance: 0.4 })).toContain(jpeg);
    expect(POSTER_PHOTO_KEY).toBe('transient.poster-photo.v1');
    expect(decodePosterPhoto(encodePosterPhoto({ jpeg, luminance: 0.4 }))).toEqual({ jpeg, luminance: 0.4 });
    expect(decodePosterPhoto('{"jpeg":"data:image/png;base64,aaaa","luminance":0.2}')).toBeNull();
    expect(decodePosterPhoto('not-json')).toBeNull();
    expect(decodePosterPhoto(null)).toBeNull();
  });

  it('saves the working photo and forgets it on clear', async () => {
    await clearPosterPhoto();
    expect(await loadPosterPhoto()).toBeNull();
    await savePosterPhoto({ jpeg, luminance: 0.25 });
    expect(await loadPosterPhoto()).toEqual({ jpeg, luminance: 0.25 });
    await clearPosterPhoto();
    expect(await loadPosterPhoto()).toBeNull();
  });

  it('does not store a photo that is not a jpeg', async () => {
    await clearPosterPhoto();
    await savePosterPhoto({ jpeg: 'data:image/png;base64,aaaa', luminance: 0.2 });
    expect(await loadPosterPhoto()).toBeNull();
  });
});
