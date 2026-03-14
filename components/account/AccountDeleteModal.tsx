import { useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';

export type AccountDeleteModalProps = { visible: boolean; onClose: () => void; onConfirm: () => Promise<void> | void };

export default function AccountDeleteModal({ visible, onClose, onConfirm }: AccountDeleteModalProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <MaterialCommunityIcons name="alert-circle" size={36} color={colors.danger} />
                    </View>
                    <Text style={styles.title}>Delete your account?</Text>
                    <Text style={styles.message}>This will permanently remove your profile, passwords, and notes from Secure Vault. This action cannot be undone.</Text>
                    <View style={styles.buttonRow}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}><Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text></Pressable>
                        <Pressable style={[styles.button, styles.deleteButton]} onPress={onConfirm}><Text style={styles.buttonLabel}>Yes, delete</Text></Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    card: { backgroundColor: c.surfaceSolid, borderRadius: 28, padding: 28, gap: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 12, borderWidth: 1, borderColor: c.border },
    iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: c.dangerBg, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: c.text },
    message: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    button: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: c.cancelBg },
    deleteButton: { backgroundColor: c.danger },
    buttonLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
    cancelLabel: { color: c.cancelText },
});
