import { useEffect, useState, type CSSProperties } from 'react';
import { StatusBar } from 'expo-status-bar';
import { FitDiagnostic } from './components/FitDiagnostic';
import { MakeScreen } from './components/MakeScreen';
import { MapScreen } from './components/MapScreen';
import { Proof } from './components/Proof';
import { StyleProvider } from './components/StyleContext';
import { ink, paper, ui } from './components/theme';
import { isNativeShell, postToNative } from './src/native/shell';
import { consumeStashedImport, importTransients, MIGRATE_ORIGIN, publishImportNotice, stashLocationImport, watchImportNotice, type ImportPayload } from './src/storage/import';

function query(): { proof: string | null; fixture: boolean } {
  if (typeof window === 'undefined') return { proof: null, fixture: false };
  const params = new URLSearchParams(window.location.search);
  const proof = params.get('proof');
  return { proof, fixture: params.get('fixture') === '1' || Boolean(proof) };
}

export default function App() {
  const [{ proof, fixture }] = useState(query);
  const [screen, setScreen] = useState<'make' | 'map'>('make');
  const [toast, setToast] = useState<string | null>(null);
  useState(() => {
    stashLocationImport();
    return 0;
  });

  useEffect(() => watchImportNotice(setToast), []);

  useEffect(() => {
    if (isNativeShell()) postToNative({ type: 'ready' });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const payload = consumeStashedImport();
    if (payload) void importTransients(payload).then(publishImportNotice);
    const hello = () => {
      try {
        window.opener?.postMessage({ source: 'transient', type: 'ready' }, MIGRATE_ORIGIN);
      } catch {
        /* The opener can close before we answer. */
      }
    };
    if (window.opener) {
      hello();
    }
    const timers = window.opener ? [400, 1200].map((delay) => window.setTimeout(hello, delay)) : [];
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== MIGRATE_ORIGIN) return;
      const data = event.data as { source?: string; type?: string; payload?: ImportPayload } | null;
      if (!data || data.source !== 'transient-migrate' || data.type !== 'import' || !data.payload) return;
      void importTransients(data.payload).then((count) => {
        publishImportNotice(count);
        try {
          (event.source as Window | null)?.postMessage({ source: 'transient', type: 'imported', count }, event.origin);
        } catch {
          /* The migrate page can close after sending. */
        }
      });
    };
    window.addEventListener('message', onMessage);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('message', onMessage);
    };
  }, []);

  if (proof) return <Proof id={proof} />;
  return (
    <StyleProvider>
      <StatusBar style="dark" />
      <div style={{ height: '100%', width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', background: paper, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: screen === 'make' ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0, minWidth: 0 }}>
          <MakeScreen onMap={() => setScreen('map')} fixture={fixture} />
        </div>
        {screen === 'map' && (
          <div style={{ display: 'flex', height: '100%', width: '100%', minWidth: 0, minHeight: 0 }}>
            <MapScreen onBack={() => setScreen('make')} active />
          </div>
        )}
      </div>
      <FitDiagnostic />
      {toast && (
        <div role="status" style={importToast}>
          {toast}
        </div>
      )}
    </StyleProvider>
  );
}

const importToast: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 28,
  transform: 'translateX(-50%)',
  zIndex: 40,
  background: ink,
  color: paper,
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 12,
  letterSpacing: '0.08em',
  padding: '8px 14px',
  pointerEvents: 'none',
};
