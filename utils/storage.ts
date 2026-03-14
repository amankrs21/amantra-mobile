import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredValue<T> = {
    value: T;
    expiresAt?: number;
};

export async function setItemWithTTL<T>(key: string, value: T, ttlMs?: number) {
    const payload: StoredValue<T> = {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };

    await AsyncStorage.setItem(key, JSON.stringify(payload));
}

export async function getItemWithTTL<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as StoredValue<T>;
        if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
            await AsyncStorage.removeItem(key);
            return null;
        }

        return parsed.value ?? null;
    } catch (error) {
        console.error(`Failed to parse stored value for ${key}`, error);
        await AsyncStorage.removeItem(key);
        return null;
    }
}

export async function removeItem(key: string) {
    await AsyncStorage.removeItem(key);
}
