import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { useLoading } from '@/hooks/use-loading';
import { Colors } from '@/constants/theme';

export default function LoadingOverlay() {
    const { isLoading, message } = useLoading();

    if (!isLoading) {
        return null;
    }

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
            <BlurView intensity={40} tint="default" style={styles.backdrop}>
                <View style={styles.content}>
                    <ActivityIndicator size="large" color={Colors.light.tint} />
                    {message ? <Text style={styles.message}>{message}</Text> : null}
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    content: {
        alignItems: 'center',
        gap: 16,
        padding: 24,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        color: '#2c2c2c',
    },
});
