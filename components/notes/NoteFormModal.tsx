import { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';

import CategoryPicker from '@/components/ui/CategoryPicker';
import { Colors } from '@/constants/theme';
import { type CategoryDef } from '@/utils/categories';

type NoteFormValues = {
    title: string;
    content: string;
};

type NoteFormModalProps = {
    visible: boolean;
    mode: 'create' | 'edit';
    initialValues?: Partial<NoteFormValues>;
    onClose: () => void;
    onSubmit: (values: NoteFormValues) => Promise<void> | void;
    categoryKey?: string | null;
    onCategoryChange?: (key: string | null) => void;
    categories?: CategoryDef[];
};

const EMPTY_VALUES: NoteFormValues = {
    title: '',
    content: '',
};

export default function NoteFormModal({ visible, mode, initialValues, onClose, onSubmit, categoryKey, onCategoryChange, categories }: NoteFormModalProps) {
    const [formValues, setFormValues] = useState<NoteFormValues>(EMPTY_VALUES);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (visible) {
            setFormValues({
                title: initialValues?.title ?? '',
                content: initialValues?.content ?? '',
            });
        }
    }, [initialValues, visible]);

    const handleSubmit = async () => {
        if (!formValues.title.trim() || !formValues.content.trim()) {
            Toast.show({ type: 'info', text1: 'Title and content are required.' });
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                title: formValues.title.trim(),
                content: formValues.content.trim(),
            });
            onClose();
        } catch (error) {
            console.error('Note form submission failed', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <Text style={styles.title}>{mode === 'create' ? 'Add Secure Note' : 'Update Note'}</Text>
                    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                        <View style={styles.field}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Daily reflections"
                                placeholderTextColor="rgba(15, 23, 42, 0.35)"
                                value={formValues.title}
                                autoCapitalize="words"
                                onChangeText={(text) => setFormValues((prev) => ({ ...prev, title: text }))}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Content</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Write your thoughts securely..."
                                placeholderTextColor="rgba(15, 23, 42, 0.35)"
                                value={formValues.content}
                                multiline
                                autoCapitalize="sentences"
                                onChangeText={(text) => setFormValues((prev) => ({ ...prev, content: text }))}
                            />
                        </View>
                        {categories && onCategoryChange ? (
                            <View style={styles.field}>
                                <Text style={styles.label}>Category</Text>
                                <CategoryPicker
                                    categories={categories}
                                    selected={categoryKey ?? null}
                                    onSelect={onCategoryChange}
                                />
                            </View>
                        ) : null}
                    </ScrollView>
                    <View style={styles.buttonRow}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={isSubmitting}>
                            <Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.button, styles.submitButton, isSubmitting && styles.disabledButton]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.buttonLabel}>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Add Note' : 'Save Changes'}</Text>
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
        backgroundColor: 'rgba(2, 6, 23, 0.65)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        maxHeight: '90%',
        gap: 16,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    form: {
        gap: 16,
    },
    field: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.7)',
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.12)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#0f172a',
    },
    textArea: {
        minHeight: 160,
        textAlignVertical: 'top',
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
    submitButton: {
        backgroundColor: Colors.light.tint,
    },
    disabledButton: {
        opacity: 0.6,
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
