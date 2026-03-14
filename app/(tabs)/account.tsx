import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLoading } from '@/hooks/use-loading';
import api from '@/services/api';
import { decodeKey, encodeKey } from '@/utils/crypto';

type ProfileResponse = { _id: string; email: string; name: string; dateOfBirth?: string | null; secretAnswer?: string | null };
type ProfileFormState = { email: string; name: string; dateOfBirth: string; secretAnswer: string };
type PasswordFormState = { oldPassword: string; newPassword: string; confirmPassword: string };

function safeDecode(value?: string | null) {
    if (!value) return '';
    try { return decodeKey(value); } catch { return value; }
}

const defaultProfile: ProfileFormState = { email: '', name: '', dateOfBirth: '', secretAnswer: '' };
const defaultPasswords: PasswordFormState = { oldPassword: '', newPassword: '', confirmPassword: '' };

export default function AccountScreen() {
    const { user, refreshUser, signOut } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const params = useLocalSearchParams<{ section?: string }>();
    const section = params.section ?? 'profile';

    const userEmail = user?.email ?? '';
    const userId = user?.id ?? null;

    const [profileId, setProfileId] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileFormState>(defaultProfile);
    const [initialProfile, setInitialProfile] = useState<ProfileFormState | null>(null);
    const [isProfileSubmitting, setProfileSubmitting] = useState(false);
    const [passwords, setPasswords] = useState<PasswordFormState>(defaultPasswords);
    const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
    const [isPasswordSubmitting, setPasswordSubmitting] = useState(false);

    // Deactivation state
    const [deactivateEmail, setDeactivateEmail] = useState('');
    const [deactivateConfirmed, setDeactivateConfirmed] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (section !== 'profile') return;
        showLoading('Loading profile...');
        try {
            const { data } = await api.get<ProfileResponse>('/user/fetch');
            const nextProfile: ProfileFormState = { email: data.email ?? userEmail, name: data.name ?? '', dateOfBirth: data.dateOfBirth ?? '', secretAnswer: safeDecode(data.secretAnswer) };
            setProfile(nextProfile); setInitialProfile(nextProfile); setProfileId(data._id ?? userId);
        } catch { Toast.show({ type: 'error', text1: 'Unable to load profile.' }); }
        finally { hideLoading(); }
    }, [hideLoading, showLoading, userEmail, userId, section]);

    useEffect(() => { void fetchProfile(); }, [fetchProfile]);

    // Profile handlers
    const handleProfileChange = useCallback((field: keyof ProfileFormState, value: string) => { setProfile((prev) => ({ ...prev, [field]: value })); }, []);
    const isProfileDirty = useMemo(() => { if (!initialProfile) return false; return initialProfile.name !== profile.name || initialProfile.dateOfBirth !== profile.dateOfBirth || initialProfile.secretAnswer !== profile.secretAnswer; }, [initialProfile, profile]);
    const isProfileValid = useMemo(() => profile.name.trim().length > 0 && profile.dateOfBirth.trim().length > 0 && profile.secretAnswer.trim().length >= 3, [profile]);

    const handleProfileSubmit = useCallback(async () => {
        if (!profileId || !isProfileValid) return;
        setProfileSubmitting(true); showLoading('Updating profile...');
        try {
            await api.patch('/user/update', { id: profileId, name: profile.name.trim(), dateOfBirth: profile.dateOfBirth.trim(), secretAnswer: encodeKey(profile.secretAnswer.trim()) });
            Toast.show({ type: 'success', text1: 'Profile updated.' });
            const cleaned = { email: profile.email, name: profile.name.trim(), dateOfBirth: profile.dateOfBirth.trim(), secretAnswer: profile.secretAnswer.trim() };
            setProfile(cleaned); setInitialProfile(cleaned); await refreshUser();
        } catch (e: any) { Toast.show({ type: 'error', text1: e?.response?.data?.message ?? 'Unable to update.' }); }
        finally { setProfileSubmitting(false); hideLoading(); }
    }, [hideLoading, isProfileValid, profile, profileId, refreshUser, showLoading]);

    // Password handlers
    const handlePasswordChange = useCallback((field: keyof PasswordFormState, value: string) => { setPasswords((prev) => ({ ...prev, [field]: value })); }, []);
    const isPasswordDirty = useMemo(() => Boolean(passwords.oldPassword || passwords.newPassword || passwords.confirmPassword), [passwords]);
    const isPasswordValid = useMemo(() => passwords.oldPassword.trim().length > 0 && passwords.newPassword.trim().length >= 8 && passwords.confirmPassword.trim().length >= 8, [passwords]);

    const handlePasswordSubmit = useCallback(async () => {
        if (!isPasswordValid) { Toast.show({ type: 'info', text1: 'Enter all fields (min 8 chars).' }); return; }
        if (passwords.newPassword !== passwords.confirmPassword) { Toast.show({ type: 'error', text1: 'Passwords do not match.' }); return; }
        setPasswordSubmitting(true); showLoading('Updating password...');
        try { await api.patch('/user/changePassword', { oldPassword: passwords.oldPassword, newPassword: passwords.newPassword }); Toast.show({ type: 'success', text1: 'Password updated.' }); setPasswords(defaultPasswords); }
        catch (e: any) { Toast.show({ type: 'error', text1: e?.response?.data?.message ?? 'Unable to update password.' }); }
        finally { setPasswordSubmitting(false); hideLoading(); }
    }, [hideLoading, isPasswordValid, passwords, showLoading]);

    const handleTogglePassword = useCallback((field: 'current' | 'new' | 'confirm') => { setShowPassword((prev) => ({ ...prev, [field]: !prev[field] })); }, []);

    // Deactivation
    const handleDeactivate = useCallback(async () => {
        if (deactivateEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
            Toast.show({ type: 'error', text1: 'Email does not match your account.' });
            return;
        }
        Alert.alert(
            '⚠️ Final Warning',
            'This will permanently delete your account and ALL associated data:\n\n• All passwords & vault entries\n• All notes & journals\n• Your watchlist\n• Your profile\n\nThis action CANNOT be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Everything', style: 'destructive',
                    onPress: async () => {
                        showLoading('Deleting account...');
                        try { await api.delete('/user/delete'); Toast.show({ type: 'success', text1: 'Account deleted.' }); await signOut(); }
                        catch { Toast.show({ type: 'error', text1: 'Unable to delete account.' }); }
                        finally { hideLoading(); }
                    },
                },
            ],
        );
    }, [deactivateEmail, hideLoading, showLoading, signOut, userEmail]);

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            {/* Back button + title */}
            <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.topTitle}>
                    {section === 'password' ? 'Change Password' : section === 'deactivate' ? 'Deactivate Account' : 'Edit Profile'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {section === 'profile' && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Profile Details</Text>
                        <Text style={styles.cardSubtitle}>Keep your personal information up to date.</Text>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email</Text>
                            <View style={[styles.input, styles.disabledInput]}>
                                <Text style={styles.disabledText}>{profile.email}</Text>
                            </View>
                        </View>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Full name</Text>
                            <TextInput value={profile.name} onChangeText={(v) => handleProfileChange('name', v)} placeholder="Your full name" placeholderTextColor={colors.placeholder} style={styles.input} autoCapitalize="words" />
                        </View>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Date of birth</Text>
                            <TextInput value={profile.dateOfBirth} onChangeText={(v) => handleProfileChange('dateOfBirth', v)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.placeholder} style={styles.input} />
                        </View>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Favorite place (recovery)</Text>
                            <TextInput value={profile.secretAnswer} onChangeText={(v) => handleProfileChange('secretAnswer', v)} placeholder="Used to recover your vault" placeholderTextColor={colors.placeholder} style={styles.input} autoCapitalize="none" />
                        </View>
                        <Pressable style={[styles.primaryButton, (!isProfileDirty || !isProfileValid || isProfileSubmitting) && styles.disabledButton]} onPress={handleProfileSubmit} disabled={!isProfileDirty || !isProfileValid || isProfileSubmitting}>
                            <Text style={styles.primaryButtonLabel}>{isProfileSubmitting ? 'Saving…' : 'Update Profile'}</Text>
                        </Pressable>
                    </View>
                )}

                {section === 'password' && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Change Password</Text>
                        <Text style={styles.cardSubtitle}>Create a strong password to protect your vault.</Text>

                        {(['oldPassword', 'newPassword', 'confirmPassword'] as const).map((field, i) => {
                            const labels = ['Current password', 'New password', 'Confirm new password'];
                            const placeholders = ['Enter current password', 'Enter new password (min 8 chars)', 'Re-enter new password'];
                            const showKeys = ['current', 'new', 'confirm'] as const;
                            return (
                                <View key={field} style={styles.fieldGroup}>
                                    <Text style={styles.label}>{labels[i]}</Text>
                                    <View style={styles.passwordRow}>
                                        <TextInput value={passwords[field]} onChangeText={(v) => handlePasswordChange(field, v)} placeholder={placeholders[i]} placeholderTextColor={colors.placeholder} style={[styles.input, styles.passwordInput]} secureTextEntry={!showPassword[showKeys[i]]} autoCapitalize="none" />
                                        <Pressable style={styles.eyeButton} onPress={() => handleTogglePassword(showKeys[i])}>
                                            <MaterialCommunityIcons name={showPassword[showKeys[i]] ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                                        </Pressable>
                                    </View>
                                </View>
                            );
                        })}
                        <Pressable style={[styles.primaryButton, (!isPasswordDirty || !isPasswordValid || isPasswordSubmitting) && styles.disabledButton]} onPress={handlePasswordSubmit} disabled={!isPasswordDirty || !isPasswordValid || isPasswordSubmitting}>
                            <Text style={styles.primaryButtonLabel}>{isPasswordSubmitting ? 'Updating…' : 'Update Password'}</Text>
                        </Pressable>
                    </View>
                )}

                {section === 'deactivate' && (
                    <View style={styles.card}>
                        <View style={styles.dangerHeader}>
                            <MaterialCommunityIcons name="alert-octagon" size={40} color="#ef4444" />
                            <Text style={styles.dangerTitle}>Deactivate Account</Text>
                        </View>

                        <Text style={styles.dangerInfo}>
                            This will permanently delete your account and ALL associated data:{'\n\n'}
                            • All saved passwords & vault entries{'\n'}
                            • All notes & journals{'\n'}
                            • Your watchlist & preferences{'\n'}
                            • Your profile & settings{'\n\n'}
                            This action <Text style={{ fontWeight: '800' }}>CANNOT</Text> be undone.
                        </Text>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Type your email to confirm</Text>
                            <TextInput
                                value={deactivateEmail}
                                onChangeText={setDeactivateEmail}
                                placeholder={userEmail}
                                placeholderTextColor={colors.placeholder}
                                style={styles.input}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <Pressable
                            style={[styles.dangerButton, deactivateEmail.trim().toLowerCase() !== userEmail.toLowerCase() && styles.disabledButton]}
                            onPress={handleDeactivate}
                            disabled={deactivateEmail.trim().toLowerCase() !== userEmail.toLowerCase()}
                        >
                            <MaterialCommunityIcons name="trash-can" size={20} color="#fff" />
                            <Text style={styles.dangerButtonLabel}>Delete My Account</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSolid },
    topTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' },
    content: { padding: 20, gap: 20, paddingBottom: 48 },
    card: { backgroundColor: c.surfaceSolid, borderRadius: 20, padding: 20, gap: 16, borderWidth: 1, borderColor: c.border },
    cardTitle: { fontSize: 20, fontWeight: '700', color: c.text },
    cardSubtitle: { fontSize: 13, color: c.textSecondary, marginTop: -8 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    input: { borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: c.text, backgroundColor: c.inputBg },
    disabledInput: { borderStyle: 'dashed', backgroundColor: c.surfaceSolid, opacity: 0.6 },
    disabledText: { fontSize: 16, color: c.textSecondary },
    primaryButton: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    primaryButtonLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
    disabledButton: { opacity: 0.4 },
    passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.inputBg },
    passwordInput: { flex: 1, borderWidth: 0, borderRadius: 0, paddingVertical: 12 },
    eyeButton: { paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
    dangerHeader: { alignItems: 'center', gap: 10, paddingVertical: 8 },
    dangerTitle: { fontSize: 22, fontWeight: '800', color: '#ef4444' },
    dangerInfo: { fontSize: 14, color: c.textSecondary, lineHeight: 22 },
    dangerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#be123c', paddingVertical: 14, borderRadius: 16, marginTop: 4 },
    dangerButtonLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
