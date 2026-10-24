/** Browsers cannot write to Photos. The web Capture path uses the system share sheet. */
export async function savePngToPhotos(
  _filename: string,
  _bytes: Uint8Array,
): Promise<'saved' | 'denied' | 'unavailable'> {
  return 'unavailable';
}
