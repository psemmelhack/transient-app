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

interface CaptureNavigator {
  userAgent?: string;
  userAgentData?: { platform?: string };
}

/**
 * Android is `userAgentData.platform === 'Android'` when that string is present.
 * An empty platform falls through to the user agent. iPhone and desktop platforms are not Android.
 */
export function isAndroidPlatform(nav?: CaptureNavigator): boolean {
  const source: CaptureNavigator | undefined =
    nav ?? (typeof navigator === 'undefined' ? undefined : (navigator as CaptureNavigator));
  const platform = source?.userAgentData?.platform;
  if (typeof platform === 'string' && platform.length > 0) return platform === 'Android';
  return /Android/i.test(source?.userAgent ?? '');
}

export type CaptureDelivery = 'shared' | 'cancelled' | 'downloaded' | 'saved';

/**
 * Capture puts the image where a phone can keep it.
 * Android downloads the PNG first, so it lands in Downloads and shows in Gallery, then opens the share sheet.
 * iOS opens the sheet alone; Save Image lives there, and cancelling stores nothing.
 * A desktop browser that cannot share a file downloads the PNG.
 * On Android, dismissing the sheet still keeps the download (`saved`).
 */
export async function saveImage(
  blob: Blob,
  filename: string,
  download: (blob: Blob, filename: string) => void,
): Promise<CaptureDelivery> {
  if (isAndroidPlatform()) {
    download(blob, filename);
    const result = await sharePng(blob, filename);
    return result === 'shared' ? 'shared' : 'saved';
  }
  const result = await sharePng(blob, filename);
  if (result === 'shared' || result === 'cancelled') return result;
  if (canShareFiles()) throw new Error('Could not open the share sheet');
  download(blob, filename);
  return 'downloaded';
}
