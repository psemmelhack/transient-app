import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MakeScreen } from './components/MakeScreen';
import { MapScreen } from './components/MapScreen';
import { StyleProvider } from './components/StyleContext';
import { paper } from './components/theme';

export default function App() {
  const [screen, setScreen] = useState<'make' | 'map'>('make');
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StyleProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: paper }}>
          {screen === 'make' ? <MakeScreen onMap={() => setScreen('map')} /> : <MapScreen onBack={() => setScreen('make')} />}
        </SafeAreaView>
      </StyleProvider>
    </SafeAreaProvider>
  );
}
