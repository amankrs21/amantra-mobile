import { useCallback, useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import api from '@/services/api';
import { useAuth } from '@/hooks/use-auth';
import { useLoading } from '@/hooks/use-loading';

WebBrowser.maybeCompleteAuthSession();

const GoogleLoginResponseSchema = z.object({
    token: z.string().min(10),
    user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        avatarUrl: z.string().url().optional().nullable(),
    }),
    encryptionKeyConfigured: z.boolean().optional(),
});

const EmailLoginResponseSchema = z.object({
    token: z.string().min(10),
    user: z.object({
        _id: z.string(),
        name: z.string(),
        email: z.string().email(),
        textVerify: z.string().nullable().optional(),
    }),
});

type GoogleLoginResponse = z.infer<typeof GoogleLoginResponseSchema>;

const FALLBACK_CLIENT_ID = 'demo_client_id';

const rawAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const rawWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

const androidClientId = rawAndroidClientId && rawAndroidClientId !== FALLBACK_CLIENT_ID ? rawAndroidClientId : undefined;
const webClientId = rawWebClientId && rawWebClientId !== FALLBACK_CLIENT_ID ? rawWebClientId : undefined;

const activeClientId = Platform.OS === 'web' ? webClientId : androidClientId;
const isClientConfiguredForPlatform = Boolean(activeClientId);
const redirectUri = makeRedirectUri({
    scheme: 'amantra',
    path: 'auth',
    preferLocalhost: true,
    native: 'amantra://auth',
});

export default function WelcomeScreen() {
    const router = useRouter();
    const { isAuthenticated, completeLogin } = useAuth();
    const { showLoading, hideLoading } = useLoading();

    const [authMode, setAuthMode] = useState<'main' | 'email'>('main');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const authRequestConfig: Partial<Google.GoogleAuthRequestConfig> = {
        clientId: activeClientId ?? FALLBACK_CLIENT_ID,
        responseType: 'id_token',
        scopes: ['profile', 'email'],
        redirectUri,
    };

    if (androidClientId) {
        authRequestConfig.androidClientId = androidClientId;
    }

    if (webClientId) {
        authRequestConfig.webClientId = webClientId;
    }

    const [request, response, promptAsync] = Google.useAuthRequest(authRequestConfig);

    const handleGoogleResponse = useCallback(
        async (idToken: string) => {
            showLoading('Securing your vault...');
            try {
                const { data } = await api.post<GoogleLoginResponse>('/auth/google', {
                    idToken,
                });

                const parsed = GoogleLoginResponseSchema.safeParse(data);
                if (!parsed.success) {
                    throw new Error('Unexpected response from server.');
                }

                await completeLogin(parsed.data);
                Toast.show({ type: 'success', text1: `Welcome, ${parsed.data.user.name}!` });
            } catch (error) {
                console.error('Google login failed', error);
                Toast.show({
                    type: 'error',
                    text1: 'Unable to sign in',
                    text2: error instanceof Error ? error.message : 'Please try again in a moment.',
                });
            } finally {
                hideLoading();
            }
        },
        [completeLogin, hideLoading, showLoading],
    );

    useEffect(() => {
        if (response?.type === 'success' && response.authentication?.idToken) {
            handleGoogleResponse(response.authentication.idToken);
        } else if (response?.type === 'error') {
            Toast.show({ type: 'error', text1: 'Google sign-in cancelled.' });
        }
    }, [handleGoogleResponse, response]);

    const handleEmailLogin = useCallback(async () => {
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();

        if (!trimmedEmail || !trimmedPassword) {
            Toast.show({ type: 'info', text1: 'Please enter both email and password.' });
            return;
        }

        Keyboard.dismiss();
        setIsSubmitting(true);
        showLoading('Signing in...');
        try {
            const { data } = await api.post('/auth/login', {
                email: trimmedEmail,
                password: trimmedPassword,
            });

            const parsed = EmailLoginResponseSchema.safeParse(data);
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
                encryptionKeyConfigured: Boolean(user.textVerify),
            });

            Toast.show({ type: 'success', text1: `Welcome back, ${user.name}!` });
        } catch (error) {
            console.error('Email login failed', error);
            const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
            Toast.show({
                type: 'error',
                text1: 'Unable to sign in',
                text2: message ?? (error instanceof Error ? error.message : 'Check your credentials and try again.'),
            });
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    }, [completeLogin, email, hideLoading, password, showLoading]);

    if (isAuthenticated) {
        return <Redirect href="/(tabs)/home" />;
    }

    const googleDisabled = !request || !isClientConfiguredForPlatform;

    if (authMode === 'email') {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <LinearGradient colors={["#0f172a", "#1e3a8a", "#38bdf8"]} style={styles.miniHero}>
                        <MaterialCommunityIcons name="shield-lock" color="#fff" size={48} />
                        <Text style={styles.miniHeroTitle}>SecureVault</Text>
                    </LinearGradient>

                    <View style={styles.content}>
                        <Text style={styles.welcomeText}>Sign in with email</Text>
                        <Text style={styles.caption}>Enter your credentials to access your vault.</Text>

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
                                returnKeyType="next"
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.passwordRow}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Enter your password"
                                    placeholderTextColor="rgba(226, 232, 240, 0.4)"
                                    style={[styles.input, styles.passwordInput]}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="done"
                                    onSubmitEditing={handleEmailLogin}
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

                        <Pressable
                            style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
                            onPress={handleEmailLogin}
                            disabled={isSubmitting}
                        >
                            <MaterialCommunityIcons name="login" size={20} color="#fff" />
                            <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
                        </Pressable>

                        <View style={styles.linkRow}>
                            <Pressable onPress={() => router.push('/(auth)/register')}>
                                <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
                            </Pressable>
                        </View>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <Pressable style={styles.backButton} onPress={() => setAuthMode('main')}>
                            <MaterialCommunityIcons name="arrow-left" size={18} color="#e2e8f0" />
                            <Text style={styles.backLabel}>Back to sign-in options</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <LinearGradient colors={["#0f172a", "#1e3a8a", "#38bdf8"]} style={styles.heroCard}>
                <View style={styles.heroIconRow}>
                    <MaterialCommunityIcons name="shield-lock" color="#fff" size={72} />
                    <MaterialCommunityIcons name="note-text" color="#facc15" size={48} />
                    <MaterialCommunityIcons name="key-variant" color="#22d3ee" size={56} />
                </View>
                <Text style={styles.heroTitle}>SecureVault</Text>
                <Text style={styles.heroSubtitle}>
                    Keep passwords and private notes safe with encryption you control.
                </Text>
            </LinearGradient>

            <View style={styles.content}>
                <Text style={styles.welcomeText}>Welcome to your personal digital fortress.</Text>
                <Text style={styles.caption}>
                    Sign in to access your encrypted vault securely.
                </Text>

                <Pressable
                    style={[styles.emailButton]}
                    onPress={() => setAuthMode('email')}
                >
                    <MaterialCommunityIcons name="email-outline" size={24} color="#fff" />
                    <Text style={styles.emailLabel}>Continue with Email</Text>
                </Pressable>

                <Pressable
                    style={[styles.googleButton, googleDisabled && styles.disabledButton]}
                    onPress={() => promptAsync()}
                    disabled={googleDisabled}
                >
                    <MaterialCommunityIcons name="google" size={24} color="#fff" />
                    <Text style={styles.googleLabel}>Continue with Google</Text>
                </Pressable>

                {googleDisabled ? (
                    <Text style={styles.helper}>
                        {Platform.OS === 'web'
                            ? 'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in your environment to enable Google sign-in on the web.'
                            : 'Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in your environment to enable Google sign-in on Android.'}
                    </Text>
                ) : null}
            </View>
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
    heroCard: {
        margin: 24,
        marginBottom: 0,
        padding: 24,
        borderRadius: 28,
        minHeight: 280,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
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
    heroIconRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#f8fafc',
    },
    heroSubtitle: {
        fontSize: 16,
        color: 'rgba(248, 250, 252, 0.86)',
        lineHeight: 22,
    },
    content: {
        padding: 24,
        gap: 16,
    },
    welcomeText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#e2e8f0',
    },
    caption: {
        fontSize: 15,
        color: 'rgba(226, 232, 240, 0.75)',
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
    },
    primaryButtonLabel: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    emailButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 12,
        shadowColor: '#1d4ed8',
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },
    emailLabel: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(37, 99, 235, 0.3)',
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.5)',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 12,
    },
    googleLabel: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    helper: {
        fontSize: 12,
        color: 'rgba(226, 232, 240, 0.6)',
    },
    disabledButton: {
        opacity: 0.4,
    },
    linkRow: {
        alignItems: 'center',
    },
    linkText: {
        fontSize: 14,
        color: 'rgba(226, 232, 240, 0.7)',
    },
    linkBold: {
        fontWeight: '700',
        color: '#38bdf8',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(226, 232, 240, 0.2)',
    },
    dividerText: {
        fontSize: 13,
        color: 'rgba(226, 232, 240, 0.5)',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    backLabel: {
        fontSize: 15,
        color: 'rgba(226, 232, 240, 0.7)',
    },
});
