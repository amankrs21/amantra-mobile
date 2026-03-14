import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export type AccountDeleteModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
};

export default function AccountDeleteModal({ visible, onClose, onConfirm }: AccountDeleteModalProps) {
    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <MaterialCommunityIcons name="alert-circle" size={36} color="#ef4444" />
                    </View>
                    <Text style={styles.title}>Delete your account?</Text>
                    <Text style={styles.message}>
                        This will permanently remove your profile, passwords, and notes from Secure Vault. This action cannot be undone.
                    </Text>
                    <View style={styles.buttonRow}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}>
                            <Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text>
                        </Pressable>
                        <Pressable style={[styles.button, styles.deleteButton]} onPress={onConfirm}>
                            <Text style={styles.buttonLabel}>Yes, delete</Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 28,
        gap: 16,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    message: {
        fontSize: 14,
        color: 'rgba(15, 23, 42, 0.65)',
        lineHeight: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    button: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
    },
    deleteButton: {
        backgroundColor: '#ef4444',
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    cancelLabel: {
        color: '#0f172a',
    },
});
