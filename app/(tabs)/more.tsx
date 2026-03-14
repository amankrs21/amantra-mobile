import { useCallback, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

import EncryptionKeyModal from '@/components/modals/EncryptionKeyModal';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBiometric } from '@/hooks/use-biometric';
import { useLoading } from '@/hooks/use-loading';
import { useEncryptionKey } from '@/hooks/use-encryption-key';
import api from '@/services/api';
import { encodeKey } from '@/utils/crypto';

const APP_VERSION = '1.0.0';

type SectionItem = { key: string; icon: string; label: string; subtitle?: string; onPress?: () => void; accent?: string; danger?: boolean };

export default function MoreScreen() {
    const { user, signOut, encryptionKeyConfigured, setEncryptionKeyConfigured } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const { clearKey, setKey } = useEncryptionKey();
    const { isAvailable: bioAvailable, isEnabled: bioEnabled, enableBiometric, disableBiometric } = useBiometric();
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { mode: themeMode, setMode: setThemeMode } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [showEncryptionModal, setShowEncryptionModal] = useState(false);
    const router = useRouter();

    const handleToggleBiometric = useCallback(async () => {
        if (bioEnabled) { await disableBiometric(); Toast.show({ type: 'success', text1: 'Biometric unlock disabled.' }); }
        else Toast.show({ type: 'info', text1: 'Enter your encryption PIN in the vault to enable biometric unlock.', text2: 'Biometric enrollment happens after a successful PIN entry.' });
    }, [bioEnabled, disableBiometric]);

    const handleResetEncryptionKey = useCallback(() => {
        Alert.alert('Reset Encryption Key', 'This will permanently delete ALL your encrypted passwords and notes. This action cannot be undone.\n\nAre you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: async () => {
                showLoading('Resetting encryption key...');
                try { await api.get('/pin/reset'); await clearKey(); await setEncryptionKeyConfigured(false); Toast.show({ type: 'success', text1: 'Encryption key reset.', text2: 'Set a new key when you next access your vault.' }); }
                catch (error) { console.error('Failed to reset encryption key', error); Toast.show({ type: 'error', text1: 'Unable to reset encryption key.' }); }
                finally { hideLoading(); }
            }},
        ]);
    }, [clearKey, hideLoading, setEncryptionKeyConfigured, showLoading]);

    const handleClearLocalKey = useCallback(async () => {
        await clearKey();
        Toast.show({ type: 'success', text1: 'Local encryption key cleared.', text2: 'You\'ll be prompted to re-enter it next time.' });
    }, [clearKey]);

    const handleSetupEncryptionKey = useCallback(async (value: string) => {
        const candidate = value.trim(); if (!candidate) return;
        try {
            showLoading('Setting up key...');
            const endpoint = encryptionKeyConfigured ? '/pin/verify' : '/pin/setText';
            await api.post(endpoint, { key: encodeKey(candidate) });
            await setKey(candidate); await setEncryptionKeyConfigured(true);
            Toast.show({ type: 'success', text1: 'Encryption key configured.' }); setShowEncryptionModal(false);
            if (bioAvailable && !bioEnabled) { const enrolled = await enableBiometric(candidate); if (enrolled) Toast.show({ type: 'success', text1: 'Biometric unlock enabled!' }); }
        } catch (error) { console.error('Key setup failed', error); Toast.show({ type: 'error', text1: 'Invalid encryption key.' }); }
        finally { hideLoading(); }
    }, [bioAvailable, bioEnabled, enableBiometric, hideLoading, setEncryptionKeyConfigured, setKey, showLoading]);

    const handleSignOut = useCallback(async () => {
        showLoading('Signing out...');
        try { await signOut(); Toast.show({ type: 'success', text1: 'Signed out successfully.' }); }
        finally { hideLoading(); }
    }, [hideLoading, showLoading, signOut]);

    const themeModeLabel = themeMode === 'system' ? 'System default' : themeMode === 'dark' ? 'Dark' : 'Light';
    const themeModeIcon = themeMode === 'dark' ? 'weather-night' : themeMode === 'light' ? 'white-balance-sunny' : 'theme-light-dark';

    const handleCycleTheme = useCallback(() => {
        const next = themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system';
        setThemeMode(next);
        const label = next === 'system' ? 'System default' : next === 'dark' ? 'Dark' : 'Light';
        Toast.show({ type: 'info', text1: `Theme: ${label}` });
    }, [themeMode, setThemeMode]);

    const settingsItems: SectionItem[] = [
        { key: 'theme', icon: themeModeIcon, label: 'Theme', subtitle: themeModeLabel, accent: '#8b5cf6', onPress: handleCycleTheme },
        { key: 'notifications', icon: 'bell-outline', label: 'Notifications', subtitle: 'Manage alerts (coming soon)', accent: '#f59e0b' },
    ];

    const securityItems: SectionItem[] = [
        ...(!encryptionKeyConfigured ? [{ key: 'setup-key', icon: 'key-plus', label: 'Set Encryption Key', subtitle: 'Configure your encryption PIN for vault access', accent: '#2563eb', onPress: () => setShowEncryptionModal(true) }] : []),
        ...(bioAvailable ? [{ key: 'biometric', icon: 'fingerprint', label: 'Biometric unlock', subtitle: bioEnabled ? 'Enabled — tap to disable' : 'Disabled — enter PIN in vault to enable', accent: '#10b981', onPress: handleToggleBiometric }] : []),
        { key: 'clear-key', icon: 'key-remove', label: 'Clear cached key', subtitle: 'Require PIN re-entry on next access', accent: '#0ea5e9', onPress: handleClearLocalKey },
        { key: 'reset-key', icon: 'lock-reset', label: 'Reset encryption key', subtitle: 'Deletes all encrypted data permanently', accent: '#ef4444', danger: true, onPress: handleResetEncryptionKey },
    ];

    const dataItems: SectionItem[] = [
        { key: 'export', icon: 'database-export-outline', label: 'Export data', subtitle: 'Coming soon', accent: '#10b981' },
        { key: 'import', icon: 'database-import-outline', label: 'Import data', subtitle: 'Coming soon', accent: '#6366f1' },
    ];

    const aboutItems: SectionItem[] = [
        { key: 'version', icon: 'information-outline', label: 'App version', subtitle: `Amantra v${APP_VERSION}`, accent: '#64748b' },
        { key: 'developer', icon: 'code-tags', label: 'Developer', subtitle: 'amankrs21', accent: '#2563eb' },
    ];

    const renderSection = (title: string, items: SectionItem[]) => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.card}>
                {items.map((item, index) => (
                    <Pressable key={item.key} style={({ pressed }) => [styles.row, pressed && item.onPress && styles.rowPressed, index < items.length - 1 && styles.rowBorder]} onPress={item.onPress} disabled={!item.onPress}>
                        <View style={[styles.iconBadge, { backgroundColor: `${item.accent ?? '#64748b'}20` }]}>
                            <MaterialCommunityIcons name={item.icon as any} size={22} color={item.accent ?? '#64748b'} />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={[styles.rowLabel, item.danger && styles.dangerLabel]}>{item.label}</Text>
                            {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
                        </View>
                        {item.onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.chevron} /> : null}
                    </Pressable>
                ))}
            </View>
        </View>
    );

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile card — replaces dark header */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{(user?.name ?? user?.email ?? 'U').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.profileName}>{user?.name ?? 'User'}</Text>
                        <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
                    </View>
                </View>

                {renderSection('Profile', [
                    { key: 'account', icon: 'account-edit', label: 'Edit Profile', subtitle: 'Update name, date of birth, and more', accent: '#2563eb', onPress: () => router.push({ pathname: '/(tabs)/account', params: { section: 'profile' } } as any) },
                    { key: 'change-password', icon: 'lock-reset', label: 'Change Password', subtitle: 'Update your login password', accent: '#8b5cf6', onPress: () => router.push({ pathname: '/(tabs)/account', params: { section: 'password' } } as any) },
                ])}

                {renderSection('Settings', settingsItems)}
                {renderSection('Security', securityItems)}
                {renderSection('Data', dataItems)}
                {renderSection('About', aboutItems)}

                {renderSection('Critical', [
                    { key: 'deactivate', icon: 'account-remove', label: 'Deactivate Account', subtitle: 'Permanently delete your account and all data', accent: '#ef4444', danger: true, onPress: () => router.push({ pathname: '/(tabs)/account', params: { section: 'deactivate' } } as any) },
                ])}

                <Pressable style={styles.signOutButton} onPress={handleSignOut}>
                    <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                    <Text style={styles.signOutLabel}>Sign out</Text>
                </Pressable>
            </ScrollView>

            <EncryptionKeyModal visible={showEncryptionModal} onClose={() => setShowEncryptionModal(false)} onConfirm={handleSetupEncryptionKey} caption={encryptionKeyConfigured ? 'Re-enter your encryption PIN.' : 'Set your encryption PIN to secure your vault and notes.'} />
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, gap: 24, paddingBottom: 48 },
    profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceSolid, padding: 20, borderRadius: 24, gap: 16, shadowColor: c.cardShadow, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4, borderWidth: 1, borderColor: c.border },
    avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
    profileName: { fontSize: 20, fontWeight: '700', color: c.text },
    profileEmail: { fontSize: 14, color: c.textSecondary },
    section: { gap: 10 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: c.sectionTitle, textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 4 },
    card: { backgroundColor: c.surfaceSolid, borderRadius: 24, overflow: 'hidden', shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 18, elevation: 4, borderWidth: 1, borderColor: c.border },
    row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    rowPressed: { backgroundColor: c.rowPressed },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    iconBadge: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    rowContent: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 16, fontWeight: '600', color: c.text },
    dangerLabel: { color: c.danger },
    rowSubtitle: { fontSize: 13, color: c.textSecondary },
    signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: c.signOutBg, paddingVertical: 16, borderRadius: 20 },
    signOutLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
