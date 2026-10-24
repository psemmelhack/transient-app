/** Share payload is the image alone. No title, text, or url for the compose sheet to show. */
export function webSharePayload(file: File): { files: File[] } {
  return { files: [file] };
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    const file = new File([new Blob(['x'], { type: 'image/png' })], 'image.png', { type: 'image/png' });
    return navigator.canShare(webSharePayload(file));
  } catch {
    return false;
  }
}

export async function sharePng(blob: Blob, filename: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unsupported';
  const file = new File([blob], filename, { type: 'image/png' });
  const payload = webSharePayload(file);
  if (!navigator.canShare?.(payload)) return 'unsupported';
  const previousTitle = typeof document === 'undefined' ? '' : document.title;
  if (typeof document !== 'undefined') document.title = '';
  try {
    await navigator.share(payload);
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  } finally {
    if (typeof document !== 'undefined') document.title = previousTitle;
  }
}

/** System share sheet when the browser can share a file. Otherwise download the image. */
export async function deliverImage(
  blob: Blob,
  filename: string,
  download: (blob: Blob, filename: string) => void,
): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const result = await sharePng(blob, filename);
  if (result === 'shared' || result === 'cancelled') return result;
  download(blob, filename);
  return 'downloaded';
}
