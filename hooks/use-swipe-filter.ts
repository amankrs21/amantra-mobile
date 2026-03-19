import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';

export function useSwipeFilter<T>(
    keys: T[],
    activeKey: T,
    setActiveKey: (key: T) => void,
    threshold = 50,
) {
    const activeKeyRef = useRef(activeKey);
    activeKeyRef.current = activeKey;

    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 20,
        onPanResponderRelease: (_, gs) => {
            if (Math.abs(gs.dx) < threshold || Math.abs(gs.dx) < Math.abs(gs.dy)) return;
            const idx = keys.indexOf(activeKeyRef.current);
            if (gs.dx < -threshold && idx < keys.length - 1) setActiveKey(keys[idx + 1]);
            else if (gs.dx > threshold && idx > 0) setActiveKey(keys[idx - 1]);
        },
    }), [keys, setActiveKey, threshold]);

    return panResponder;
}
