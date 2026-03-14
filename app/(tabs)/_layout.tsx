import { Tabs, Redirect } from 'expo-router';
import React, { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useEncryptionKey } from '@/hooks/use-encryption-key';
import { useBiometric } from '@/hooks/use-biometric';
import { encodeKey } from '@/utils/crypto';
import { api } from '@/services/api';
import EncryptionKeyModal from '@/components/modals/EncryptionKeyModal';

export default function TabLayout() {
  const colorScheme = useColorScheme();
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="passwords"
          options={{
            title: 'Passwords',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="key-variant" color={color} />,
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            title: 'Notes',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="note-text" color={color} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="account-circle" color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={26} name="dots-horizontal" color={color} />,
          }}
        />
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
