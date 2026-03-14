import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, type ThemeColors } from '@/constants/theme';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    scheme: 'light' | 'dark';
    colors: ThemeColors;
}

const STORAGE_KEY = 'amantra:theme-mode';

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'system',
    setMode: () => {},
    scheme: 'light',
    colors: Colors.light,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme();
    const [mode, setModeState] = useState<ThemeMode>('system');
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then((v) => {
            if (v === 'light' || v === 'dark' || v === 'system') {
                setModeState(v);
            }
            setHydrated(true);
        });
    }, []);

    const setMode = useCallback((next: ThemeMode) => {
        setModeState(next);
        AsyncStorage.setItem(STORAGE_KEY, next);
    }, []);

    const scheme = mode === 'system' ? (systemScheme ?? 'light') : mode;
    const colors = Colors[scheme];

    const value = useMemo(() => ({ mode, setMode, scheme, colors }), [mode, setMode, scheme, colors]);

    if (!hydrated) return null;

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
