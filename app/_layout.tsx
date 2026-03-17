import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Toaster } from 'sonner-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import LoadingOverlay from '@/components/loading-overlay';
import { AuthProvider } from '@/contexts/AuthContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

function ToasterWithTheme() {
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;

  return (
    <Toaster
      position="top-center"
      offset={54}
      theme={isDark ? 'dark' : 'light'}
      toastOptions={{
        style: {
          backgroundColor: c.surfaceSolid,
          borderColor: c.border,
          borderWidth: 1,
        },
        titleStyle: { color: c.text },
        descriptionStyle: { color: c.textSecondary },
      }}
    />
  );
}

function InnerLayout() {
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: Colors.dark.background } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: Colors.light.background } };

  return (
    <NavThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <LoadingProvider>
              <InnerLayout />
              <LoadingOverlay />
              <ToasterWithTheme />
            </LoadingProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
