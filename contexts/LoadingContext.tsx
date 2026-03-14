import { createContext, ReactNode, useCallback, useMemo, useState } from 'react';

type LoadingContextValue = {
    isLoading: boolean;
    message: string | null;
    showLoading: (message?: string) => void;
    hideLoading: () => void;
};

export const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const showLoading = useCallback((nextMessage?: string) => {
        setIsLoading(true);
        setMessage(nextMessage ?? null);
    }, []);

    const hideLoading = useCallback(() => {
        setIsLoading(false);
        setMessage(null);
    }, []);

    const value = useMemo(
        () => ({
            isLoading,
            message,
            showLoading,
            hideLoading,
        }),
        [hideLoading, isLoading, message, showLoading],
    );

    return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}
