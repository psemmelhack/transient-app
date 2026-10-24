import * as FileSystem from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { saveBytesToPhotoLibrary, type PhotoLibraryClient } from './photoLibraryCore';

type CacheFile = {
  create(options?: { overwrite?: boolean }): void;
  write(content: Uint8Array): Promise<void>;
  uri: string;
};

/** The app tsconfig resolves the web filesystem stub. Native builds have create, write, and uri. */
function cacheFile(filename: string): CacheFile {
  const FileCtor = FileSystem.File as unknown as new (directory: unknown, name: string) => CacheFile;
  return new FileCtor(FileSystem.Paths.cache, filename);
}

const photos: PhotoLibraryClient = {
  async requestAddPermission() {
    const response = await requestPermissionsAsync(true, ['photo']);
    return response.granted ? 'granted' : 'denied';
  },
  async writePng(filename, bytes) {
    const file = cacheFile(filename);
    file.create({ overwrite: true });
    await file.write(bytes);
    return file.uri;
  },
  async createAsset(uri) {
    await Asset.create(uri);
  },
};

/** One tap on a native build: permission, then the PNG goes straight into Photos. */
export function savePngToPhotos(filename: string, bytes: Uint8Array): Promise<'saved' | 'denied' | 'unavailable'> {
  return saveBytesToPhotoLibrary(photos, filename, bytes);
}
