import { useCallback, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { useAuth } from '@/hooks/use-auth';
import { useBiometric } from '@/hooks/use-biometric';
import { useLoading } from '@/hooks/use-loading';
import { useEncryptionKey } from '@/hooks/use-encryption-key';
import api from '@/services/api';

const APP_VERSION = '1.0.0';

type SectionItem = {
    key: string;
    icon: string;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    accent?: string;
    danger?: boolean;
};

export default function MoreScreen() {
    const { user, signOut, setEncryptionKeyConfigured } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const { clearKey } = useEncryptionKey();
    const { isAvailable: bioAvailable, isEnabled: bioEnabled, enableBiometric, disableBiometric } = useBiometric();

    const handleToggleBiometric = useCallback(async () => {
        if (bioEnabled) {
            await disableBiometric();
            Toast.show({ type: 'success', text1: 'Biometric unlock disabled.' });
        } else {
            Toast.show({
                type: 'info',
                text1: 'Enter your encryption PIN in the vault to enable biometric unlock.',
                text2: 'Biometric enrollment happens after a successful PIN entry.',
            });
        }
    }, [bioEnabled, disableBiometric]);

    const handleResetEncryptionKey = useCallback(() => {
        Alert.alert(
            'Reset Encryption Key',
            'This will permanently delete ALL your encrypted passwords and notes. This action cannot be undone.\n\nAre you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        showLoading('Resetting encryption key...');
                        try {
                            await api.get('/pin/reset');
                            await clearKey();
                            await setEncryptionKeyConfigured(false);
                            Toast.show({ type: 'success', text1: 'Encryption key reset.', text2: 'Set a new key when you next access your vault.' });
                        } catch (error) {
                            console.error('Failed to reset encryption key', error);
                            Toast.show({ type: 'error', text1: 'Unable to reset encryption key.' });
                        } finally {
                            hideLoading();
                        }
                    },
                },
            ],
        );
    }, [clearKey, hideLoading, setEncryptionKeyConfigured, showLoading]);

    const handleClearLocalKey = useCallback(async () => {
        await clearKey();
        Toast.show({ type: 'success', text1: 'Local encryption key cleared.', text2: 'You\'ll be prompted to re-enter it next time.' });
    }, [clearKey]);

    const handleSignOut = useCallback(async () => {
        showLoading('Signing out...');
        try {
            await signOut();
            Toast.show({ type: 'success', text1: 'Signed out successfully.' });
        } finally {
            hideLoading();
        }
    }, [hideLoading, showLoading, signOut]);

    const settingsItems: SectionItem[] = [
        {
            key: 'theme',
            icon: 'theme-light-dark',
            label: 'Theme',
            subtitle: 'System default (coming soon)',
            accent: '#8b5cf6',
        },
        {
            key: 'notifications',
            icon: 'bell-outline',
            label: 'Notifications',
            subtitle: 'Manage alerts (coming soon)',
            accent: '#f59e0b',
        },
    ];

    const securityItems: SectionItem[] = [
        ...(bioAvailable ? [{
            key: 'biometric',
            icon: 'fingerprint',
            label: 'Biometric unlock',
            subtitle: bioEnabled ? 'Enabled — tap to disable' : 'Disabled — enter PIN in vault to enable',
            accent: '#10b981',
            onPress: handleToggleBiometric,
        }] : []),
        {
            key: 'clear-key',
            icon: 'key-remove',
            label: 'Clear cached key',
            subtitle: 'Require PIN re-entry on next access',
            accent: '#0ea5e9',
            onPress: handleClearLocalKey,
        },
        {
            key: 'reset-key',
            icon: 'lock-reset',
            label: 'Reset encryption key',
            subtitle: 'Deletes all encrypted data permanently',
            accent: '#ef4444',
            danger: true,
            onPress: handleResetEncryptionKey,
        },
    ];

    const dataItems: SectionItem[] = [
        {
            key: 'export',
            icon: 'database-export-outline',
            label: 'Export data',
            subtitle: 'Coming soon',
            accent: '#10b981',
        },
        {
            key: 'import',
            icon: 'database-import-outline',
            label: 'Import data',
            subtitle: 'Coming soon',
            accent: '#6366f1',
        },
    ];

    const aboutItems: SectionItem[] = [
        {
            key: 'version',
            icon: 'information-outline',
            label: 'App version',
            subtitle: `Amantra v${APP_VERSION}`,
            accent: '#64748b',
        },
        {
            key: 'developer',
            icon: 'code-tags',
            label: 'Developer',
            subtitle: 'amankrs21',
            accent: '#2563eb',
        },
    ];

    const renderSection = (title: string, items: SectionItem[]) => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.card}>
                {items.map((item, index) => (
                    <Pressable
                        key={item.key}
                        style={({ pressed }) => [
                            styles.row,
                            pressed && item.onPress && styles.rowPressed,
                            index < items.length - 1 && styles.rowBorder,
                        ]}
                        onPress={item.onPress}
                        disabled={!item.onPress}
                    >
                        <View style={[styles.iconBadge, { backgroundColor: `${item.accent ?? '#64748b'}20` }]}>
                            <MaterialCommunityIcons name={item.icon as any} size={22} color={item.accent ?? '#64748b'} />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={[styles.rowLabel, item.danger && styles.dangerLabel]}>{item.label}</Text>
                            {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
                        </View>
                        {item.onPress ? (
                            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(15, 23, 42, 0.25)" />
                        ) : null}
                    </Pressable>
                ))}
            </View>
        </View>
    );

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.title}>More</Text>
                        <Text style={styles.subtitle}>Settings, security, and app information.</Text>
                    </View>
                    <View style={styles.headerIcon}>
                        <MaterialCommunityIcons name="cog-outline" size={32} color="#38bdf8" />
                    </View>
                </View>

                {renderSection('Settings', settingsItems)}
                {renderSection('Security', securityItems)}
                {renderSection('Data', dataItems)}
                {renderSection('About', aboutItems)}

                <Pressable style={styles.signOutButton} onPress={handleSignOut}>
                    <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                    <Text style={styles.signOutLabel}>Sign out</Text>
                </Pressable>
            </ScrollView>
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
    section: {
        gap: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: 'rgba(15, 23, 42, 0.55)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        paddingLeft: 4,
    },
    card: {
        backgroundColor: '#f8fafc',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowRadius: 18,
        elevation: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
    },
    rowPressed: {
        backgroundColor: 'rgba(15, 23, 42, 0.04)',
    },
    rowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(15, 23, 42, 0.08)',
    },
    iconBadge: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowContent: {
        flex: 1,
        gap: 2,
    },
    rowLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    dangerLabel: {
        color: '#dc2626',
    },
    rowSubtitle: {
        fontSize: 13,
        color: 'rgba(15, 23, 42, 0.55)',
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#1e293b',
        paddingVertical: 16,
        borderRadius: 20,
    },
    signOutLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
