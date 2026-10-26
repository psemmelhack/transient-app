import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { View } from 'react-native';
import WebViewModule, { type WebViewMessageEvent } from 'react-native-webview';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import { paper } from './theme';
import { requestNativeTelemetryPermissions } from '../src/location/nativePermissions';
import { useTelemetry } from '../src/location/useTelemetry';
import {
  joinedCapture,
  parseWebMessage,
  pushCaptureChunk,
  startCapture,
  type CaptureHandoff,
  type PendingCapture,
  type ShellLocation,
  type ShellLocationDetail,
  type ShellPlace,
} from '../src/native/protocol';
import { installWebBundle, type WebBundleManifest } from '../src/native/webBundle';

const SITE = 'https://transient.notarist.art/';

type Page = { html: string; baseUrl: string } | { uri: string };

/** tsc resolves the web WebView types, whose platform props collapse to never. Metro loads the real view. */
type ShellWebViewProps = {
  ref?: Ref<ShellWebViewHandle>;
  originWhitelist?: string[];
  source: { html: string; baseUrl?: string } | { uri: string };
  allowingReadAccessToURL?: string;
  onLoadEnd?: () => void;
  onMessage?: (event: WebViewMessageEvent) => void;
  onError?: () => void;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  allowFileAccess?: boolean;
  allowFileAccessFromFileURLs?: boolean;
  allowUniversalAccessFromFileURLs?: boolean;
  setSupportMultipleWindows?: boolean;
  scalesPageToFit?: boolean;
  textZoom?: number;
  contentInsetAdjustmentBehavior?: 'never' | 'automatic';
  style?: { flex?: number; backgroundColor?: string };
};

type ShellWebViewHandle = { injectJavaScript: (script: string) => void };

const WebView = WebViewModule as unknown as ComponentType<ShellWebViewProps>;

function script(body: string): string {
  return `(() => { ${body} })(); true;`;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safePngName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'transient.png';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '');
  if (!cleaned) return 'transient.png';
  return cleaned.toLowerCase().endsWith('.png') ? cleaned : `${cleaned}.png`;
}

/**
 * Write the PNG with the legacy cache API and share that URI.
 * Expo Go is a scoped app. Sharing only grants read when the path is a prefix of the
 * cache directory it already knows. The new File API’s URI misses that prefix
 * (`/var` versus `/private/var`, or a path that falls through to the experience-data
 * rule), so shareAsync throws FilePermissionException and the page shows “Couldn’t share”.
 */
async function shareBase64(filename: string, pngBase64: string): Promise<void> {
  const dir = LegacyFileSystem.cacheDirectory;
  if (!dir || !pngBase64) throw new Error('cache');
  const uri = `${dir}${safePngName(filename)}`;
  await LegacyFileSystem.writeAsStringAsync(uri, pngBase64, { encoding: 'base64' });
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('share');
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
  } finally {
    await LegacyFileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}

async function placeFor(latitude: number, longitude: number, cache: { key: string; place: ShellPlace | null } | null): Promise<{ cache: { key: string; place: ShellPlace | null }; place: ShellPlace | null }> {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  if (cache?.key === key) return { cache, place: cache.place };
  let place: ShellPlace | null = null;
  try {
    const [hit] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (hit) {
      const city = (hit.city || hit.district || hit.subregion || '').trim() || null;
      const region = (hit.region || '').trim() || null;
      const full = city && region ? `${city}, ${region}` : city || region;
      if (full) place = { city, region, full };
    }
  } catch {
    place = null;
  }
  return { cache: { key, place }, place };
}

function locationOf(pos: Location.LocationObject, place: ShellPlace | null): ShellLocation {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    altitude: finiteOrNull(pos.coords.altitude),
    accuracy: finiteOrNull(pos.coords.accuracy),
    altitudeAccuracy: finiteOrNull(pos.coords.altitudeAccuracy),
    speed: finiteOrNull(pos.coords.speed),
    course: finiteOrNull(pos.coords.heading),
    place,
  };
}

/** Expo Go shell. The page is the web app; this only bridges sensors and the share sheet. */
export function NativeShell() {
  const webRef = useRef<ShellWebViewHandle>(null);
  const loaded = useRef(false);
  const lastLocation = useRef<ShellLocationDetail | null>(null);
  const lastTelemetry = useRef<string | null>(null);
  const placeCache = useRef<{ key: string; place: ShellPlace | null } | null>(null);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const captures = useRef(new Map<string, PendingCapture>());
  const [page, setPage] = useState<Page | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [telemetryOn, setTelemetryOn] = useState(false);
  const telemetry = useTelemetry(telemetryOn);

  const push = useCallback((body: string) => {
    if (!loaded.current) return;
    webRef.current?.injectJavaScript(script(body));
  }, []);

  const publishLocation = useCallback(
    (detail: ShellLocationDetail) => {
      lastLocation.current = detail;
      push(`window.dispatchEvent(new CustomEvent('transient-native-location', { detail: ${JSON.stringify(detail)} }));`);
    },
    [push],
  );

  const finishCapture = useCallback(
    (id: string, status: CaptureHandoff) => {
      push(`window.dispatchEvent(new CustomEvent('transient-native-capture', { detail: ${JSON.stringify({ id, status })} }));`);
    },
    [push],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const manifest = require('../embedded-web/manifest.js') as WebBundleManifest;
        const installed = await installWebBundle(manifest);
        if (cancelled) return;
        setBaseUrl(installed.baseUrl);
        setPage({ html: installed.html, baseUrl: installed.baseUrl });
      } catch {
        if (!cancelled) setPage({ uri: SITE });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listen = useCallback(async () => {
    watch.current?.remove();
    watch.current = null;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        publishLocation({ status: 'unavailable' });
        return;
      }
      const apply = async (pos: Location.LocationObject) => {
        const next = await placeFor(pos.coords.latitude, pos.coords.longitude, placeCache.current);
        placeCache.current = next.cache;
        publishLocation({ status: 'ready', location: locationOf(pos, next.place) });
      };
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await apply(first);
      watch.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 8 },
        (pos) => {
          void apply(pos);
        },
      );
    } catch {
      publishLocation({ status: 'unavailable' });
    }
  }, [publishLocation]);

  useEffect(() => {
    void listen();
    return () => watch.current?.remove();
  }, [listen]);

  useEffect(() => {
    const body = telemetryOn && telemetry.sensors
      ? `window.__transientTelemetry = ${JSON.stringify({ sensors: telemetry.sensors })}; window.dispatchEvent(new CustomEvent('transient-native-telemetry'));`
      : `window.__transientTelemetry = null; window.dispatchEvent(new CustomEvent('transient-native-telemetry'));`;
    lastTelemetry.current = body;
    push(body);
  }, [push, telemetry.sensors, telemetryOn]);

  function flush() {
    loaded.current = true;
    if (lastLocation.current) {
      push(`window.dispatchEvent(new CustomEvent('transient-native-location', { detail: ${JSON.stringify(lastLocation.current)} }));`);
    }
    if (lastTelemetry.current) push(lastTelemetry.current);
  }

  async function onMessage(event: WebViewMessageEvent) {
    const message = parseWebMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'ready') {
      flush();
      return;
    }
    if (message.type === 'retry-location') {
      await listen();
      return;
    }
    if (message.type === 'telemetry') {
      if (message.enabled) await requestNativeTelemetryPermissions();
      setTelemetryOn(message.enabled);
      return;
    }
    if (message.type === 'capture-begin') {
      const pending = startCapture(message.id, message.filename, message.count);
      if (!pending) {
        finishCapture(message.id, 'failed');
        return;
      }
      captures.current.set(message.id, pending);
      return;
    }
    if (message.type === 'capture-chunk') {
      const pending = captures.current.get(message.id);
      if (!pending) return;
      captures.current.set(message.id, pushCaptureChunk(pending, message.index, message.data));
      return;
    }
    if (message.type !== 'capture' && message.type !== 'capture-end') return;
    const pending = message.type === 'capture-end' ? captures.current.get(message.id) : null;
    if (message.type === 'capture-end') captures.current.delete(message.id);
    try {
      const pngBase64 = message.type === 'capture' ? message.pngBase64 : pending ? joinedCapture(pending) : null;
      const filename = message.type === 'capture' ? message.filename : pending?.filename;
      if (!pngBase64 || !filename) throw new Error('incomplete');
      // The sheet resolves on dismiss. Save and Cancel are not separate results.
      await shareBase64(filename, pngBase64);
      finishCapture(message.id, 'shared');
    } catch {
      finishCapture(message.id, 'failed');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: paper }}>
      {page ? (
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={'html' in page ? { html: page.html, baseUrl: page.baseUrl } : { uri: page.uri }}
          allowingReadAccessToURL={baseUrl ?? undefined}
          onLoadEnd={flush}
          onMessage={(event) => {
            void onMessage(event);
          }}
          onError={() => {
            if ('html' in (page ?? {})) setPage({ uri: SITE });
          }}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          setSupportMultipleWindows={false}
          scalesPageToFit={false}
          textZoom={100}
          contentInsetAdjustmentBehavior="never"
          style={{ flex: 1, backgroundColor: paper }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: paper }} />
      )}
    </View>
  );
}
