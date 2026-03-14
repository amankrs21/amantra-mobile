import { Tabs, Redirect } from 'expo-router';
import React, { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { HapticTab } from '@/components/haptic-tab';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAuth } from '@/hooks/use-auth';
import { useEncryptionKey } from '@/hooks/use-encryption-key';
import { useBiometric } from '@/hooks/use-biometric';
import { encodeKey } from '@/utils/crypto';
import api from '@/services/api';
import EncryptionKeyModal from '@/components/modals/EncryptionKeyModal';

export default function TabLayout() {
  const colors = useThemeColors();
  const { isAuthenticated, isHydrated, encryptionKeyConfigured, setEncryptionKeyConfigured } = useAuth();
  const { encodedKey, setKey, isHydrated: isKeyHydrated } = useEncryptionKey();
  const { isAvailable: bioAvailable, isEnabled: bioEnabled, authenticateAndGetKey, enableBiometric } = useBiometric();

  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);

  // Prompt for PIN on startup if key is configured but not in memory
  useEffect(() => {
    if (isHydrated && isKeyHydrated && isAuthenticated && encryptionKeyConfigured && !encodedKey && !hasPrompted) {
      setShowPinPrompt(true);
      setHasPrompted(true);
    }
  }, [isHydrated, isKeyHydrated, isAuthenticated, encryptionKeyConfigured, encodedKey, hasPrompted]);

  const handleBiometricUnlock = useCallback(async () => {
    const key = await authenticateAndGetKey();
    if (key) {
      await setKey(key);
      Toast.show({ type: 'success', text1: 'Unlocked with biometrics.' });
      setShowPinPrompt(false);
    }
  }, [authenticateAndGetKey, setKey]);

  const handlePinSubmit = useCallback(
    async (value: string) => {
      const candidate = value.trim();
      if (!candidate) return;

      try {
        await api.post('/pin/verify', { key: encodeKey(candidate) });
        await setKey(candidate);
        await setEncryptionKeyConfigured(true);
        Toast.show({ type: 'success', text1: 'Encryption key unlocked.' });
        setShowPinPrompt(false);

        if (bioAvailable && !bioEnabled) {
          const enrolled = await enableBiometric(candidate);
          if (enrolled) {
            Toast.show({ type: 'success', text1: 'Biometric unlock enabled!' });
          }
        }
      } catch {
        Toast.show({ type: 'error', text1: 'Invalid encryption key.' });
      }
    },
    [bioAvailable, bioEnabled, enableBiometric, setEncryptionKeyConfigured, setKey],
  );

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tabIconSelected,
          tabBarInactiveTintColor: colors.tabIconDefault,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 1,
          },
        }}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="vault"
          options={{
            title: 'Vault',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="shield-lock" color={color} />,
          }}
        />
        <Tabs.Screen
          name="watchlist"
          options={{
            title: 'Watchlist',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="movie-open" color={color} />,
          }}
        />
        <Tabs.Screen
          name="newsletter"
          options={{
            title: 'Newsletter',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="newspaper-variant" color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="dots-horizontal" color={color} />,
          }}
        />
        {/* Hidden tabs - still accessible but not in tab bar */}
        <Tabs.Screen name="passwords" options={{ href: null }} />
        <Tabs.Screen name="notes" options={{ href: null }} />
        <Tabs.Screen name="account" options={{ href: null }} />
      </Tabs>

      <EncryptionKeyModal
        visible={showPinPrompt}
        onClose={() => setShowPinPrompt(false)}
        onConfirm={handlePinSubmit}
        caption="Enter your encryption PIN to unlock your vault and notes."
        onBiometric={bioAvailable && bioEnabled ? handleBiometricUnlock : undefined}
        biometricAvailable={bioAvailable && bioEnabled}
      />
    </>
  );
}
