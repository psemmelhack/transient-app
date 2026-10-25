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
  try {
    if (!navigator.canShare?.(payload)) return 'unsupported';
  } catch {
    return 'unsupported';
  }
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

export type CaptureDelivery = 'shared' | 'cancelled' | 'downloaded' | 'saved' | 'opened';

/**
 * iPhone, iPad, and iPod, including iPadOS when the platform string is iOS.
 * A desktop platform is not iOS even if the user agent mentions a phone.
 */
export function isIosPlatform(nav?: CaptureNavigator): boolean {
  const source: CaptureNavigator | undefined =
    nav ?? (typeof navigator === 'undefined' ? undefined : (navigator as CaptureNavigator));
  if (source?.userAgentData?.platform === 'iOS') return true;
  return /iPhone|iPad|iPod/i.test(source?.userAgent ?? '');
}

/**
 * Firefox, Chrome, Edge, and the other iOS browsers ship a vendor token.
 * Safari’s user agent does not. WebKit on those browsers may report that a
 * file can be shared and then reject the sheet.
 */
export function isIosNonSafari(nav?: CaptureNavigator): boolean {
  if (!isIosPlatform(nav)) return false;
  const source: CaptureNavigator | undefined =
    nav ?? (typeof navigator === 'undefined' ? undefined : (navigator as CaptureNavigator));
  return /FxiOS|CriOS|EdgiOS|OPiOS|DuckDuckGo|GSA\/|Focus\//i.test(source?.userAgent ?? '');
}

/**
 * Capture puts the image where a phone can keep it.
 * Android downloads the PNG first, so it lands in Downloads and shows in Gallery, then opens the share sheet.
 * iOS Safari opens the sheet alone; Save Image lives there, and cancelling stores nothing.
 * When the file sheet is missing or rejects with anything other than a cancel, the PNG is still handed off:
 * iOS shows it for a long-press save, and every other browser downloads it.
 * On Android, dismissing the sheet still keeps the download (`saved`).
 */
export async function saveImage(
  blob: Blob,
  filename: string,
  download: (blob: Blob, filename: string) => void,
  present?: (blob: Blob, filename: string) => void,
): Promise<CaptureDelivery> {
  if (isAndroidPlatform()) {
    download(blob, filename);
    const result = await sharePng(blob, filename);
    return result === 'shared' ? 'shared' : 'saved';
  }
  const result = await sharePng(blob, filename);
  if (result === 'shared' || result === 'cancelled') return result;
  return handoffImage(blob, filename, download, present);
}

function handoffImage(
  blob: Blob,
  filename: string,
  download: (blob: Blob, filename: string) => void,
  present?: (blob: Blob, filename: string) => void,
): CaptureDelivery {
  if (isIosPlatform() && present) {
    present(blob, filename);
    return 'opened';
  }
  download(blob, filename);
  return 'downloaded';
}
