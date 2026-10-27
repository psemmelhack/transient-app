import { useEffect, useState } from 'react';
import { WEB_SOURCE, type WebCommand } from './protocol';

export const NATIVE_LOCATION_EVENT = 'transient-native-location';
export const NATIVE_TELEMETRY_EVENT = 'transient-native-telemetry';
export const NATIVE_CAPTURE_EVENT = 'transient-native-capture';
export { NATIVE_BUILD_EVENT } from './protocol';

type BridgeWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
};

function bridge(): BridgeWindow['ReactNativeWebView'] | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as BridgeWindow).ReactNativeWebView;
}

/** True inside the Expo Go WebView. A browser tab does not have this object. */
export function isNativeShell(): boolean {
  return typeof bridge()?.postMessage === 'function';
}

/**
 * Expo Go floats a 44pt blue gear, 10pt from the trailing edge, with a stroke and shadow.
 * Headers inside the shell keep their right-hand controls clear of that button.
 * A browser tab does not use this padding.
 */
export const SHELL_HEADER_PADDING_RIGHT = 'max(96px, env(safe-area-inset-right))';

/** The bridge can appear after the first paint. Keep checking until the header can move. */
export function useNativeShell(): boolean {
  const [shell, setShell] = useState(isNativeShell);
  useEffect(() => {
    if (isNativeShell()) {
      setShell(true);
      return;
    }
    const id = window.setInterval(() => {
      if (!isNativeShell()) return;
      setShell(true);
      window.clearInterval(id);
    }, 250);
    const stop = window.setTimeout(() => window.clearInterval(id), 3000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, []);
  return shell;
}

export function postToNative(message: WebCommand): void {
  bridge()?.postMessage(JSON.stringify({ source: WEB_SOURCE, ...message }));
}

export function onNativeEvent<T>(name: string, handler: (detail: T) => void): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<T>).detail);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
