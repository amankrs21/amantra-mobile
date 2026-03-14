import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { decodeKey, encodeKey } from '@/utils/crypto';
import { getItemWithTTL, removeItem, setItemWithTTL } from '@/utils/storage';

const STORAGE_KEY = 'securevault:ekey';
const TTL_MS = 30 * 60 * 1000; // 30 minutes — re-lock after inactivity

export function useEncryptionKey() {
    const [rawKey, setRawKey] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const appState = useRef(AppState.currentState);

    const hydrate = useCallback(async () => {
        try {
            const stored = await getItemWithTTL<string>(STORAGE_KEY);
            setRawKey(stored ?? null);
        } finally {
            setIsHydrated(true);
        }
    }, []);

    useEffect(() => { void hydrate(); }, [hydrate]);

    // Re-check TTL when app comes to foreground
    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                void hydrate();
            }
            appState.current = nextState;
        });
        return () => sub.remove();
    }, [hydrate]);

    const setKey = useCallback(async (value: string, persist = true) => {
        const encoded = encodeKey(value);
        setRawKey(encoded);
        if (persist) {
            await setItemWithTTL(STORAGE_KEY, encoded, TTL_MS);
        }
    }, []);

    const clearKey = useCallback(async () => {
        setRawKey(null);
        await removeItem(STORAGE_KEY);
    }, []);

    const decodedKey = rawKey ? decodeKey(rawKey) : null;

    return {
        key: decodedKey,
        encodedKey: rawKey,
        isHydrated,
        setKey,
        clearKey,
    };
}
