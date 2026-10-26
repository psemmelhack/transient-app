/** User-facing names for keeping a transient. */
export const captureLabel = 'Capture';
export const sharedWithLabel = 'Shared with (optional)';
export const capturedToast = 'Captured';
export const libraryMissToast = 'Couldn’t keep it in My transients';
export const savedToDownloads = 'Saved to Downloads';
export const capturedUnshared = 'Captured · not shared';
export const capturedToPhotos = 'Captured to Photos';
export const capturePending = 'Capturing the image runs in the browser.';
export const emptyLibrary = 'Nothing captured yet.';

export function importedLabel(count: number): string {
  return count === 1 ? 'Imported 1 transient' : `Imported ${count} transients`;
}

/** List status. A named recipient reads “Shared with X”; anything else is an unshared capture. */
export function libraryShareLabel(shares: { recipient?: string; address?: string }[]): string {
  const names = shares.map((entry) => (entry.recipient || entry.address || '').trim()).filter(Boolean);
  if (names.length === 0) return capturedUnshared;
  return `Shared with ${names.join(', ')}`;
}
