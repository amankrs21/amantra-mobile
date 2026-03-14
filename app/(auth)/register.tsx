import { useCallback, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import api from '@/services/api';
import { useAuth } from '@/hooks/use-auth';
import { useLoading } from '@/hooks/use-loading';
import { encodeKey } from '@/utils/crypto';

const RegisterResponseSchema = z.object({
    token: z.string().min(10),
    user: z.object({
        _id: z.string(),
        name: z.string(),
        email: z.string().email(),
    }),
});

export default function RegisterScreen() {
    const router = useRouter();
    const { completeLogin } = useAuth();
    const { showLoading, hideLoading } = useLoading();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [secretAnswer, setSecretAnswer] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isValid =
        name.trim().length > 0 &&
        email.trim().length > 0 &&
        password.trim().length >= 8 &&
        confirmPassword.trim().length >= 8 &&
        secretAnswer.trim().length >= 3;

    const handleRegister = useCallback(async () => {
        if (!isValid) {
            Toast.show({ type: 'info', text1: 'Please fill all fields correctly.' });
            return;
        }

        if (password !== confirmPassword) {
            Toast.show({ type: 'error', text1: 'Passwords do not match.' });
            return;
        }

        Keyboard.dismiss();
        setIsSubmitting(true);
        showLoading('Creating your account...');
        try {
            const { data } = await api.post('/auth/register', {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password: password.trim(),
                secretAnswer: encodeKey(secretAnswer.trim()),
            });

            const parsed = RegisterResponseSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error('Unexpected response from server.');
            }

            const { token, user } = parsed.data;
            await completeLogin({
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                },
                encryptionKeyConfigured: false,
            });

            Toast.show({ type: 'success', text1: `Welcome, ${user.name}!`, text2: 'Your account has been created.' });
        } catch (error) {
            console.error('Registration failed', error);
            const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
            Toast.show({
                type: 'error',
                text1: 'Registration failed',
                text2: message ?? (error instanceof Error ? error.message : 'Please try again.'),
            });
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    }, [completeLogin, confirmPassword, email, hideLoading, isValid, name, password, secretAnswer, showLoading]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <LinearGradient colors={["#0f172a", "#1e3a8a", "#38bdf8"]} style={styles.miniHero}>
                    <MaterialCommunityIcons name="shield-lock" color="#fff" size={48} />
                    <View>
                        <Text style={styles.miniHeroTitle}>SecureVault</Text>
                        <Text style={styles.miniHeroSubtitle}>Create your account</Text>
                    </View>
                </LinearGradient>

                <View style={styles.content}>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Full name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Your name"
                            placeholderTextColor="rgba(226, 232, 240, 0.4)"
                            style={styles.input}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@example.com"
                            placeholderTextColor="rgba(226, 232, 240, 0.4)"
                            style={styles.input}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Password (min 8 characters)</Text>
                        <View style={styles.passwordRow}>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Choose a strong password"
                                placeholderTextColor="rgba(226, 232, 240, 0.4)"
                                style={[styles.input, styles.passwordInput]}
                                secureTextEntry={!showPassword}
                            />
                            <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                                <MaterialCommunityIcons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color="rgba(226, 232, 240, 0.6)"
                                />
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Confirm password</Text>
                        <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Re-enter your password"
                            placeholderTextColor="rgba(226, 232, 240, 0.4)"
                            style={styles.input}
                            secureTextEntry={!showPassword}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Favorite place (recovery question)</Text>
                        <TextInput
                            value={secretAnswer}
                            onChangeText={setSecretAnswer}
                            placeholder="Used to recover your account"
                            placeholderTextColor="rgba(226, 232, 240, 0.4)"
                            style={styles.input}
                            autoCapitalize="none"
                        />
                    </View>

                    <Pressable
                        style={[styles.primaryButton, (!isValid || isSubmitting) && styles.disabledButton]}
                        onPress={handleRegister}
                        disabled={!isValid || isSubmitting}
                    >
                        <MaterialCommunityIcons name="account-plus" size={20} color="#fff" />
                        <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Creating account…' : 'Create account'}</Text>
                    </Pressable>

                    <View style={styles.linkRow}>
                        <Pressable onPress={() => router.back()}>
                            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#020617',
    },
    scrollContent: {
        padding: 24,
        gap: 24,
        paddingBottom: 48,
    },
    miniHero: {
        padding: 24,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    miniHeroTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#f8fafc',
    },
    miniHeroSubtitle: {
        fontSize: 15,
        color: 'rgba(248, 250, 252, 0.7)',
        marginTop: 2,
    },
    content: {
        gap: 16,
    },
    fieldGroup: {
        gap: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(226, 232, 240, 0.8)',
    },
    input: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.15)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#f8fafc',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    passwordInput: {
        flex: 1,
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: 'transparent',
    },
    eyeButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 10,
        marginTop: 4,
        shadowColor: '#1d4ed8',
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },
    primaryButtonLabel: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    disabledButton: {
        opacity: 0.4,
    },
    linkRow: {
        alignItems: 'center',
        marginTop: 4,
    },
    linkText: {
        fontSize: 14,
        color: 'rgba(226, 232, 240, 0.7)',
    },
    linkBold: {
        fontWeight: '700',
        color: '#38bdf8',
    },
});
