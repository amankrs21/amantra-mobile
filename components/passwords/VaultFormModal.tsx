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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';

import CategoryPicker from '@/components/ui/CategoryPicker';
import { Colors } from '@/constants/theme';
import { type CategoryDef } from '@/utils/categories';
import {
    DEFAULT_PASSWORD_OPTIONS,
    generatePassword,
    type PasswordOptions,
} from '@/utils/password-generator';

type VaultFormValues = {
    title: string;
    username: string;
    password: string;
};

type VaultFormModalProps = {
    visible: boolean;
    mode: 'create' | 'edit';
    initialValues?: Partial<VaultFormValues>;
    onClose: () => void;
    onSubmit: (values: VaultFormValues) => Promise<void> | void;
    categoryKey?: string | null;
    onCategoryChange?: (key: string | null) => void;
    categories?: CategoryDef[];
};

const EMPTY_VALUES: VaultFormValues = {
    title: '',
    username: '',
    password: '',
};

export default function VaultFormModal({ visible, mode, initialValues, onClose, onSubmit, categoryKey, onCategoryChange, categories }: VaultFormModalProps) {
    const [formValues, setFormValues] = useState<VaultFormValues>(EMPTY_VALUES);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [generatorOptions, setGeneratorOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
    const [generatedPassword, setGeneratedPassword] = useState('');
    const [showPasswordField, setShowPasswordField] = useState(false);

    useEffect(() => {
        if (visible) {
            setFormValues({
                title: initialValues?.title ?? '',
                username: initialValues?.username ?? '',
                password: initialValues?.password ?? '',
            });
            setShowGenerator(false);
            setGeneratedPassword('');
            setGeneratorOptions(DEFAULT_PASSWORD_OPTIONS);
            setShowPasswordField(false);
        }
    }, [initialValues, visible]);

    const handleChange = (field: keyof VaultFormValues, value: string) => {
        setFormValues((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (!formValues.title.trim() || !formValues.username.trim() || !formValues.password.trim()) {
            Toast.show({ type: 'info', text1: 'Please fill out all fields.' });
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                title: formValues.title.trim(),
                username: formValues.username.trim(),
                password: formValues.password.trim(),
            });
            onClose();
        } catch (error) {
            console.error('Vault form submission failed', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerate = () => {
        const password = generatePassword(generatorOptions);
        setGeneratedPassword(password);
    };

    const handleUseGenerated = () => {
        if (generatedPassword) {
            handleChange('password', generatedPassword);
            setShowGenerator(false);
            Toast.show({ type: 'success', text1: 'Password applied.' });
        }
    };

    const handleCopyGenerated = async () => {
        if (generatedPassword) {
            await Clipboard.setStringAsync(generatedPassword);
            Toast.show({ type: 'success', text1: 'Password copied to clipboard.' });
        }
    };

    const toggleOption = (key: keyof Omit<PasswordOptions, 'length'>) => {
        setGeneratorOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const renderOptionChip = (key: keyof Omit<PasswordOptions, 'length'>, label: string) => {
        const active = generatorOptions[key];
        return (
            <Pressable
                key={key}
                style={[genStyles.chip, active && genStyles.chipActive]}
                onPress={() => toggleOption(key)}
            >
                <Text style={[genStyles.chipLabel, active && genStyles.chipLabelActive]}>{label}</Text>
            </Pressable>
        );
    };

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <Text style={styles.title}>{mode === 'create' ? 'Add Password' : 'Update Password'}</Text>
                    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                        <View style={styles.field}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Github"
                                placeholderTextColor="rgba(15, 23, 42, 0.35)"
                                value={formValues.title}
                                autoCapitalize="words"
                                onChangeText={(value) => handleChange('title', value)}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Username / Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter username"
                                placeholderTextColor="rgba(15, 23, 42, 0.35)"
                                value={formValues.username}
                                autoCapitalize="none"
                                onChangeText={(value) => handleChange('username', value)}
                            />
                        </View>
                        <View style={styles.field}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Password</Text>
                                <Pressable
                                    style={genStyles.toggleButton}
                                    onPress={() => setShowGenerator((prev) => !prev)}
                                >
                                    <MaterialCommunityIcons
                                        name="auto-fix"
                                        size={16}
                                        color={Colors.light.tint}
                                    />
                                    <Text style={genStyles.toggleLabel}>
                                        {showGenerator ? 'Hide Generator' : 'Generate'}
                                    </Text>
                                </Pressable>
                            </View>
                            <View style={styles.passwordRow}>
                                <TextInput
                                    style={[styles.input, styles.passwordInput]}
                                    placeholder="Enter password"
                                    placeholderTextColor="rgba(15, 23, 42, 0.35)"
                                    value={formValues.password}
                                    secureTextEntry={!showPasswordField}
                                    autoCapitalize="none"
                                    onChangeText={(value) => handleChange('password', value)}
                                />
                                <Pressable style={styles.eyeButton} onPress={() => setShowPasswordField((prev) => !prev)}>
                                    <MaterialCommunityIcons
                                        name={showPasswordField ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="rgba(15, 23, 42, 0.6)"
                                    />
                                </Pressable>
                            </View>
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

                        {showGenerator ? (
                            <View style={genStyles.container}>
                                <Text style={genStyles.sectionLabel}>Password Generator</Text>

                                <View style={genStyles.lengthRow}>
                                    <Text style={genStyles.lengthLabel}>Length: {generatorOptions.length}</Text>
                                    <View style={genStyles.lengthControls}>
                                        <Pressable
                                            style={genStyles.lengthButton}
                                            onPress={() =>
                                                setGeneratorOptions((prev) => ({
                                                    ...prev,
                                                    length: Math.max(8, prev.length - 1),
                                                }))
                                            }
                                        >
                                            <MaterialCommunityIcons name="minus" size={18} color="#0f172a" />
                                        </Pressable>
                                        <View style={genStyles.lengthBar}>
                                            <View
                                                style={[
                                                    genStyles.lengthFill,
                                                    { width: `${((generatorOptions.length - 8) / 24) * 100}%` },
                                                ]}
                                            />
                                        </View>
                                        <Pressable
                                            style={genStyles.lengthButton}
                                            onPress={() =>
                                                setGeneratorOptions((prev) => ({
                                                    ...prev,
                                                    length: Math.min(32, prev.length + 1),
                                                }))
                                            }
                                        >
                                            <MaterialCommunityIcons name="plus" size={18} color="#0f172a" />
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={genStyles.chipRow}>
                                    {renderOptionChip('uppercase', 'A-Z')}
                                    {renderOptionChip('lowercase', 'a-z')}
                                    {renderOptionChip('numbers', '0-9')}
                                    {renderOptionChip('symbols', '!@#')}
                                </View>

                                <Pressable style={genStyles.generateButton} onPress={handleGenerate}>
                                    <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
                                    <Text style={genStyles.generateLabel}>Generate</Text>
                                </Pressable>

                                {generatedPassword ? (
                                    <View style={genStyles.resultContainer}>
                                        <Text style={genStyles.resultText} selectable numberOfLines={2}>
                                            {generatedPassword}
                                        </Text>
                                        <View style={genStyles.resultActions}>
                                            <Pressable style={genStyles.resultButton} onPress={handleUseGenerated}>
                                                <MaterialCommunityIcons name="check" size={18} color="#fff" />
                                                <Text style={genStyles.resultButtonLabel}>Use</Text>
                                            </Pressable>
                                            <Pressable
                                                style={[genStyles.resultButton, genStyles.copyButton]}
                                                onPress={handleCopyGenerated}
                                            >
                                                <MaterialCommunityIcons name="content-copy" size={16} color={Colors.light.tint} />
                                                <Text style={genStyles.copyButtonLabel}>Copy</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ) : null}
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
                            <Text style={styles.buttonLabel}>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Add Password' : 'Save Changes'}</Text>
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
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.12)',
        backgroundColor: '#fff',
    },
    passwordInput: {
        flex: 1,
        borderWidth: 0,
        borderRadius: 0,
        paddingVertical: 12,
    },
    eyeButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
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

const genStyles = StyleSheet.create({
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    toggleLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.light.tint,
    },
    container: {
        backgroundColor: 'rgba(15, 23, 42, 0.04)',
        borderRadius: 16,
        padding: 16,
        gap: 14,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    lengthRow: {
        gap: 8,
    },
    lengthLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.7)',
    },
    lengthControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    lengthButton: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lengthBar: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(15, 23, 42, 0.1)',
        overflow: 'hidden',
    },
    lengthFill: {
        height: '100%',
        backgroundColor: Colors.light.tint,
        borderRadius: 3,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
    },
    chipActive: {
        backgroundColor: Colors.light.tint,
    },
    chipLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    chipLabelActive: {
        color: '#fff',
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.light.tint,
        paddingVertical: 10,
        borderRadius: 12,
    },
    generateLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    resultContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.08)',
    },
    resultText: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'monospace',
        color: '#0f172a',
        letterSpacing: 0.5,
    },
    resultActions: {
        flexDirection: 'row',
        gap: 8,
    },
    resultButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: Colors.light.tint,
        paddingVertical: 8,
        borderRadius: 10,
    },
    resultButtonLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    copyButton: {
        backgroundColor: 'rgba(10, 126, 164, 0.12)',
    },
    copyButtonLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.light.tint,
    },
});
