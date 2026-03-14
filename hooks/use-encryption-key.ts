import { useCallback, useEffect, useState } from 'react';

import { decodeKey, encodeKey } from '@/utils/crypto';
import { getItemWithTTL, removeItem, setItemWithTTL } from '@/utils/storage';

const STORAGE_KEY = 'securevault:ekey';
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useEncryptionKey() {
    const [rawKey, setRawKey] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const hydrate = async () => {
            try {
                const stored = await getItemWithTTL<string>(STORAGE_KEY);
                setRawKey(stored ?? null);
            } finally {
                setIsHydrated(true);
            }
        };

        void hydrate();
    }, []);

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
