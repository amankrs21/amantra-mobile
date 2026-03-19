import { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';

export type EncryptionKeyModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (key: string) => Promise<void> | void;
    caption?: string;
    onBiometric?: () => Promise<void> | void;
    biometricAvailable?: boolean;
};

export default function EncryptionKeyModal({
    visible,
    onClose,
    onConfirm,
    caption,
    onBiometric,
    biometricAvailable,
}: EncryptionKeyModalProps) {
    const [key, setKey] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        if (visible) setKey('');
    }, [visible]);

    useEffect(() => {
        if (visible && biometricAvailable && onBiometric) {
            void onBiometric();
        }
    }, [visible]); // intentionally minimal deps

    const handleSubmit = async () => {
        if (!key.trim()) return;
        setIsSubmitting(true);
        try { await onConfirm(key.trim()); setKey(''); }
        finally { setIsSubmitting(false); }
    };

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <Text style={styles.title}>Enter Encryption PIN</Text>
                    <Text style={styles.subtitle}>{caption ?? 'Enter your encryption PIN to securely access your data.'}</Text>

                    {biometricAvailable && onBiometric ? (
                        <Pressable style={styles.biometricButton} onPress={onBiometric}>
                            <MaterialCommunityIcons name="fingerprint" size={32} color={colors.tint} />
                            <Text style={styles.biometricLabel}>Tap to unlock with biometrics</Text>
                        </Pressable>
                    ) : null}

                    <View style={styles.pinRow}>
                        <TextInput value={key} onChangeText={setKey} placeholder="Enter your encryption PIN" placeholderTextColor={colors.placeholder} autoFocus={!biometricAvailable} secureTextEntry={!showPin} autoCapitalize="none" style={[styles.input, styles.pinInput]} />
                        <Pressable style={styles.eyeButton} onPress={() => setShowPin(v => !v)}>
                            <MaterialCommunityIcons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                        </Pressable>
                    </View>
                    <View style={styles.buttonRow}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={isSubmitting}>
                            <Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text>
                        </Pressable>
                        <Pressable style={[styles.button, styles.confirmButton, (!key.trim() || isSubmitting) && styles.disabledButton]} onPress={handleSubmit} disabled={!key.trim() || isSubmitting}>
                            <Text style={styles.buttonLabel}>{isSubmitting ? 'Saving…' : 'Continue'}</Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    card: { backgroundColor: c.surfaceSolid, borderRadius: 24, padding: 24, gap: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: c.border },
    title: { fontSize: 20, fontWeight: '700', color: c.text },
    subtitle: { fontSize: 14, color: c.textSecondary },
    biometricButton: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: c.biometricBg, borderRadius: 16, borderWidth: 1, borderColor: c.biometricBorder },
    biometricLabel: { fontSize: 13, fontWeight: '600', color: c.tint },
    input: { borderWidth: 1, borderColor: c.inputBorder, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: c.text, backgroundColor: c.inputBg },
    pinRow: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 16, backgroundColor: c.inputBg },
    pinInput: { flex: 1, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
    eyeButton: { paddingHorizontal: 16, paddingVertical: 12 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    button: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: c.cancelBg },
    confirmButton: { backgroundColor: c.tint },
    buttonLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
    cancelLabel: { color: c.cancelText },
    disabledButton: { opacity: 0.6 },
});
