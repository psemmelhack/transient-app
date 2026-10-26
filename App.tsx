import { useState } from 'react';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MakeScreen } from './components/MakeScreen';
import { MapScreen } from './components/MapScreen';
import { StyleProvider } from './components/StyleContext';
import { paper } from './components/theme';
import { posterFontMap } from './src/composition/nativeFonts';

export default function App() {
  const [ready, fontError] = useFonts(posterFontMap);
  const [screen, setScreen] = useState<'make' | 'map'>('make');
  if (!ready && !fontError) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StyleProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: paper }}>
          {screen === 'make' ? <MakeScreen onMap={() => setScreen('map')} /> : <MapScreen onBack={() => setScreen('make')} active />}
        </SafeAreaView>
      </StyleProvider>
    </SafeAreaProvider>
  );
}
