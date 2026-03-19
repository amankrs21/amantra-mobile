import { useCallback, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import api from '@/services/api';
import { useLoading } from '@/hooks/use-loading';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import OtpInput from '@/components/ui/OtpInput';

type Stage = 'email' | 'reset' | 'success';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showLoading, hideLoading } = useLoading();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [stage, setStage] = useState<Stage>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSendOtp = useCallback(async () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) { toast.info('Please enter your email.'); return; }
        Keyboard.dismiss();
        setIsSubmitting(true);
        showLoading('Sending OTP...');
        try {
            await api.post('/auth/forgot-password', { email: trimmed });
            toast.success('OTP sent! Check your email.');
            setStage('reset');
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Failed to send OTP.');
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    }, [email, hideLoading, showLoading]);

    const handleReset = useCallback(async () => {
        if (otp.length !== 6) { toast.info('Enter the 6-digit OTP.'); return; }
        if (newPassword.length < 8) { toast.info('Password must be at least 8 characters.'); return; }
        if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
        Keyboard.dismiss();
        setIsSubmitting(true);
        showLoading('Resetting password...');
        try {
            await api.post('/auth/reset-password', { email: email.trim().toLowerCase(), otp, password: newPassword });
            setStage('success');
            toast.success('Password reset successfully!');
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Reset failed.');
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    }, [confirmPassword, email, hideLoading, newPassword, otp, showLoading]);

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={[styles.screen, { paddingTop: insets.top }]}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <LinearGradient colors={[...colors.headerGradient]} style={styles.miniHero}>
                        <Image source={require("@/assets/images/logo.png")} style={{ width: 44, height: 44, borderRadius: 10 }} />
                        <View>
                            <Text style={styles.miniHeroTitle}>Amantra</Text>
                            <Text style={styles.miniHeroSubtitle}>Forgot password</Text>
                        </View>
                    </LinearGradient>

                    <View style={styles.formCard}>
                        {stage === 'email' && (
                            <>
                                <Text style={styles.formTitle}>Reset your password</Text>
                                <Text style={styles.formCaption}>Enter your email and we&apos;ll send you a verification code.</Text>
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.label}>Email</Text>
                                    <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.placeholder} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={handleSendOtp} />
                                </View>
                                <Pressable style={[styles.primaryButton, (!email.trim() || isSubmitting) && styles.disabledButton]} onPress={handleSendOtp} disabled={!email.trim() || isSubmitting}>
                                    <MaterialCommunityIcons name="email-fast" size={20} color="#fff" />
                                    <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Sending…' : 'Send OTP'}</Text>
                                </Pressable>
                            </>
                        )}

                        {stage === 'reset' && (
                            <>
                                <Text style={styles.formTitle}>Enter code & new password</Text>
                                <Text style={styles.formCaption}>
                                    Code sent to <Text style={{ fontWeight: '700', color: colors.text }}>{email.trim().toLowerCase()}</Text>
                                </Text>
                                <OtpInput value={otp} onChange={setOtp} disabled={isSubmitting} />
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
                                <Pressable style={[styles.primaryButton, (otp.length !== 6 || isSubmitting) && styles.disabledButton]} onPress={handleReset} disabled={otp.length !== 6 || isSubmitting}>
                                    <MaterialCommunityIcons name="lock-reset" size={20} color="#fff" />
                                    <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Resetting…' : 'Reset Password'}</Text>
                                </Pressable>
                            </>
                        )}

                        {stage === 'success' && (
                            <>
                                <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
                                    <MaterialCommunityIcons name="check-circle" size={64} color={colors.success} />
                                    <Text style={styles.formTitle}>Password Reset!</Text>
                                    <Text style={[styles.formCaption, { textAlign: 'center' }]}>Your password has been updated. Sign in with your new password.</Text>
                                </View>
                                <Pressable style={styles.primaryButton} onPress={() => router.replace('/(auth)/welcome')}>
                                    <MaterialCommunityIcons name="login" size={20} color="#fff" />
                                    <Text style={styles.primaryButtonLabel}>Back to Login</Text>
                                </Pressable>
                            </>
                        )}

                        {stage !== 'success' && (
                            <Pressable onPress={() => router.back()} style={styles.backButton}>
                                <MaterialCommunityIcons name="arrow-left" size={18} color={colors.textSecondary} />
                                <Text style={styles.backLabel}>Back to login</Text>
                            </Pressable>
                        )}
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
    backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
    backLabel: { fontSize: 15, color: c.textSecondary },
});
