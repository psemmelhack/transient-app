import { WEB_SOURCE, type WebCommand } from './protocol';

export const NATIVE_LOCATION_EVENT = 'transient-native-location';
export const NATIVE_TELEMETRY_EVENT = 'transient-native-telemetry';
export const NATIVE_CAPTURE_EVENT = 'transient-native-capture';

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
