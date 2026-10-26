import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeShell } from './components/NativeShell';
import { paper } from './components/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: paper }}>
        <NativeShell />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
