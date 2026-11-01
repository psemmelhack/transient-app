import { describe, expect, it } from 'vitest';
import { PHOTO_CHUNK, photoChunks } from './photoBridge';
import { parseWebMessage } from './protocol';

describe('photo bridge', () => {
  it('splits a photo into the same pieces the shell injects', () => {
    const payload = 'abc'.repeat(PHOTO_CHUNK);
    const parts = photoChunks(payload);
    expect(parts.length).toBe(3);
    expect(parts.every((part) => part.length <= PHOTO_CHUNK)).toBe(true);
    expect(parts.join('')).toBe(payload);
    expect(photoChunks('')).toEqual([]);
  });

  it('reads a pick-photo request and rejects a blank id', () => {
    expect(parseWebMessage({ source: 'transient-web', type: 'pick-photo', id: 'shot-1' })).toEqual({
      source: 'transient-web',
      type: 'pick-photo',
      id: 'shot-1',
    });
    expect(parseWebMessage({ source: 'transient-web', type: 'pick-photo', id: '' })).toBeNull();
    expect(parseWebMessage({ source: 'other', type: 'pick-photo', id: 'shot-1' })).toBeNull();
  });
});
