export interface PhotoLibraryClient {
  requestAddPermission(): Promise<'granted' | 'denied'>;
  writePng(filename: string, bytes: Uint8Array): Promise<string>;
  createAsset(uri: string): Promise<void>;
}

/** Ask for photo-library access, then write the PNG and add it to Photos. */
export async function saveBytesToPhotoLibrary(
  client: PhotoLibraryClient,
  filename: string,
  bytes: Uint8Array,
): Promise<'saved' | 'denied'> {
  const permission = await client.requestAddPermission();
  if (permission !== 'granted') return 'denied';
  const uri = await client.writePng(filename, bytes);
  await client.createAsset(uri);
  return 'saved';
}
