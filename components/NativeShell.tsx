import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import WebViewModule, { type WebViewMessageEvent } from 'react-native-webview';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import { ink, muted, paper } from './theme';
import { requestNativeTelemetryPermissions } from '../src/location/nativePermissions';
import { useTelemetry } from '../src/location/useTelemetry';
import * as Updates from 'expo-updates';
import { factsFromUpdates, type BuildFacts } from '../src/native/buildStamp';
import {
  joinedCapture,
  NATIVE_BUILD_EVENT,
  parseWebMessage,
  pushCaptureChunk,
  startCapture,
  type CaptureHandoff,
  type PendingCapture,
  type ShellLocation,
  type ShellLocationDetail,
  type ShellPlace,
} from '../src/native/protocol';
import {
  PACK_READY_MS,
  SITE,
  TERMINATE_REASON,
  appendFailure,
  failureText,
  httpFailureText,
  nextAfterFailure,
  watchdogReason,
  webViewSource,
  type ShellTarget,
} from '../src/native/shellLoad';
import { installWebBundle, type WebBundleManifest } from '../src/native/webBundle';

type Phase = 'opening' | 'ready' | 'failed';
type Shown = ShellTarget & { view: number };

/** tsc resolves the web WebView types, whose platform props collapse to never. Metro loads the real view. */
type ShellWebViewProps = {
  ref?: Ref<ShellWebViewHandle>;
  originWhitelist?: string[];
  source: { uri: string };
  allowingReadAccessToURL?: string;
  onMessage?: (event: WebViewMessageEvent) => void;
  onError?: (event: { nativeEvent?: { description?: string } }) => void;
  onHttpError?: (event: { nativeEvent?: { statusCode?: number } }) => void;
  onContentProcessDidTerminate?: () => void;
  onRenderProcessGone?: () => void;
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

type ShellWebViewHandle = { injectJavaScript: (script: string) => void; reload?: () => void };

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
  const buildRef = useRef<BuildFacts | null>(null);
  const generation = useRef(0);
  const viewToken = useRef(0);
  const targetRef = useRef<Shown | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const siteReloaded = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [target, setTarget] = useState<Shown | null>(null);
  const [phase, setPhase] = useState<Phase>('opening');
  const [failure, setFailure] = useState<string | null>(null);
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

  const clearWatchdog = useCallback(() => {
    if (watchdog.current != null) clearTimeout(watchdog.current);
    watchdog.current = null;
  }, []);

  const remember = useCallback(
    (reason: string) => {
      const base = buildRef.current ?? factsFromUpdates(Updates, null);
      const next = { ...base, failure: appendFailure(base.failure, reason) };
      buildRef.current = next;
      if (!loaded.current) return;
      push(
        `window.__transientBuild = ${JSON.stringify(next)}; window.dispatchEvent(new CustomEvent(${JSON.stringify(NATIVE_BUILD_EVENT)}, { detail: window.__transientBuild }));`,
      );
    },
    [push],
  );

  const presentRef = useRef<(body: ShellTarget) => void>(() => undefined);

  const arm = useCallback(
    (shown: Shown) => {
      clearWatchdog();
      const token = generation.current;
      const view = shown.view;
      watchdog.current = setTimeout(() => {
        if (token !== generation.current || view !== viewToken.current) return;
        const step = nextAfterFailure(shown, watchdogReason(shown));
        if (step.kind === 'site') {
          remember(step.reason);
          presentRef.current({ kind: 'site' });
          return;
        }
        clearWatchdog();
        remember(step.reason);
        setFailure(step.reason);
        setPhase('failed');
      }, PACK_READY_MS);
    },
    [clearWatchdog, remember],
  );

  const present = useCallback(
    (body: ShellTarget) => {
      if (body.kind === 'site') siteReloaded.current = false;
      const view = ++viewToken.current;
      const shown: Shown = { ...body, view };
      targetRef.current = shown;
      loaded.current = false;
      setTarget(shown);
      setPhase('opening');
      arm(shown);
    },
    [arm],
  );
  presentRef.current = present;

  const reportFailure = useCallback(
    (reason: string, view: number) => {
      if (view !== viewToken.current) return;
      const step = nextAfterFailure(targetRef.current, reason);
      if (step.kind === 'site') {
        remember(step.reason);
        present({ kind: 'site' });
        return;
      }
      clearWatchdog();
      remember(step.reason);
      setFailure(step.reason);
      setPhase('failed');
    },
    [clearWatchdog, present, remember],
  );

  useEffect(() => {
    const token = ++generation.current;
    siteReloaded.current = false;
    targetRef.current = null;
    loaded.current = false;
    setTarget(null);
    setPhase('opening');
    setFailure(null);
    clearWatchdog();
    let cancelled = false;
    (async () => {
      try {
        const manifest = require('../embedded-web/manifest.js') as WebBundleManifest;
        const updateId = typeof Updates.updateId === 'string' ? Updates.updateId : null;
        const installed = await installWebBundle(manifest, updateId);
        if (cancelled || token !== generation.current) return;
        buildRef.current = factsFromUpdates(Updates, installed.revision);
        present({ kind: 'pack', indexUrl: installed.indexUrl, readAccessUrl: installed.readAccessUrl });
      } catch (error) {
        if (cancelled || token !== generation.current) return;
        buildRef.current = factsFromUpdates(Updates, null);
        remember(failureText(error));
        present({ kind: 'site' });
      }
    })();
    return () => {
      cancelled = true;
      clearWatchdog();
    };
  }, [attempt, clearWatchdog, present, remember]);

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
    const build = buildRef.current;
    if (build) {
      push(
        `window.__transientBuild = ${JSON.stringify(build)}; window.dispatchEvent(new CustomEvent(${JSON.stringify(NATIVE_BUILD_EVENT)}, { detail: window.__transientBuild }));`,
      );
    }
  }

  async function onMessage(event: WebViewMessageEvent, view: number) {
    const message = parseWebMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'ready') {
      if (view !== viewToken.current) return;
      clearWatchdog();
      setPhase('ready');
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

  const source = target ? webViewSource(target) : null;

  return (
    <View style={{ flex: 1, backgroundColor: paper }}>
      {target && source ? (
        <WebView
          key={source.uri}
          ref={webRef}
          originWhitelist={['*']}
          source={{ uri: source.uri }}
          allowingReadAccessToURL={source.allowingReadAccessToURL}
          onMessage={(event) => {
            void onMessage(event, target.view);
          }}
          onError={(event) => {
            const description = event.nativeEvent?.description?.trim();
            reportFailure(description || 'The page could not be opened.', target.view);
          }}
          onHttpError={(event) => {
            reportFailure(httpFailureText(event.nativeEvent?.statusCode), target.view);
          }}
          onContentProcessDidTerminate={() => {
            if (target.view !== viewToken.current) return;
            if (target.kind === 'site' && !siteReloaded.current) {
              siteReloaded.current = true;
              loaded.current = false;
              setPhase('opening');
              webRef.current?.reload?.();
              arm(target);
              return;
            }
            reportFailure(TERMINATE_REASON, target.view);
          }}
          onRenderProcessGone={() => {
            reportFailure(TERMINATE_REASON, target.view);
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
      ) : null}
      {phase !== 'ready' ? (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: paper, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: ink, fontSize: 20, fontWeight: '500', letterSpacing: 0.8 }}>Transient</Text>
          {phase === 'failed' ? (
            <>
              <Text style={{ color: muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16, paddingHorizontal: 32 }}>{failure}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                onPress={() => {
                  setPhase('opening');
                  setFailure(null);
                  setTarget(null);
                  setAttempt((value) => value + 1);
                }}
                style={{ marginTop: 18, paddingVertical: 10, paddingHorizontal: 18 }}
              >
                <Text style={{ color: ink, fontSize: 15, fontWeight: '500' }}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={ink} style={{ marginTop: 18 }} />
          )}
        </View>
      ) : null}
    </View>
  );
}
