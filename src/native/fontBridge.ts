import { onNativeEvent, postToNative, isNativeShell } from './shell';

export const NATIVE_FONT_EVENT = 'transient-native-font';

export interface NativeFontDetail {
  id: string;
  status: 'ready' | 'failed';
  count?: number;
}

interface FontBag {
  id: string;
  parts: string[];
}

type FontWindow = Window & { __transientFont?: FontBag };

/**
 * Ask the Expo shell to read one pack font. WKWebView will not `fetch` a `file:` font,
 * so the capture path cannot inline the face any other way. The bytes come back in pieces.
 */
export function requestNativeFont(path: string): Promise<string | null> {
  if (!isNativeShell()) return Promise.resolve(null);
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    let stop = () => {};
    const timer = window.setTimeout(() => {
      stop();
      resolve(null);
    }, 8_000);
    stop = onNativeEvent<NativeFontDetail>(NATIVE_FONT_EVENT, (detail) => {
      if (!detail || detail.id !== id) return;
      window.clearTimeout(timer);
      stop();
      if (detail.status !== 'ready') {
        resolve(null);
        return;
      }
      const bag = (window as FontWindow).__transientFont;
      const count = detail.count ?? 0;
      if (!bag || bag.id !== id || count < 1 || bag.parts.length < count || bag.parts.slice(0, count).some((part) => typeof part !== 'string')) {
        resolve(null);
        return;
      }
      resolve(bag.parts.slice(0, count).join(''));
    });
    postToNative({ type: 'read-font', id, path });
  });
}
