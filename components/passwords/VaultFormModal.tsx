import { useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';

import CategoryPicker from '@/components/ui/CategoryPicker';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import { type CategoryDef } from '@/utils/categories';
import { DEFAULT_PASSWORD_OPTIONS, generatePassword, type PasswordOptions } from '@/utils/password-generator';

type VaultFormValues = { title: string; username: string; password: string; category?: string | null };
type VaultFormModalProps = {
    visible: boolean; mode: 'create' | 'edit'; initialValues?: Partial<VaultFormValues>;
    onClose: () => void; onSubmit: (values: VaultFormValues) => Promise<void> | void;
    categoryKey?: string | null; categories?: CategoryDef[];
};

const EMPTY_VALUES: VaultFormValues = { title: '', username: '', password: '' };

export default function VaultFormModal({ visible, mode, initialValues, onClose, onSubmit, categoryKey, categories }: VaultFormModalProps) {
    const [formValues, setFormValues] = useState<VaultFormValues>(EMPTY_VALUES);
    const [localCategory, setLocalCategory] = useState<string | null>(categoryKey ?? null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [generatorOptions, setGeneratorOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
    const [generatedPassword, setGeneratedPassword] = useState('');
    const [showPasswordField, setShowPasswordField] = useState(false);
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const gStyles = useMemo(() => createGenStyles(colors), [colors]);

    useEffect(() => {
        if (visible) {
            setFormValues({ title: initialValues?.title ?? '', username: initialValues?.username ?? '', password: initialValues?.password ?? '' });
            setLocalCategory(categoryKey ?? null);
            setShowGenerator(false); setGeneratedPassword(''); setGeneratorOptions(DEFAULT_PASSWORD_OPTIONS); setShowPasswordField(false);
        }
    }, [initialValues, visible]);

    const handleChange = (field: keyof VaultFormValues, value: string) => setFormValues((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async () => {
        if (!formValues.title.trim() || !formValues.username.trim() || !formValues.password.trim()) { toast.info('Please fill out all fields.'); return; }
        setIsSubmitting(true);
        try { await onSubmit({ title: formValues.title.trim(), username: formValues.username.trim(), password: formValues.password.trim(), category: localCategory }); onClose(); }
        catch (error) { console.error('Vault form submission failed', error); }
        finally { setIsSubmitting(false); }
    };

    const handleGenerate = () => setGeneratedPassword(generatePassword(generatorOptions));
    const handleUseGenerated = () => { if (generatedPassword) { handleChange('password', generatedPassword); setShowGenerator(false); toast.success('Password applied.'); } };
    const handleCopyGenerated = async () => { if (generatedPassword) { await Clipboard.setStringAsync(generatedPassword); toast.success('Password copied to clipboard.'); } };
    const toggleOption = (key: keyof Omit<PasswordOptions, 'length'>) => setGeneratorOptions((prev) => ({ ...prev, [key]: !prev[key] }));

    const renderOptionChip = (key: keyof Omit<PasswordOptions, 'length'>, label: string) => {
        const active = generatorOptions[key];
        return (<Pressable key={key} style={[gStyles.chip, active && gStyles.chipActive]} onPress={() => toggleOption(key)}><Text style={[gStyles.chipLabel, active && gStyles.chipLabelActive]}>{label}</Text></Pressable>);
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
                        <Text style={styles.sheetTitle}>{mode === 'create' ? 'Add Password' : 'Update Password'}</Text>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Title *</Text>
                            <TextInput style={styles.input} placeholder="e.g. Github" placeholderTextColor={colors.placeholder} value={formValues.title} autoCapitalize="words" onChangeText={(v) => handleChange('title', v)} />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Username / Email *</Text>
                            <TextInput style={styles.input} placeholder="Enter username" placeholderTextColor={colors.placeholder} value={formValues.username} autoCapitalize="none" onChangeText={(v) => handleChange('username', v)} />
                        </View>

                        <View style={styles.fieldGroup}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Password *</Text>
                                <Pressable style={gStyles.toggleButton} onPress={() => setShowGenerator((prev) => !prev)}>
                                    <MaterialCommunityIcons name="auto-fix" size={16} color={colors.tint} />
                                    <Text style={gStyles.toggleLabel}>{showGenerator ? 'Hide Generator' : 'Generate'}</Text>
                                </Pressable>
                            </View>
                            <View style={styles.passwordRow}>
                                <TextInput style={[styles.input, styles.passwordInput]} placeholder="Enter password" placeholderTextColor={colors.placeholder} value={formValues.password} secureTextEntry={!showPasswordField} autoCapitalize="none" onChangeText={(v) => handleChange('password', v)} />
                                <Pressable style={styles.eyeButton} onPress={() => setShowPasswordField((prev) => !prev)}>
                                    <MaterialCommunityIcons name={showPasswordField ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                                </Pressable>
                            </View>
                        </View>

                        {categories ? (
                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Category</Text>
                                <CategoryPicker categories={categories} selected={localCategory} onSelect={setLocalCategory} />
                            </View>
                        ) : null}

                        {showGenerator ? (
                            <View style={gStyles.container}>
                                <Text style={gStyles.sectionLabel}>Password Generator</Text>
                                <View style={gStyles.lengthRow}>
                                    <Text style={gStyles.lengthLabel}>Length: {generatorOptions.length}</Text>
                                    <View style={gStyles.lengthControls}>
                                        <Pressable style={gStyles.lengthButton} onPress={() => setGeneratorOptions((prev) => ({ ...prev, length: Math.max(8, prev.length - 1) }))}>
                                            <MaterialCommunityIcons name="minus" size={18} color={colors.text} />
                                        </Pressable>
                                        <View style={gStyles.lengthBar}>
                                            <View style={[gStyles.lengthFill, { width: `${((generatorOptions.length - 8) / 24) * 100}%` }]} />
                                        </View>
                                        <Pressable style={gStyles.lengthButton} onPress={() => setGeneratorOptions((prev) => ({ ...prev, length: Math.min(32, prev.length + 1) }))}>
                                            <MaterialCommunityIcons name="plus" size={18} color={colors.text} />
                                        </Pressable>
                                    </View>
                                </View>
                                <View style={gStyles.chipRow}>
                                    {renderOptionChip('uppercase', 'A-Z')}
                                    {renderOptionChip('lowercase', 'a-z')}
                                    {renderOptionChip('numbers', '0-9')}
                                    {renderOptionChip('symbols', '!@#')}
                                </View>
                                <Pressable style={gStyles.generateButton} onPress={handleGenerate}>
                                    <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
                                    <Text style={gStyles.generateLabel}>Generate</Text>
                                </Pressable>
                                {generatedPassword ? (
                                    <View style={gStyles.resultContainer}>
                                        <Text style={gStyles.resultText} selectable numberOfLines={2}>{generatedPassword}</Text>
                                        <View style={gStyles.resultActions}>
                                            <Pressable style={gStyles.resultButton} onPress={handleUseGenerated}>
                                                <MaterialCommunityIcons name="check" size={18} color="#fff" />
                                                <Text style={gStyles.resultButtonLabel}>Use</Text>
                                            </Pressable>
                                            <Pressable style={[gStyles.resultButton, gStyles.copyButton]} onPress={handleCopyGenerated}>
                                                <MaterialCommunityIcons name="content-copy" size={16} color={colors.tint} />
                                                <Text style={gStyles.copyButtonLabel}>Copy</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}

                        <View style={styles.buttonRow}>
                            <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={isSubmitting}>
                                <Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.button, styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={isSubmitting}>
                                <Text style={styles.buttonLabel}>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Add Password' : 'Save Changes'}</Text>
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
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    input: { borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: c.text, backgroundColor: c.inputBg },
    passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.inputBg },
    passwordInput: { flex: 1, borderWidth: 0, borderRadius: 0, paddingVertical: 12 },
    eyeButton: { paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    button: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: c.border },
    submitButton: { backgroundColor: c.accent },
    buttonLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
    cancelLabel: { color: c.text },
});

const createGenStyles = (c: ThemeColors) => StyleSheet.create({
    toggleButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    toggleLabel: { fontSize: 13, fontWeight: '600', color: c.tint },
    container: { backgroundColor: c.generatorBg, borderRadius: 16, padding: 16, gap: 14, marginBottom: 16 },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: c.text },
    lengthRow: { gap: 8 },
    lengthLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    lengthControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    lengthButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.chipBg, alignItems: 'center', justifyContent: 'center' },
    lengthBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.chipBg, overflow: 'hidden' },
    lengthFill: { height: '100%', backgroundColor: c.tint, borderRadius: 3 },
    chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: c.chipBg },
    chipActive: { backgroundColor: c.tint },
    chipLabel: { fontSize: 13, fontWeight: '600', color: c.chipText },
    chipLabelActive: { color: '#fff' },
    generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.tint, paddingVertical: 10, borderRadius: 12 },
    generateLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
    resultContainer: { backgroundColor: c.inputBg, borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: c.border },
    resultText: { fontSize: 15, fontWeight: '600', fontFamily: 'monospace', color: c.text, letterSpacing: 0.5 },
    resultActions: { flexDirection: 'row', gap: 8 },
    resultButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.tint, paddingVertical: 8, borderRadius: 10 },
    resultButtonLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
    copyButton: { backgroundColor: c.biometricBg },
    copyButtonLabel: { fontSize: 13, fontWeight: '600', color: c.tint },
});
