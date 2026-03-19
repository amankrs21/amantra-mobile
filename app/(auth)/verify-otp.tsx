import { useCallback, useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import api from '@/services/api';
import { useAuth } from '@/hooks/use-auth';
import { useLoading } from '@/hooks/use-loading';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import OtpInput from '@/components/ui/OtpInput';

export default function VerifyOtpScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { completeLogin } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const params = useLocalSearchParams<{ email: string; mode: 'verify' | 'reset' }>();
    const email = params.email ?? '';
    const mode = params.mode ?? 'verify';

    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(60);

    // Reset mode: show password fields after OTP
    const [showResetFields, setShowResetFields] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (resendCountdown <= 0) return;
        const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCountdown]);

    const handleResend = useCallback(async () => {
        showLoading('Resending OTP...');
        try {
            await api.post('/auth/resend-otp', { email });
            toast.success('OTP resent! Check your email.');
            setResendCountdown(60);
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Failed to resend OTP.');
        } finally {
            hideLoading();
        }
    }, [email, hideLoading, showLoading]);

    const handleVerify = useCallback(async () => {
        if (otp.length !== 6) { toast.info('Enter the 6-digit OTP.'); return; }

        if (mode === 'reset' && !showResetFields) {
            setShowResetFields(true);
            return;
        }

        if (mode === 'reset') {
            if (newPassword.length < 8) { toast.info('Password must be at least 8 characters.'); return; }
            if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
        }

        Keyboard.dismiss();
        setIsSubmitting(true);
        showLoading(mode === 'verify' ? 'Verifying...' : 'Resetting password...');

        try {
            if (mode === 'verify') {
                const { data } = await api.post('/auth/verify', { email, otp });
                const { token, user, isKeySet } = data;
                await completeLogin({
                    token,
                    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, weatherCity: user.weatherCity },
                    encryptionKeyConfigured: Boolean(isKeySet),
                });
                toast.success(`Welcome, ${user.name}!`);
            } else {
                await api.post('/auth/reset-password', { email, otp, password: newPassword });
                toast.success('Password reset successfully!');
                router.replace('/(auth)/welcome');
            }
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Verification failed.');
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    }, [completeLogin, confirmPassword, email, hideLoading, mode, newPassword, otp, router, showLoading, showResetFields]);

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={[styles.screen, { paddingTop: insets.top }]}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <LinearGradient colors={[...colors.headerGradient]} style={styles.miniHero}>
                        <Image source={require("@/assets/images/logo.png")} style={{ width: 44, height: 44, borderRadius: 10 }} />
                        <View>
                            <Text style={styles.miniHeroTitle}>Amantra</Text>
                            <Text style={styles.miniHeroSubtitle}>
                                {mode === 'verify' ? 'Verify your email' : 'Reset your password'}
                            </Text>
                        </View>
                    </LinearGradient>

                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>
                            {mode === 'verify' ? 'Email Verification' : 'Enter OTP'}
                        </Text>
                        <Text style={styles.formCaption}>
                            We sent a 6-digit code to{'\n'}
                            <Text style={{ fontWeight: '700', color: colors.text }}>{email}</Text>
                        </Text>

                        <OtpInput value={otp} onChange={setOtp} disabled={isSubmitting} />

                        {mode === 'reset' && showResetFields && (
                            <>
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>New password</Text>
                                    <View style={styles.passwordRow}>
                                        <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="Min 8 characters" placeholderTextColor={colors.placeholder} style={[styles.input, styles.passwordInput]} secureTextEntry={!showPassword} />
                                        <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                                            <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                                        </Pressable>
                                    </View>
                                </View>
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Confirm password</Text>
                                    <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" placeholderTextColor={colors.placeholder} style={styles.input} secureTextEntry={!showPassword} />
                                </View>
                            </>
                        )}

                        <Pressable
                            style={[styles.primaryButton, (otp.length !== 6 || isSubmitting) && styles.disabledButton]}
                            onPress={handleVerify}
                            disabled={otp.length !== 6 || isSubmitting}
                        >
                            <MaterialCommunityIcons name={mode === 'verify' ? 'check-circle' : 'lock-reset'} size={20} color="#fff" />
                            <Text style={styles.primaryButtonLabel}>
                                {isSubmitting ? 'Please wait…' : mode === 'verify' ? 'Verify & Continue' : showResetFields ? 'Reset Password' : 'Continue'}
                            </Text>
                        </Pressable>

                        <Pressable onPress={handleResend} disabled={resendCountdown > 0} style={styles.linkRow}>
                            <Text style={[styles.linkText, resendCountdown > 0 && { opacity: 0.4 }]}>
                                {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
                            </Text>
                        </Pressable>

                        <Pressable onPress={() => router.back()} style={styles.backButton}>
                            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.textSecondary} />
                            <Text style={styles.backLabel}>Go back</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    scrollContent: { padding: 20, gap: 20, paddingBottom: 48 },
    miniHero: { padding: 24, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
    miniHeroTitle: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
    miniHeroSubtitle: { fontSize: 14, color: 'rgba(248, 250, 252, 0.7)', marginTop: 2 },
    formCard: { backgroundColor: c.surfaceSolid, borderRadius: 24, padding: 24, gap: 16, borderWidth: 1, borderColor: c.border },
    formTitle: { fontSize: 20, fontWeight: '700', color: c.text },
    formCaption: { fontSize: 14, color: c.textSecondary, marginTop: -8, lineHeight: 20 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    input: { borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: c.text, backgroundColor: c.inputBg },
    passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.inputBg },
    passwordInput: { flex: 1, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
    eyeButton: { paddingHorizontal: 16, paddingVertical: 12 },
    primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, paddingVertical: 14, borderRadius: 16, gap: 10, marginTop: 4 },
    primaryButtonLabel: { fontSize: 17, fontWeight: '700', color: '#fff' },
    disabledButton: { opacity: 0.4 },
    linkRow: { alignItems: 'center', marginTop: 4 },
    linkText: { fontSize: 14, color: c.tint, fontWeight: '600' },
    backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
    backLabel: { fontSize: 15, color: c.textSecondary },
});
