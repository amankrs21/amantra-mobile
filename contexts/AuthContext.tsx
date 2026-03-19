import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import api, { onUnauthorized, setAuthToken } from '@/services/api';

export type AuthUser = {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    dateOfBirth?: string | null;
    weatherCity?: string | null;
    isVerified?: boolean;
    createdAt?: string;
};

export type AuthSessionPayload = {
    token: string;
    user: AuthUser;
    encryptionKeyConfigured?: boolean;
};

type AuthContextValue = {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isHydrated: boolean;
    encryptionKeyConfigured: boolean;
    completeLogin: (payload: AuthSessionPayload) => Promise<void>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    setEncryptionKeyConfigured: (value: boolean) => Promise<void>;
};

const AUTH_TOKEN_KEY = 'securevault:token';
const AUTH_USER_KEY = 'securevault:user';
const AUTH_KEY_FLAG = 'securevault:key-configured';
const ENCRYPTION_KEY = 'securevault:ekey';
const BIOMETRIC_ENABLED_KEY = 'securevault.biometric-enabled';
const VAULT_CATEGORIES_KEY = 'securevault:vault-categories';
const NOTES_CATEGORIES_KEY = 'securevault:notes-categories';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [encryptionKeyConfigured, setKeyConfigured] = useState<boolean>(false);

    useEffect(() => {
        const hydrate = async () => {
            try {
                const [storedToken, storedUser, keyFlag] = await AsyncStorage.multiGet([
                    AUTH_TOKEN_KEY,
                    AUTH_USER_KEY,
                    AUTH_KEY_FLAG,
                ]);

                const nextToken = storedToken?.[1] ?? null;
                const userJson = storedUser?.[1];
                const keyConfiguredValue = keyFlag?.[1];

                if (nextToken) {
                    setToken(nextToken);
                    setAuthToken(nextToken);
                }

                if (userJson) {
                    try {
                        setUser(JSON.parse(userJson));
                    } catch (error) {
                        console.error('Failed to parse stored user payload', error);
                        await AsyncStorage.removeItem(AUTH_USER_KEY);
                    }
                }

                if (keyConfiguredValue) {
                    setKeyConfigured(keyConfiguredValue === 'true');
                }
            } catch (error) {
                console.error('Failed to hydrate authentication state', error);
            } finally {
                setIsHydrated(true);
            }
        };

        hydrate();
    }, []);

    const completeLogin = useCallback(async ({ token: nextToken, user: nextUser, encryptionKeyConfigured: keyConfigured = false }: AuthSessionPayload) => {
        setToken(nextToken);
        setUser(nextUser);
        setKeyConfigured(keyConfigured);
        setAuthToken(nextToken);

        await AsyncStorage.multiSet([
            [AUTH_TOKEN_KEY, nextToken],
            [AUTH_USER_KEY, JSON.stringify(nextUser)],
            [AUTH_KEY_FLAG, keyConfigured ? 'true' : 'false'],
        ]);
    }, []);

    const signOut = useCallback(async () => {
        setToken(null);
        setUser(null);
        setKeyConfigured(false);
        setAuthToken(null);

        // Clear ALL user data from storage — encryption key, biometric flag, auth tokens, categories
        await AsyncStorage.multiRemove([
            AUTH_TOKEN_KEY,
            AUTH_USER_KEY,
            AUTH_KEY_FLAG,
            ENCRYPTION_KEY,
            BIOMETRIC_ENABLED_KEY,
            VAULT_CATEGORIES_KEY,
            NOTES_CATEGORIES_KEY,
        ]);

        // Also clear biometric key from secure store
        try {
            const SecureStore = await import('expo-secure-store');
            await SecureStore.deleteItemAsync('securevault.biometric-ekey');
        } catch {
            // expo-secure-store may not be available, ignore
        }
    }, []);

    useEffect(() => {
        const clearSession = async () => {
            await signOut();
        };

        onUnauthorized(clearSession);
    }, [signOut]);

    const refreshUser = useCallback(async () => {
        if (!token) {
            return;
        }

        const response = await api.get<AuthUser>('/user/fetch');
        setUser(response.data);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.data));
    }, [token]);

    const setEncryptionKeyConfigured = useCallback(async (value: boolean) => {
        setKeyConfigured(value);
        await AsyncStorage.setItem(AUTH_KEY_FLAG, value ? 'true' : 'false');
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            token,
            user,
            isHydrated,
            isAuthenticated: Boolean(token),
            encryptionKeyConfigured,
            completeLogin,
            signOut,
            refreshUser,
            setEncryptionKeyConfigured,
        }),
        [completeLogin, encryptionKeyConfigured, isHydrated, refreshUser, setEncryptionKeyConfigured, signOut, token, user],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
