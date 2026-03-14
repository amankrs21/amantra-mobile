import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: expo-local-authentication and expo-secure-store must be installed:
//   npx expo install expo-local-authentication expo-secure-store
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'securevault.biometric-enabled';
const SECURE_STORE_KEY = 'securevault.biometric-ekey';

export type BiometricState = {
    /** Whether the device supports biometrics */
    isAvailable: boolean;
    /** Whether the user has enabled biometric unlock */
    isEnabled: boolean;
    /** Whether state has been loaded from storage */
    isHydrated: boolean;
    /** Try to authenticate via biometrics and return the stored encryption key */
    authenticateAndGetKey: () => Promise<string | null>;
    /** Enable biometric unlock by storing the encryption key securely */
    enableBiometric: (encryptionKey: string) => Promise<boolean>;
    /** Disable biometric unlock and clear stored key */
    disableBiometric: () => Promise<void>;
};

export function useBiometric(): BiometricState {
    const [isAvailable, setIsAvailable] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const compatible = await LocalAuthentication.hasHardwareAsync();
                const enrolled = await LocalAuthentication.isEnrolledAsync();
                setIsAvailable(compatible && enrolled);

                const storedFlag = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
                setIsEnabled(storedFlag === 'true');
            } catch (error) {
                console.error('Biometric init failed', error);
            } finally {
                setIsHydrated(true);
            }
        };

        void init();
    }, []);

    const authenticateAndGetKey = useCallback(async (): Promise<string | null> => {
        if (!isAvailable || !isEnabled) {
            return null;
        }

        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock your vault',
                cancelLabel: 'Use PIN',
                disableDeviceFallback: true,
            });

            if (!result.success) {
                return null;
            }

            const storedKey = await SecureStore.getItemAsync(SECURE_STORE_KEY);
            return storedKey;
        } catch (error) {
            console.error('Biometric authentication failed', error);
            return null;
        }
    }, [isAvailable, isEnabled]);

    const enableBiometric = useCallback(async (encryptionKey: string): Promise<boolean> => {
        if (!isAvailable) {
            return false;
        }

        try {
            // Verify biometric first
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Enable biometric unlock',
                cancelLabel: 'Cancel',
                disableDeviceFallback: true,
            });

            if (!result.success) {
                return false;
            }

            await SecureStore.setItemAsync(SECURE_STORE_KEY, encryptionKey);
            await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
            setIsEnabled(true);
            return true;
        } catch (error) {
            console.error('Enable biometric failed', error);
            return false;
        }
    }, [isAvailable]);

    const disableBiometric = useCallback(async () => {
        try {
            await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
            await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
            setIsEnabled(false);
        } catch (error) {
            console.error('Disable biometric failed', error);
        }
    }, []);

    return {
        isAvailable,
        isEnabled,
        isHydrated,
        authenticateAndGetKey,
        enableBiometric,
        disableBiometric,
    };
}
