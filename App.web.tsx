import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { MakeScreen } from './components/MakeScreen';
import { MapScreen } from './components/MapScreen';
import { Proof } from './components/Proof';
import { StyleProvider } from './components/StyleContext';
import { paper } from './components/theme';

function query(): { proof: string | null; fixture: boolean } {
  if (typeof window === 'undefined') return { proof: null, fixture: false };
  const params = new URLSearchParams(window.location.search);
  const proof = params.get('proof');
  return { proof, fixture: params.get('fixture') === '1' || Boolean(proof) };
}

export default function App() {
  const [{ proof, fixture }] = useState(query);
  const [screen, setScreen] = useState<'make' | 'map'>('make');
  if (proof) return <Proof id={proof} />;
  return (
    <StyleProvider>
      <StatusBar style="dark" />
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: paper, minHeight: 0 }}>
        <div style={{ display: screen === 'make' ? 'flex' : 'none', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <MakeScreen onMap={() => setScreen('map')} fixture={fixture} />
        </div>
        {screen === 'map' && (
          <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
            <MapScreen onBack={() => setScreen('make')} active />
          </div>
        )}
      </div>
    </StyleProvider>
  );
}
