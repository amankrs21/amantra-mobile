import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import LoadingOverlay from '@/components/loading-overlay';
import { AuthProvider } from '@/contexts/AuthContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: Colors.dark.background } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: Colors.light.background } };

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LoadingProvider>
          <ThemeProvider value={navTheme}>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </ThemeProvider>
          <LoadingOverlay />
          <Toast />
        </LoadingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
