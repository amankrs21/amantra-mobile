import { useCallback, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Native Google Sign-In (crashes in Expo Go, so we lazy-load)
let GoogleSignin: any = null;
let statusCodes: any = {};
if (!isExpoGo) {
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    statusCodes = mod.statusCodes;
}

import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { z } from 'zod';

import api from '@/services/api';
import { useAuth } from '@/hooks/use-auth';
import { useLoading } from '@/hooks/use-loading';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';

if (!isExpoGo && GoogleSignin) {
    GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
}

const GoogleLoginResponseSchema = z.object({
    token: z.string().min(10),
    message: z.string().optional(),
    user: z.object({ id: z.string(), name: z.string(), email: z.string().email(), avatarUrl: z.string().url().optional().nullable(), weatherCity: z.string().nullable().optional() }),
    isKeySet: z.boolean().optional(),
});

const EmailLoginResponseSchema = z.object({
    token: z.string().min(10),
    message: z.string().optional(),
    user: z.object({ id: z.string(), name: z.string(), email: z.string().email(), avatarUrl: z.string().nullable().optional(), textVerify: z.string().nullable().optional(), isVerified: z.boolean().optional(), dateOfBirth: z.string().nullable().optional(), weatherCity: z.string().nullable().optional() }),
    isKeySet: z.boolean().optional(),
});

type GoogleLoginResponse = z.infer<typeof GoogleLoginResponseSchema>;

export default function WelcomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isAuthenticated, completeLogin } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [authMode, setAuthMode] = useState<'main' | 'email'>('main');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleGoogleLogin = useCallback(async () => {
        if (!GoogleSignin) {
            toast.info('Google Sign-In is not available in Expo Go. Use a production build.');
            return;
        }
        showLoading('Signing in with Google...');
        try {
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();
            const idToken = response.data?.idToken;
            if (!idToken) { toast.error('No ID token received from Google.'); return; }

            const { data } = await api.post<GoogleLoginResponse>('/auth/google', { idToken });
            const parsed = GoogleLoginResponseSchema.safeParse(data);
            if (!parsed.success) throw new Error('Unexpected response from server.');
            const { token, user, isKeySet } = parsed.data;
            await completeLogin({ token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, weatherCity: user.weatherCity }, encryptionKeyConfigured: Boolean(isKeySet) });
            toast.success(`Welcome, ${parsed.data.user.name}!`);
        } catch (error: any) {
            if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
                toast.info('Sign-in cancelled.');
            } else if (error?.code === statusCodes.IN_PROGRESS) {
                toast.info('Sign-in already in progress.');
            } else if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                toast.error('Google Play Services not available.');
            } else {
                const message = error?.response?.data?.message ?? error?.message ?? 'Please try again.';
                toast.error('Unable to sign in', { description: message });
            }
        } finally { hideLoading(); }
    }, [completeLogin, hideLoading, showLoading]);

    const handleEmailLogin = useCallback(async () => {
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();
        if (!trimmedEmail || !trimmedPassword) { toast.info('Please enter both email and password.'); return; }

        Keyboard.dismiss(); setIsSubmitting(true); showLoading('Signing in...');
        try {
            const { data } = await api.post('/auth/login', { email: trimmedEmail, password: trimmedPassword });
            const parsed = EmailLoginResponseSchema.safeParse(data);
            if (!parsed.success) throw new Error('Unexpected response from server.');
            const { token, user, isKeySet } = parsed.data;
            await completeLogin({ token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, weatherCity: user.weatherCity }, encryptionKeyConfigured: Boolean(isKeySet) });
            toast.success(`Welcome back, ${user.name}!`);
        } catch (error) {
            const message = (error as any)?.response?.data?.message;
            if (message && typeof message === 'string' && message.toLowerCase().includes('not verified')) {
                toast.info('Please verify your email first.');
                router.push({ pathname: '/(auth)/verify-otp', params: { email: email.trim().toLowerCase(), mode: 'verify' } });
            } else {
                toast.error('Unable to sign in', { description: message ?? 'Check your credentials and try again.' });
            }
        } finally { setIsSubmitting(false); hideLoading(); }
    }, [completeLogin, email, hideLoading, password, showLoading]);

    if (isAuthenticated) return <Redirect href="/(tabs)/home" />;

    if (authMode === 'email') {
        return (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={[styles.screen, { paddingTop: insets.top }]}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <LinearGradient colors={[...colors.headerGradient]} style={styles.miniHero}>
                        <Image source={require("@/assets/images/logo.png")} style={{ width: 44, height: 44, borderRadius: 10 }} />
                        <Text style={styles.miniHeroTitle}>Amantra</Text>
                    </LinearGradient>

                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Sign in with email</Text>
                        <Text style={styles.formCaption}>Enter your credentials to access your vault.</Text>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.placeholder} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.passwordRow}>
                                <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor={colors.placeholder} style={[styles.input, styles.passwordInput]} secureTextEntry={!showPassword} returnKeyType="done" onSubmitEditing={handleEmailLogin} />
                                <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                                    <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                                </Pressable>
                            </View>
                        </View>

                        <Pressable style={[styles.primaryButton, isSubmitting && styles.disabledButton]} onPress={handleEmailLogin} disabled={isSubmitting}>
                            <MaterialCommunityIcons name="login" size={20} color="#fff" />
                            <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
                        </Pressable>

                        <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.linkRow}>
                            <Text style={[styles.linkText, { color: colors.tint }]}>Forgot Password?</Text>
                        </Pressable>

                        <Pressable onPress={() => router.push('/(auth)/register')} style={styles.linkRow}>
                            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
                        </Pressable>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <Pressable style={styles.backTextButton} onPress={() => setAuthMode('main')}>
                            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.textSecondary} />
                            <Text style={styles.backTextLabel}>Back to sign-in options</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </View>
            </KeyboardAvoidingView>
        );
    }

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <LinearGradient colors={[...colors.headerGradient]} style={styles.heroCard}>
                    <View style={styles.heroIconRow}>
                        <Image source={require("@/assets/images/logo.png")} style={{ width: 88, height: 84, borderRadius: 18 }} resizeMode="contain" />
                    </View>
                    <Text style={styles.heroTitle}>Amantra</Text>
                    <Text style={styles.heroSubtitle}>Keep passwords and private notes safe with encryption you control.</Text>
                </LinearGradient>

                <View style={styles.formCard}>
                    <Text style={styles.formTitle}>Welcome to your personal digital fortress.</Text>
                    <Text style={styles.formCaption}>Sign in to access your encrypted vault securely.</Text>

                    <Pressable style={styles.emailButton} onPress={() => setAuthMode('email')}>
                        <MaterialCommunityIcons name="email-outline" size={24} color="#fff" />
                        <Text style={styles.emailLabel}>Continue with Email</Text>
                    </Pressable>

                    <Pressable style={styles.googleButton} onPress={handleGoogleLogin}>
                        <MaterialCommunityIcons name="google" size={24} color={colors.text} />
                        <Text style={styles.googleLabel}>Continue with Google</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    scrollContent: { padding: 20, gap: 20, paddingBottom: 48 },
    heroCard: { padding: 28, borderRadius: 28, minHeight: 260, justifyContent: 'space-between', gap: 12 },
    heroIconRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroTitle: { fontSize: 34, fontWeight: '800', color: '#f8fafc' },
    heroSubtitle: { fontSize: 15, color: 'rgba(248, 250, 252, 0.85)', lineHeight: 22 },
    miniHero: { padding: 24, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
    miniHeroTitle: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
    formCard: { backgroundColor: c.surfaceSolid, borderRadius: 24, padding: 24, gap: 16, borderWidth: 1, borderColor: c.border },
    formTitle: { fontSize: 20, fontWeight: '700', color: c.text },
    formCaption: { fontSize: 14, color: c.textSecondary, marginTop: -8 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    input: { borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: c.text, backgroundColor: c.inputBg },
    passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.inputBg },
    passwordInput: { flex: 1, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
    eyeButton: { paddingHorizontal: 16, paddingVertical: 12 },
    primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, paddingVertical: 14, borderRadius: 16, gap: 10, marginTop: 4 },
    primaryButtonLabel: { fontSize: 17, fontWeight: '700', color: '#fff' },
    emailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, paddingVertical: 14, borderRadius: 16, gap: 12 },
    emailLabel: { fontSize: 17, fontWeight: '700', color: '#fff' },
    googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.cancelBg, borderWidth: 1, borderColor: c.border, paddingVertical: 14, borderRadius: 16, gap: 12 },
    googleLabel: { fontSize: 17, fontWeight: '600', color: c.text },
    helper: { fontSize: 12, color: c.textTertiary },
    disabledButton: { opacity: 0.4 },
    linkRow: { alignItems: 'center' },
    linkText: { fontSize: 14, color: c.textSecondary },
    linkBold: { fontWeight: '700', color: c.tint },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    dividerText: { fontSize: 13, color: c.textTertiary },
    backTextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
    backTextLabel: { fontSize: 15, color: c.textSecondary },
});
