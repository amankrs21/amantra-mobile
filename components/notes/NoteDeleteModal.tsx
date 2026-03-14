import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export type NoteDeleteModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    title: string;
};

export default function NoteDeleteModal({ visible, onClose, onConfirm, title }: NoteDeleteModalProps) {
    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <Text style={styles.title}>Delete this note?</Text>
                    <Text style={styles.subtitle}>
                        You are about to remove <Text style={{ fontWeight: '700' }}>{title}</Text>. This action cannot be undone.
                    </Text>
                    <View style={styles.buttonRow}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}>
                            <Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text>
                        </Pressable>
                        <Pressable style={[styles.button, styles.deleteButton]} onPress={onConfirm}>
                            <Text style={styles.buttonLabel}>Delete</Text>
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
        borderRadius: 24,
        padding: 24,
        gap: 18,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(15, 23, 42, 0.65)',
        lineHeight: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
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
