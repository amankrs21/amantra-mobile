import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';

import AccountDeleteModal from '@/components/account/AccountDeleteModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLoading } from '@/hooks/use-loading';
import api from '@/services/api';
import { decodeKey, encodeKey } from '@/utils/crypto';

type ProfileResponse = {
    _id: string;
    email: string;
    name: string;
    dateOfBirth?: string | null;
    secretAnswer?: string | null;
};

type ProfileFormState = {
    email: string;
    name: string;
    dateOfBirth: string;
    secretAnswer: string;
};

type PasswordFormState = {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
};

function safeDecode(value?: string | null) {
    if (!value) {
        return '';
    }

    try {
        return decodeKey(value);
    } catch (error) {
        console.warn('Failed to decode value, returning raw string.', error);
        return value;
    }
}

const defaultProfile: ProfileFormState = {
    email: '',
    name: '',
    dateOfBirth: '',
    secretAnswer: '',
};

const defaultPasswords: PasswordFormState = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
};

export default function AccountScreen() {
    const { user, refreshUser, signOut } = useAuth();
    const { showLoading, hideLoading } = useLoading();

    const userEmail = user?.email ?? '';
    const userId = user?.id ?? null;

    const [profileId, setProfileId] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileFormState>(defaultProfile);
    const [initialProfile, setInitialProfile] = useState<ProfileFormState | null>(null);
    const [isProfileSubmitting, setProfileSubmitting] = useState(false);

    const [passwords, setPasswords] = useState<PasswordFormState>(defaultPasswords);
    const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
    const [isPasswordSubmitting, setPasswordSubmitting] = useState(false);

    const [deleteVisible, setDeleteVisible] = useState(false);

    const fetchProfile = useCallback(async () => {
        showLoading('Loading account details...');
        try {
            const { data } = await api.get<ProfileResponse>('/user/fetch');
            const nextProfile: ProfileFormState = {
                email: data.email ?? userEmail,
                name: data.name ?? '',
                dateOfBirth: data.dateOfBirth ?? '',
                secretAnswer: safeDecode(data.secretAnswer),
            };
            setProfile(nextProfile);
            setInitialProfile(nextProfile);
            setProfileId(data._id ?? userId);
        } catch (error) {
            console.error('Failed to load profile', error);
            Toast.show({ type: 'error', text1: 'Unable to load profile details.' });
        } finally {
            hideLoading();
        }
    }, [hideLoading, showLoading, userEmail, userId]);

    useEffect(() => {
        void fetchProfile();
    }, [fetchProfile]);

    const handleProfileChange = useCallback((field: keyof ProfileFormState, value: string) => {
        setProfile((prev) => ({ ...prev, [field]: value }));
    }, []);

    const isProfileDirty = useMemo(() => {
        if (!initialProfile) {
            return false;
        }
        return (
            initialProfile.name !== profile.name ||
            initialProfile.dateOfBirth !== profile.dateOfBirth ||
            initialProfile.secretAnswer !== profile.secretAnswer
        );
    }, [initialProfile, profile.dateOfBirth, profile.name, profile.secretAnswer]);

    const isProfileValid = useMemo(() => {
        return (
            profile.name.trim().length > 0 &&
            profile.dateOfBirth.trim().length > 0 &&
            profile.secretAnswer.trim().length >= 3
        );
    }, [profile.dateOfBirth, profile.name, profile.secretAnswer]);

    const handleProfileSubmit = useCallback(async () => {
        if (!profileId) {
            Toast.show({ type: 'error', text1: 'Profile identifier missing.' });
            return;
        }
        if (!isProfileValid) {
            Toast.show({ type: 'info', text1: 'Fill all profile fields before saving.' });
            return;
        }

        setProfileSubmitting(true);
        showLoading('Updating profile...');
        try {
            const trimmedName = profile.name.trim();
            const trimmedDob = profile.dateOfBirth.trim();
            const trimmedSecret = profile.secretAnswer.trim();

            await api.patch('/user/update', {
                id: profileId,
                name: trimmedName,
                dateOfBirth: trimmedDob,
                secretAnswer: encodeKey(trimmedSecret),
            });
            Toast.show({ type: 'success', text1: 'Profile updated successfully.' });
            const cleanedProfile = {
                email: profile.email,
                name: trimmedName,
                dateOfBirth: trimmedDob,
                secretAnswer: trimmedSecret,
            };
            setProfile(cleanedProfile);
            setInitialProfile(cleanedProfile);
            await refreshUser();
        } catch (error) {
            console.error('Profile update failed', error);
            const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
            Toast.show({ type: 'error', text1: message ?? 'Unable to update profile.' });
        } finally {
            setProfileSubmitting(false);
            hideLoading();
        }
    }, [hideLoading, isProfileValid, profile, profileId, refreshUser, showLoading]);

    const handlePasswordChange = useCallback((field: keyof PasswordFormState, value: string) => {
        setPasswords((prev) => ({ ...prev, [field]: value }));
    }, []);

    const isPasswordDirty = useMemo(() => {
        return Boolean(passwords.oldPassword || passwords.newPassword || passwords.confirmPassword);
    }, [passwords.confirmPassword, passwords.newPassword, passwords.oldPassword]);

    const isPasswordValid = useMemo(() => {
        return (
            passwords.oldPassword.trim().length > 0 &&
            passwords.newPassword.trim().length >= 8 &&
            passwords.confirmPassword.trim().length >= 8
        );
    }, [passwords.confirmPassword, passwords.newPassword, passwords.oldPassword]);

    const handlePasswordSubmit = useCallback(async () => {
        if (!isPasswordValid) {
            Toast.show({ type: 'info', text1: 'Enter all password fields (min 8 characters).' });
            return;
        }
        if (passwords.newPassword !== passwords.confirmPassword) {
            Toast.show({ type: 'error', text1: 'New password and confirm password must match.' });
            return;
        }

        setPasswordSubmitting(true);
        showLoading('Updating password...');
        try {
            await api.patch('/user/changePassword', {
                oldPassword: passwords.oldPassword,
                newPassword: passwords.newPassword,
            });
            Toast.show({ type: 'success', text1: 'Password updated successfully.' });
            setPasswords(defaultPasswords);
        } catch (error) {
            console.error('Password update failed', error);
            const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
            Toast.show({ type: 'error', text1: message ?? 'Unable to update password.' });
        } finally {
            setPasswordSubmitting(false);
            hideLoading();
        }
    }, [hideLoading, isPasswordValid, passwords.confirmPassword, passwords.newPassword, passwords.oldPassword, showLoading]);

    const handleTogglePassword = useCallback((field: 'current' | 'new' | 'confirm') => {
        setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
    }, []);

    const handleDeleteAccount = useCallback(async () => {
        showLoading('Deleting account...');
        try {
            await api.delete('/user/delete');
            Toast.show({ type: 'success', text1: 'Account deleted.' });
            setDeleteVisible(false);
            await signOut();
        } catch (error) {
            console.error('Account deletion failed', error);
            Toast.show({ type: 'error', text1: 'Unable to delete account.' });
        } finally {
            hideLoading();
        }
    }, [hideLoading, showLoading, signOut]);

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.title}>Account & Security</Text>
                        <Text style={styles.subtitle}>Manage your profile information and secure access controls.</Text>
                    </View>
                    <View style={styles.headerIcon}>
                        <MaterialCommunityIcons name="account-lock" size={32} color="#38bdf8" />
                    </View>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.cardTitle}>Profile details</Text>
                            <Text style={styles.cardSubtitle}>Keep your personal information up to date.</Text>
                        </View>
                        <MaterialCommunityIcons name="account" size={26} color="#2563eb" />
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Email</Text>
                        <View style={[styles.input, styles.disabledInput]}>
                            <Text style={styles.disabledText}>{profile.email}</Text>
                        </View>
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Full name</Text>
                        <TextInput
                            value={profile.name}
                            onChangeText={(value) => handleProfileChange('name', value)}
                            placeholder="Your full name"
                            placeholderTextColor="rgba(15, 23, 42, 0.3)"
                            style={styles.input}
                        />
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Date of birth</Text>
                        <TextInput
                            value={profile.dateOfBirth}
                            onChangeText={(value) => handleProfileChange('dateOfBirth', value)}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="rgba(15, 23, 42, 0.3)"
                            style={styles.input}
                        />
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Favorite place</Text>
                        <TextInput
                            value={profile.secretAnswer}
                            onChangeText={(value) => handleProfileChange('secretAnswer', value)}
                            placeholder="Used to recover your vault"
                            placeholderTextColor="rgba(15, 23, 42, 0.3)"
                            style={styles.input}
                        />
                    </View>
                    <Pressable
                        style={[styles.primaryButton, (!isProfileDirty || !isProfileValid || isProfileSubmitting) && styles.disabledButton]}
                        onPress={handleProfileSubmit}
                        disabled={!isProfileDirty || !isProfileValid || isProfileSubmitting}
                    >
                        <Text style={styles.primaryButtonLabel}>{isProfileSubmitting ? 'Saving…' : 'Update profile'}</Text>
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.cardTitle}>Change password</Text>
                            <Text style={styles.cardSubtitle}>Create a strong password to protect your vault.</Text>
                        </View>
                        <MaterialCommunityIcons name="lock-reset" size={26} color="#2563eb" />
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Current password</Text>
                        <View style={styles.passwordRow}>
                            <TextInput
                                value={passwords.oldPassword}
                                onChangeText={(value) => handlePasswordChange('oldPassword', value)}
                                placeholder="Enter current password"
                                placeholderTextColor="rgba(15, 23, 42, 0.3)"
                                style={[styles.input, styles.passwordInput]}
                                secureTextEntry={!showPassword.current}
                            />
                            <Pressable style={styles.eyeButton} onPress={() => handleTogglePassword('current')}>
                                <MaterialCommunityIcons
                                    name={showPassword.current ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color="rgba(15, 23, 42, 0.6)"
                                />
                            </Pressable>
                        </View>
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>New password</Text>
                        <View style={styles.passwordRow}>
                            <TextInput
                                value={passwords.newPassword}
                                onChangeText={(value) => handlePasswordChange('newPassword', value)}
                                placeholder="Enter new password"
                                placeholderTextColor="rgba(15, 23, 42, 0.3)"
                                style={[styles.input, styles.passwordInput]}
                                secureTextEntry={!showPassword.new}
                            />
                            <Pressable style={styles.eyeButton} onPress={() => handleTogglePassword('new')}>
                                <MaterialCommunityIcons
                                    name={showPassword.new ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color="rgba(15, 23, 42, 0.6)"
                                />
                            </Pressable>
                        </View>
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Confirm new password</Text>
                        <View style={styles.passwordRow}>
                            <TextInput
                                value={passwords.confirmPassword}
                                onChangeText={(value) => handlePasswordChange('confirmPassword', value)}
                                placeholder="Re-enter new password"
                                placeholderTextColor="rgba(15, 23, 42, 0.3)"
                                style={[styles.input, styles.passwordInput]}
                                secureTextEntry={!showPassword.confirm}
                            />
                            <Pressable style={styles.eyeButton} onPress={() => handleTogglePassword('confirm')}>
                                <MaterialCommunityIcons
                                    name={showPassword.confirm ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color="rgba(15, 23, 42, 0.6)"
                                />
                            </Pressable>
                        </View>
                    </View>
                    <Pressable
                        style={[styles.secondaryButton, (!isPasswordDirty || !isPasswordValid || isPasswordSubmitting) && styles.disabledButton]}
                        onPress={handlePasswordSubmit}
                        disabled={!isPasswordDirty || !isPasswordValid || isPasswordSubmitting}
                    >
                        <Text style={styles.secondaryButtonLabel}>{isPasswordSubmitting ? 'Updating…' : 'Update password'}</Text>
                    </Pressable>
                </View>

                <View style={styles.dangerCard}>
                    <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.dangerTitle}>Delete account</Text>
                        <Text style={styles.dangerSubtitle}>Remove all of your data from Secure Vault permanently.</Text>
                    </View>
                    <Pressable style={styles.dangerButton} onPress={() => setDeleteVisible(true)}>
                        <MaterialCommunityIcons name="trash-can" size={20} color="#fff" />
                        <Text style={styles.dangerButtonLabel}>Delete account</Text>
                    </Pressable>
                </View>
            </ScrollView>

            <AccountDeleteModal visible={deleteVisible} onClose={() => setDeleteVisible(false)} onConfirm={handleDeleteAccount} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#e2e8f0',
    },
    content: {
        padding: 24,
        gap: 24,
        paddingBottom: 48,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#020617',
        padding: 20,
        borderRadius: 20,
        gap: 18,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(226, 232, 240, 0.8)',
    },
    headerIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        backgroundColor: '#f8fafc',
        borderRadius: 24,
        padding: 20,
        gap: 18,
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowRadius: 18,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    cardSubtitle: {
        fontSize: 13,
        color: 'rgba(15, 23, 42, 0.65)',
        marginTop: 4,
    },
    fieldGroup: {
        gap: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.75)',
    },
    input: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.08)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#0f172a',
        backgroundColor: '#fff',
    },
    disabledInput: {
        borderStyle: 'dashed',
        backgroundColor: 'rgba(15, 23, 42, 0.04)',
    },
    disabledText: {
        fontSize: 16,
        color: 'rgba(15, 23, 42, 0.6)',
    },
    primaryButton: {
        backgroundColor: Colors.light.tint,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    primaryButtonLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    secondaryButton: {
        backgroundColor: '#1e3a8a',
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    secondaryButtonLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    disabledButton: {
        opacity: 0.5,
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.08)',
        backgroundColor: '#fff',
    },
    passwordInput: {
        flex: 1,
        borderWidth: 0,
        borderRadius: 0,
        paddingVertical: 12,
    },
    eyeButton: {
        height: '100%',
        paddingHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dangerCard: {
        backgroundColor: '#ffe4e6',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    dangerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#9f1239',
    },
    dangerSubtitle: {
        fontSize: 13,
        color: 'rgba(159, 18, 57, 0.8)',
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#be123c',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 16,
    },
    dangerButtonLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
});
