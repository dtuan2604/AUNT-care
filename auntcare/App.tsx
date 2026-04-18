import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppShell from './src/AppShell';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fbfbff" />
      <AppShell />
    </SafeAreaProvider>
  );
}

export default App;
