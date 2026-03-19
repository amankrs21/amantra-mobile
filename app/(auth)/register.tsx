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

export default function RegisterScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showLoading, hideLoading } = useLoading();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [weatherCity, setWeatherCity] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isValid = name.trim().length > 0 && email.trim().length > 0 && password.trim().length >= 8 && confirmPassword.trim().length >= 8;

    const handleRegister = useCallback(async () => {
        if (!isValid) { toast.info('Please fill all fields correctly.'); return; }
        if (password !== confirmPassword) { toast.error('Passwords do not match.'); return; }

        Keyboard.dismiss(); setIsSubmitting(true); showLoading('Creating your account...');
        try {
            const body: Record<string, string> = { name: name.trim(), email: email.trim().toLowerCase(), password: password.trim() };
            if (weatherCity.trim()) body.weatherCity = weatherCity.trim();
            await api.post('/auth/register', body);
            toast.success('Account created!', { description: 'Check your email for verification OTP.' });
            router.push({ pathname: '/(auth)/verify-otp', params: { email: email.trim().toLowerCase(), mode: 'verify' } });
        } catch (error) {
            const message = (error as any)?.response?.data?.message;
            toast.error('Registration failed', { description: message ?? 'Please try again.' });
        } finally { setIsSubmitting(false); hideLoading(); }
    }, [confirmPassword, email, hideLoading, isValid, name, password, router, showLoading, weatherCity]);

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={[styles.screen, { paddingTop: insets.top }]}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <LinearGradient colors={[...colors.headerGradient]} style={styles.miniHero}>
                        <Image source={require("@/assets/images/logo.png")} style={{ width: 44, height: 44, borderRadius: 10 }} />
                        <View>
                            <Text style={styles.miniHeroTitle}>Amantra</Text>
                            <Text style={styles.miniHeroSubtitle}>Create your account</Text>
                        </View>
                    </LinearGradient>

                    <View style={styles.formCard}>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Full name</Text>
                            <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.placeholder} style={styles.input} autoCapitalize="words" />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.placeholder} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Password (min 8 characters)</Text>
                            <View style={styles.passwordRow}>
                                <TextInput value={password} onChangeText={setPassword} placeholder="Choose a strong password" placeholderTextColor={colors.placeholder} style={[styles.input, styles.passwordInput]} secureTextEntry={!showPassword} />
                                <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                                    <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Confirm password</Text>
                            <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter your password" placeholderTextColor={colors.placeholder} style={styles.input} secureTextEntry={!showPassword} />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Weather city <Text style={{ fontWeight: '400', color: colors.textTertiary }}>(optional)</Text></Text>
                            <TextInput value={weatherCity} onChangeText={setWeatherCity} placeholder="e.g., Hyderabad" placeholderTextColor={colors.placeholder} style={styles.input} autoCapitalize="words" />
                        </View>

                        <Pressable style={[styles.primaryButton, (!isValid || isSubmitting) && styles.disabledButton]} onPress={handleRegister} disabled={!isValid || isSubmitting}>
                            <MaterialCommunityIcons name="account-plus" size={20} color="#fff" />
                            <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Creating account…' : 'Create account'}</Text>
                        </Pressable>

                        <Pressable onPress={() => router.back()} style={styles.linkRow}>
                            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
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
    linkText: { fontSize: 14, color: c.textSecondary },
    linkBold: { fontWeight: '700', color: c.tint },
});
