import { useCallback, useMemo, useRef } from 'react';
import { Animated, Dimensions, PanResponder, type ViewStyle } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDE_OUT_DURATION = 150;
const SLIDE_IN_DURATION = 200;

type SwipeFilterResult = {
    panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
    animatedStyle: Animated.WithAnimatedObject<ViewStyle>;
};

export function useSwipeFilter<T>(
    keys: T[],
    activeKey: T,
    setActiveKey: (key: T) => void,
    threshold = 50,
): SwipeFilterResult {
    const activeKeyRef = useRef(activeKey);
    activeKeyRef.current = activeKey;

    const translateX = useRef(new Animated.Value(0)).current;
    const isAnimating = useRef(false);

    const slideToNewFilter = useCallback(
        (direction: 'left' | 'right', newKey: T) => {
            isAnimating.current = true;
            const slideOutTarget = direction === 'left' ? -SCREEN_WIDTH : SCREEN_WIDTH;

            // Slide out current content
            Animated.timing(translateX, {
                toValue: slideOutTarget,
                duration: SLIDE_OUT_DURATION,
                useNativeDriver: true,
            }).start(() => {
                // Switch filter
                setActiveKey(newKey);

                // Position off-screen on opposite side
                translateX.setValue(direction === 'left' ? SCREEN_WIDTH : -SCREEN_WIDTH);

                // Slide in new content
                Animated.timing(translateX, {
                    toValue: 0,
                    duration: SLIDE_IN_DURATION,
                    useNativeDriver: true,
                }).start(() => {
                    isAnimating.current = false;
                });
            });
        },
        [setActiveKey, translateX],
    );

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, gs) =>
                    !isAnimating.current &&
                    Math.abs(gs.dx) > Math.abs(gs.dy) &&
                    Math.abs(gs.dx) > 20,
                onPanResponderMove: (_, gs) => {
                    if (!isAnimating.current) {
                        translateX.setValue(gs.dx);
                    }
                },
                onPanResponderRelease: (_, gs) => {
                    if (isAnimating.current) return;
                    if (
                        Math.abs(gs.dx) < threshold ||
                        Math.abs(gs.dx) < Math.abs(gs.dy)
                    ) {
                        // Snap back
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 120,
                            friction: 8,
                        }).start();
                        return;
                    }

                    const idx = keys.indexOf(activeKeyRef.current);
                    if (gs.dx < -threshold && idx < keys.length - 1) {
                        slideToNewFilter('left', keys[idx + 1]);
                    } else if (gs.dx > threshold && idx > 0) {
                        slideToNewFilter('right', keys[idx - 1]);
                    } else {
                        // Edge of list — snap back
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 120,
                            friction: 8,
                        }).start();
                    }
                },
                onPanResponderTerminate: () => {
                    if (!isAnimating.current) {
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 120,
                            friction: 8,
                        }).start();
                    }
                },
            }),
        [keys, threshold, translateX, slideToNewFilter],
    );

    const animatedStyle = useMemo(
        () => ({ transform: [{ translateX }] }),
        [translateX],
    );

    return { panHandlers: panResponder.panHandlers, animatedStyle };
}
