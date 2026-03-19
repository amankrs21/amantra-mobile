import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import * as Clipboard from 'expo-clipboard';
import { z } from 'zod';

import EncryptionKeyModal from '@/components/modals/EncryptionKeyModal';
import VaultDeleteModal from '@/components/passwords/VaultDeleteModal';
import VaultFormModal from '@/components/passwords/VaultFormModal';
import CategoryBadge from '@/components/ui/CategoryBadge';
import CategoryFilterBar from '@/components/ui/CategoryFilterBar';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBiometric } from '@/hooks/use-biometric';
import { useEncryptionKey } from '@/hooks/use-encryption-key';
import { useLoading } from '@/hooks/use-loading';
import api from '@/services/api';
import {
    getCategoryDef,
    VAULT_CATEGORIES,
} from '@/utils/categories';
import { decodeKey, encodeKey } from '@/utils/crypto';

const VaultEntrySchema = z.object({
    _id: z.string(),
    title: z.string(),
    username: z.string(),
    updatedAt: z.string(),
    createdAt: z.string().optional(),
    category: z.string().nullable().optional(),
});

type VaultEntry = z.infer<typeof VaultEntrySchema> & { password?: string };

const VaultListSchema = z.array(VaultEntrySchema);

export default function PasswordsScreen() {
    const { encryptionKeyConfigured, setEncryptionKeyConfigured } = useAuth();
    const { encodedKey, setKey, clearKey, isHydrated: isKeyHydrated } = useEncryptionKey();
    const { showLoading, hideLoading } = useLoading();
    const { isAvailable: bioAvailable, isEnabled: bioEnabled, authenticateAndGetKey, enableBiometric } = useBiometric();
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [entries, setEntries] = useState<VaultEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddVisible, setAddVisible] = useState(false);
    const [editEntry, setEditEntry] = useState<VaultEntry | null>(null);
    const [deleteEntry, setDeleteEntry] = useState<VaultEntry | null>(null);
    const [promptKey, setPromptKey] = useState(false);
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
    const hideTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    const filteredEntries = useMemo(() => {
        let result = entries;
        if (searchTerm.trim()) {
            const normalized = searchTerm.trim().toLowerCase();
            result = result.filter((entry) => entry.title.toLowerCase().includes(normalized));
        }
        if (categoryFilter) {
            result = result.filter((entry) => entry.category === categoryFilter);
        }
        return result;
    }, [entries, searchTerm, categoryFilter]);

    const fetchVault = useCallback(async () => {
        showLoading('Loading your vault...');
        try {
            const { data } = await api.post('/vault/fetch', { offSet: 0, pageSize: 100 });
            const parsed = VaultListSchema.safeParse(data);
            if (!parsed.success) throw new Error('Unable to load vault entries');
            setEntries(parsed.data);
        } catch (error) {
            console.error('Vault fetch failed', error);
            toast.error('Cannot fetch passwords', { description: error instanceof Error ? error.message : 'Please try again shortly.' });
        } finally { hideLoading(); }
    }, [hideLoading, showLoading]);

    useEffect(() => { void fetchVault(); }, [fetchVault]);

    useEffect(() => {
        const timers = hideTimers.current;
        return () => { Object.values(timers).forEach((timer) => clearTimeout(timer)); };
    }, []);

    const handleBiometricUnlock = useCallback(async () => {
        const key = await authenticateAndGetKey();
        if (key) { await setKey(key); await setEncryptionKeyConfigured(true); toast.success('Unlocked with biometrics.'); setPromptKey(false); }
    }, [authenticateAndGetKey, setEncryptionKeyConfigured, setKey]);

    const handleKeySubmit = useCallback(async (value: string) => {
        const candidate = value.trim();
        if (!candidate) return;
        try {
            showLoading('Validating key...');
            const endpoint = encryptionKeyConfigured ? '/pin/verify' : '/pin/setText';
            await api.post(endpoint, { key: encodeKey(candidate) });
            await setKey(candidate);
            await setEncryptionKeyConfigured(true);
            toast.success('Encryption key saved for quick access.');
            setPromptKey(false);
            if (bioAvailable && !bioEnabled) {
                const enrolled = await enableBiometric(candidate);
                if (enrolled) toast.success('Biometric unlock enabled!');
            }
        } catch (error) {
            console.error('Key validation failed', error);
            toast.error('Invalid encryption key', { description: 'Double-check your PIN and try again.' });
        } finally { hideLoading(); }
    }, [bioAvailable, bioEnabled, enableBiometric, hideLoading, setEncryptionKeyConfigured, setKey, showLoading]);

    const handleAdd = useCallback(async ({ title, username, password, category }: { title: string; username: string; password: string; category?: string | null }) => {
        if (!encodedKey) { setPromptKey(true); toast.info('Enter your encryption PIN to continue.'); throw new Error('Encryption key required'); }
        showLoading('Saving password...');
        try {
            await api.post('/vault/add', { title, username, password, key: encodedKey, category });
            toast.success('Password added successfully.');
            await fetchVault();
        } catch (error) {
            console.error('Add password failed', error);
            toast.error('Unable to add password', { description: error instanceof Error ? error.message : 'Please try again later.' });
        } finally { hideLoading(); }
    }, [encodedKey, fetchVault, hideLoading, showLoading]);

    const handleUpdate = useCallback(async ({ title, username, password, category }: { title: string; username: string; password: string; category?: string | null }) => {
        if (!encodedKey || !editEntry) { setPromptKey(true); return; }
        showLoading('Updating password...');
        try {
            await api.patch('/vault/update', { id: editEntry._id, title, username, password, key: encodedKey, category: category ?? editEntry.category ?? null });
            toast.success('Password updated.');
            setEditEntry(null);
            await fetchVault();
        } catch (error) {
            console.error('Update password failed', error);
            toast.error('Unable to update password.');
        } finally { hideLoading(); }
    }, [editEntry, encodedKey, fetchVault, hideLoading, showLoading]);

    const handlePrepareEdit = useCallback(async (entry: VaultEntry) => {
        if (!encodedKey) { setPromptKey(true); return; }
        showLoading('Fetching password...');
        try {
            const { data } = await api.post<{ password: string } | string>(`/vault/${entry._id}`, { key: encodedKey });
            const secret = typeof data === 'string' ? decodeKey(data) : decodeKey(data.password);
            setEditEntry({ ...entry, password: secret });
        } catch (error) {
            console.error('Failed to fetch password for editing', error);
            toast.error('Unable to fetch password.');
        } finally { hideLoading(); }
    }, [encodedKey, hideLoading, showLoading]);

    const handleDelete = useCallback(async () => {
        if (!deleteEntry) return;
        showLoading('Deleting password...');
        try {
            await api.delete(`/vault/delete/${deleteEntry._id}`);
            toast.success(`${deleteEntry.title} removed.`);
            setDeleteEntry(null);
            await fetchVault();
        } catch (error) {
            console.error('Delete password failed', error);
            toast.error('Unable to delete password.');
        } finally { hideLoading(); }
    }, [deleteEntry, fetchVault, hideLoading, showLoading]);

    const handleReveal = useCallback(async (entry: VaultEntry) => {
        if (!encodedKey) { setPromptKey(true); return; }
        showLoading('Decrypting password...');
        try {
            const { data } = await api.post<{ password: string } | string>(`/vault/${entry._id}`, { key: encodedKey });
            const secret = typeof data === 'string' ? decodeKey(data) : decodeKey(data.password);
            setRevealedPasswords((prev) => ({ ...prev, [entry._id]: secret }));
            if (hideTimers.current[entry._id]) clearTimeout(hideTimers.current[entry._id]);
            hideTimers.current[entry._id] = setTimeout(() => {
                setRevealedPasswords((prev) => { const next = { ...prev }; delete next[entry._id]; return next; });
            }, 5000);
        } catch (error) {
            console.error('Reveal password failed', error);
            toast.error('Unable to decrypt password.');
            if ((error as { response?: { status?: number } })?.response?.status === 401) await clearKey();
        } finally { hideLoading(); }
    }, [clearKey, encodedKey, hideLoading, showLoading]);

    const handleCopy = useCallback(async (value: string, label: string) => {
        await Clipboard.setStringAsync(value);
        toast.success(`${label} copied to clipboard.`);
    }, []);

    const renderItem = ({ item }: { item: VaultEntry }) => {
        const revealed = revealedPasswords[item._id];
        const catDef = item.category ? getCategoryDef('vault', item.category) : undefined;
        return (
            <View style={styles.itemCard}>
                <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Pressable onPress={() => handleCopy(item.username, 'Username')}>
                        <Text style={styles.itemSubtitle}>{item.username}</Text>
                    </Pressable>
                    {catDef ? <CategoryBadge category={catDef} size="small" /> : null}
                    <Text style={styles.itemTimestamp}>{new Date(item.updatedAt).toLocaleString()}</Text>
                </View>
                <View style={styles.itemActions}>
                    {revealed ? (
                        <Pressable style={styles.revealedBadge} onPress={() => handleCopy(revealed, 'Password')}>
                            <Text style={styles.revealedLabel}>{revealed}</Text>
                        </Pressable>
                    ) : (
                        <Pressable style={styles.revealButton} onPress={() => handleReveal(item)}>
                            <MaterialCommunityIcons name="eye-outline" size={18} color={colors.revealButtonText} />
                            <Text style={styles.revealLabel}>Reveal</Text>
                        </Pressable>
                    )}
                    <Pressable style={styles.iconButton} onPress={() => handlePrepareEdit(item)}>
                        <MaterialCommunityIcons name="pencil" size={18} color={colors.accent} />
                    </Pressable>
                    <Pressable style={styles.iconButton} onPress={() => setDeleteEntry(item)}>
                        <MaterialCommunityIcons name="trash-can" size={18} color={colors.danger} />
                    </Pressable>
                </View>
            </View>
        );
    };

    const listEmptyComponent = () => (
        <View style={styles.emptyState}>
            <MaterialCommunityIcons name="shield-key-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No passwords yet</Text>
            <Text style={styles.emptySubtitle}>Tap the plus button to start securing your credentials.</Text>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Password Vault</Text>
                    <Text style={styles.headerSubtitle}>All your credentials, strongly encrypted and searchable.</Text>
                </View>
                <MaterialCommunityIcons name="shield-lock" size={36} color="#38bdf8" />
            </View>

            <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.placeholder} />
                <TextInput placeholder="Search by title" placeholderTextColor={colors.placeholder} style={styles.searchInput} value={searchTerm} onChangeText={setSearchTerm} />
                <Pressable style={styles.clearButton} onPress={() => setSearchTerm('')}>
                    <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
            </View>

            <CategoryFilterBar categories={VAULT_CATEGORIES} selected={categoryFilter} onSelect={setCategoryFilter} />

            <FlatList
                data={filteredEntries}
                keyExtractor={(item) => item._id}
                contentContainerStyle={filteredEntries.length === 0 ? styles.emptyList : { gap: 16, paddingBottom: 120 }}
                renderItem={renderItem}
                ListEmptyComponent={listEmptyComponent}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
            />

            <Pressable style={styles.fab} onPress={() => setAddVisible(true)}>
                <MaterialCommunityIcons name="plus" size={26} color={colors.fabIcon} />
            </Pressable>

            <VaultFormModal visible={isAddVisible} mode="create" onClose={() => setAddVisible(false)} onSubmit={handleAdd} categories={VAULT_CATEGORIES} />
            {editEntry ? (<VaultFormModal visible mode="edit" initialValues={{ title: editEntry.title, username: editEntry.username, password: editEntry.password ?? '' }} onClose={() => setEditEntry(null)} onSubmit={handleUpdate} categoryKey={editEntry.category ?? null} categories={VAULT_CATEGORIES} />) : null}
            {deleteEntry ? (<VaultDeleteModal visible title={deleteEntry.title} onClose={() => setDeleteEntry(null)} onConfirm={handleDelete} />) : null}
            <EncryptionKeyModal visible={promptKey && isKeyHydrated} onClose={() => setPromptKey(false)} onConfirm={handleKeySubmit} caption={encryptionKeyConfigured ? 'Re-enter your encryption PIN to continue.' : 'Set your encryption PIN to unlock passwords.'} biometricAvailable={bioAvailable && bioEnabled} onBiometric={handleBiometricUnlock} />
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 24 },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.headerBg, padding: 20, borderRadius: 20, marginBottom: 20, gap: 18 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
    headerSubtitle: { fontSize: 14, color: 'rgba(226, 232, 240, 0.75)' },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceSolid, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, fontSize: 16, color: c.text },
    clearButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cancelBg },
    itemCard: { backgroundColor: c.surfaceSolid, borderRadius: 18, padding: 18, flexDirection: 'row', gap: 16, alignItems: 'center', shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: c.border },
    itemTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    itemSubtitle: { fontSize: 14, color: c.tint },
    itemTimestamp: { fontSize: 12, color: c.textSecondary },
    itemActions: { gap: 12, alignItems: 'flex-end' },
    revealButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.revealButtonBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
    revealLabel: { fontSize: 13, fontWeight: '600', color: c.revealButtonText },
    iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.iconButtonBg },
    revealedBadge: { backgroundColor: c.revealBadge, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    revealedLabel: { color: c.text, fontWeight: '600' },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyState: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
    fab: { position: 'absolute', right: 24, bottom: 32, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fab, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
});
