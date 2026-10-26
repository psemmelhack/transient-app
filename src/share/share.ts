import { isNativeShell, NATIVE_CAPTURE_EVENT, onNativeEvent, postToNative } from '../native/shell';
import type { CaptureHandoff } from '../native/protocol';

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

export type CaptureDelivery = 'shared' | 'cancelled' | 'downloaded' | 'saved' | 'opened' | 'downloads';

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

/** Firefox on iPhone. File sharing rejects there; a blob download saves into Files. */
export function isFirefoxIos(nav?: CaptureNavigator): boolean {
  if (!isIosPlatform(nav)) return false;
  const source: CaptureNavigator | undefined =
    nav ?? (typeof navigator === 'undefined' ? undefined : (navigator as CaptureNavigator));
  return /FxiOS/i.test(source?.userAgent ?? '');
}

/** True when an anchor can carry a download name. Firefox iOS honors this for blob URLs. */
export function anchorDownloadSupported(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) return false;
  try {
    const link = doc.createElement('a');
    return typeof link.download === 'string';
  } catch {
    return false;
  }
}

/**
 * Capture puts the image where a phone can keep it.
 * Android downloads the PNG first, so it lands in Downloads and shows in Gallery, then opens the share sheet.
 * iOS Safari opens the sheet alone; Save Image lives there, and cancelling stores nothing.
 * Firefox on iPhone downloads the PNG. The full-screen image is only used when that download cannot start.
 * When another browser rejects the file sheet with anything other than a cancel, the PNG is still handed off.
 * On Android, dismissing the sheet still keeps the download (`saved`).
 */
export async function saveImage(
  blob: Blob,
  filename: string,
  download: (blob: Blob, filename: string) => void,
  present?: (blob: Blob, filename: string) => void,
): Promise<CaptureDelivery> {
  if (isNativeShell()) return shareThroughNative(blob, filename);
  if (isFirefoxIos()) return firefoxDownload(blob, filename, download, present);
  if (isAndroidPlatform()) {
    download(blob, filename);
    const result = await sharePng(blob, filename);
    return result === 'shared' ? 'shared' : 'saved';
  }
  const result = await sharePng(blob, filename);
  if (result === 'shared' || result === 'cancelled') return result;
  return handoffImage(blob, filename, download, present);
}

function firefoxDownload(
  blob: Blob,
  filename: string,
  download: (blob: Blob, filename: string) => void,
  present?: (blob: Blob, filename: string) => void,
): CaptureDelivery {
  if (anchorDownloadSupported()) {
    download(blob, filename);
    return 'downloads';
  }
  if (present) {
    present(blob, filename);
    return 'opened';
  }
  download(blob, filename);
  return 'downloads';
}

/** Small enough that WKWebView delivers every piece. A full poster is several of these. */
const CAPTURE_CHUNK = 48_000;

/** Expo Go draws the PNG in the page and this hands the bytes to the share sheet. */
async function shareThroughNative(blob: Blob, filename: string): Promise<CaptureDelivery> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const pngBase64 = await blobToBase64(blob);
  const chunks: string[] = [];
  for (let index = 0; index < pngBase64.length; index += CAPTURE_CHUNK) {
    chunks.push(pngBase64.slice(index, index + CAPTURE_CHUNK));
  }
  if (chunks.length === 0) chunks.push('');
  const status = await new Promise<CaptureHandoff>((resolve) => {
    let stop = () => {};
    const timer = window.setTimeout(() => {
      stop();
      resolve('failed');
    }, 120000);
    stop = onNativeEvent<{ id?: string; status?: CaptureHandoff }>(NATIVE_CAPTURE_EVENT, (detail) => {
      if (!detail || detail.id !== id) return;
      window.clearTimeout(timer);
      stop();
      resolve(detail.status === 'cancelled' || detail.status === 'shared' ? detail.status : 'failed');
    });
    postToNative({ type: 'capture-begin', id, filename, count: chunks.length });
    chunks.forEach((data, index) => postToNative({ type: 'capture-chunk', id, index, data }));
    postToNative({ type: 'capture-end', id });
  });
  if (status === 'failed') throw new Error('Could not open the share sheet');
  return status;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const stride = 0x8000;
  for (let index = 0; index < bytes.length; index += stride) {
    binary += String.fromCharCode(...bytes.subarray(index, index + stride));
  }
  return btoa(binary);
}

function handoffImage(
  blob: Blob,
  filename: string,
  download: (blob: Blob, filename: string) => void,
  present?: (blob: Blob, filename: string) => void,
): CaptureDelivery {
  if (isIosNonSafari()) {
    if (anchorDownloadSupported()) {
      download(blob, filename);
      return 'downloads';
    }
    if (present) {
      present(blob, filename);
      return 'opened';
    }
  }
  if (isIosPlatform() && present) {
    present(blob, filename);
    return 'opened';
  }
  download(blob, filename);
  return 'downloaded';
}
