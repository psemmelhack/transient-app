import { describe, expect, it } from 'vitest';
import { savePngToPhotos } from './photoLibrary';
import { saveBytesToPhotoLibrary, type PhotoLibraryClient } from './photoLibraryCore';

const filename = '38.261602_-122.048768_20261024T041839Z.png';

function client(overrides: Partial<PhotoLibraryClient> = {}): PhotoLibraryClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    requestAddPermission: async () => {
      calls.push('permission');
      return 'granted';
    },
    writePng: async (name, bytes) => {
      calls.push(`write:${name}:${bytes.byteLength}`);
      return `file:///cache/${name}`;
    },
    createAsset: async (uri) => {
      calls.push(`asset:${uri}`);
    },
    ...overrides,
  };
}

describe('photo library save', () => {
  it('asks to add photos, then writes the PNG under the current filename', async () => {
    const library = client();
    const result = await saveBytesToPhotoLibrary(library, filename, new Uint8Array([1, 2, 3]));
    expect(result).toBe('saved');
    expect(library.calls).toEqual([
      'permission',
      `write:${filename}:3`,
      `asset:file:///cache/${filename}`,
    ]);
  });

  it('does not write a file when photo access is denied', async () => {
    const library = client({
      requestAddPermission: async () => 'denied',
    });
    const result = await saveBytesToPhotoLibrary(library, filename, new Uint8Array([1]));
    expect(result).toBe('denied');
    expect(library.calls).toEqual([]);
  });

  it('leaves Photos to the share sheet in the browser', async () => {
    expect(await savePngToPhotos(filename, new Uint8Array([1]))).toBe('unavailable');
  });
});