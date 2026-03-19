import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import CategoryPicker from '@/components/ui/CategoryPicker';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import { type CategoryDef } from '@/utils/categories';

type NoteFormValues = { title: string; content: string };
type NoteFormModalProps = {
    visible: boolean; mode: 'create' | 'edit'; initialValues?: Partial<NoteFormValues>;
    onClose: () => void; onSubmit: (values: NoteFormValues) => Promise<void> | void;
    categoryKey?: string | null; onCategoryChange?: (key: string | null) => void; categories?: CategoryDef[];
};

const EMPTY_VALUES: NoteFormValues = { title: '', content: '' };

export default function NoteFormModal({ visible, mode, initialValues, onClose, onSubmit, categoryKey, onCategoryChange, categories }: NoteFormModalProps) {
    const [formValues, setFormValues] = useState<NoteFormValues>(EMPTY_VALUES);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => { if (visible) setFormValues({ title: initialValues?.title ?? '', content: initialValues?.content ?? '' }); }, [initialValues, visible]);

    const handleSubmit = async () => {
        if (!formValues.title.trim() || !formValues.content.trim()) { toast.info('Title and content are required.'); return; }
        setIsSubmitting(true);
        try { await onSubmit({ title: formValues.title.trim(), content: formValues.content.trim() }); onClose(); }
        catch (error) { console.error('Note form submission failed', error); }
        finally { setIsSubmitting(false); }
    };

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <KeyboardAvoidingView
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={0}
                >
                <View style={styles.sheet}>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={styles.handleBar} />
                        <Text style={styles.sheetTitle}>{mode === 'create' ? 'Add Secure Note' : 'Update Note'}</Text>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Title *</Text>
                            <TextInput style={styles.input} placeholder="e.g. Daily reflections" placeholderTextColor={colors.placeholder} value={formValues.title} autoCapitalize="words" onChangeText={(text) => setFormValues((prev) => ({ ...prev, title: text }))} />
                        </View>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Content *</Text>
                            <TextInput style={[styles.input, styles.textArea]} placeholder="Write your thoughts securely..." placeholderTextColor={colors.placeholder} value={formValues.content} multiline autoCapitalize="sentences" onChangeText={(text) => setFormValues((prev) => ({ ...prev, content: text }))} />
                        </View>
                        {categories && onCategoryChange ? (
                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Category</Text>
                                <CategoryPicker categories={categories} selected={categoryKey ?? null} onSelect={onCategoryChange} />
                            </View>
                        ) : null}

                        <View style={styles.buttonRow}>
                            <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={isSubmitting}>
                                <Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.button, styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={isSubmitting}>
                                <Text style={styles.buttonLabel}>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Add Note' : 'Save Changes'}</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.surfaceSolid, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%', borderWidth: 1, borderColor: c.border },
    handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.textTertiary, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 20 },
    fieldGroup: { gap: 6, marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    input: { borderWidth: 1, borderColor: c.inputBorder, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: c.text, backgroundColor: c.inputBg },
    textArea: { minHeight: 140, textAlignVertical: 'top' },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    button: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: c.border },
    submitButton: { backgroundColor: c.accent },
    buttonLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
    cancelLabel: { color: c.text },
});
