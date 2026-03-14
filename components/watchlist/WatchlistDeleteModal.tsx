import { useMemo } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';

export type WatchlistDeleteModalProps = { visible: boolean; onClose: () => void; onConfirm: () => Promise<void> | void; title: string };

export default function WatchlistDeleteModal({ visible, onClose, onConfirm, title }: WatchlistDeleteModalProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <Text style={styles.title}>Remove from watchlist?</Text>
                    <Text style={styles.subtitle}>You are about to remove <Text style={{ fontWeight: '700' }}>{title}</Text> from your watchlist. This action cannot be undone.</Text>
                    <View style={styles.buttonRow}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}><Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text></Pressable>
                        <Pressable style={[styles.button, styles.deleteButton]} onPress={onConfirm}><Text style={styles.buttonLabel}>Remove</Text></Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    card: { backgroundColor: c.surfaceSolid, borderRadius: 24, padding: 24, gap: 18, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 12, borderWidth: 1, borderColor: c.border },
    title: { fontSize: 20, fontWeight: '700', color: c.text },
    subtitle: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    button: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: c.cancelBg },
    deleteButton: { backgroundColor: c.danger },
    buttonLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
    cancelLabel: { color: c.cancelText },
});
