import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import { z } from 'zod';

import EncryptionKeyModal from '@/components/modals/EncryptionKeyModal';
import VaultDeleteModal from '@/components/passwords/VaultDeleteModal';
import VaultFormModal from '@/components/passwords/VaultFormModal';
import CategoryBadge from '@/components/ui/CategoryBadge';
import CategoryFilterBar from '@/components/ui/CategoryFilterBar';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBiometric } from '@/hooks/use-biometric';
import { useEncryptionKey } from '@/hooks/use-encryption-key';
import { useLoading } from '@/hooks/use-loading';
import api from '@/services/api';
import {
    type CategoryMapping,
    getCategoryDef,
    getCategoryMapping,
    setCategoryForEntry,
    VAULT_CATEGORIES,
} from '@/utils/categories';
import { decodeKey, encodeKey } from '@/utils/crypto';

const VaultEntrySchema = z.object({
    _id: z.string(),
    title: z.string(),
    username: z.string(),
    updatedAt: z.string(),
    createdAt: z.string(),
});

type VaultEntry = z.infer<typeof VaultEntrySchema> & { password?: string };

const VaultListSchema = z.array(VaultEntrySchema);

export default function PasswordsScreen() {
    const { encryptionKeyConfigured, setEncryptionKeyConfigured } = useAuth();
    const { encodedKey, setKey, clearKey, isHydrated: isKeyHydrated } = useEncryptionKey();
    const { showLoading, hideLoading } = useLoading();
    const { isAvailable: bioAvailable, isEnabled: bioEnabled, authenticateAndGetKey, enableBiometric } = useBiometric();

    const [entries, setEntries] = useState<VaultEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddVisible, setAddVisible] = useState(false);
    const [editEntry, setEditEntry] = useState<VaultEntry | null>(null);
    const [deleteEntry, setDeleteEntry] = useState<VaultEntry | null>(null);
    const [promptKey, setPromptKey] = useState(false);
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
    const hideTimers = useRef<Record<string, NodeJS.Timeout>>({});
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [categoryMap, setCategoryMap] = useState<CategoryMapping>({});
    const [addCategory, setAddCategory] = useState<string | null>(null);

    // Load categories
    useEffect(() => {
        void getCategoryMapping('vault').then(setCategoryMap);
    }, []);

    const filteredEntries = useMemo(() => {
        let result = entries;
        if (searchTerm.trim()) {
            const normalized = searchTerm.trim().toLowerCase();
            result = result.filter((entry) => entry.title.toLowerCase().includes(normalized));
        }
        if (categoryFilter) {
            result = result.filter((entry) => categoryMap[entry._id] === categoryFilter);
        }
        return result;
    }, [entries, searchTerm, categoryFilter, categoryMap]);

    const fetchVault = useCallback(async () => {
        showLoading('Loading your vault...');
        try {
            const { data } = await api.post('/vault/fetch', {
                offSet: 0,
                pageSize: 100,
            });

            const parsed = VaultListSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error('Unable to load vault entries');
            }

            setEntries(parsed.data);
        } catch (error) {
            console.error('Vault fetch failed', error);
            Toast.show({
                type: 'error',
                text1: 'Cannot fetch passwords',
                text2: error instanceof Error ? error.message : 'Please try again shortly.',
            });
        } finally {
            hideLoading();
        }
    }, [hideLoading, showLoading]);

    useEffect(() => {
        void fetchVault();
    }, [fetchVault]);

    useEffect(() => {
        const timers = hideTimers.current;
        return () => {
            Object.values(timers).forEach((timer) => clearTimeout(timer));
        };
    }, []);

    const handleBiometricUnlock = useCallback(async () => {
        const key = await authenticateAndGetKey();
        if (key) {
            await setKey(key);
            await setEncryptionKeyConfigured(true);
            Toast.show({ type: 'success', text1: 'Unlocked with biometrics.' });
            setPromptKey(false);
        }
    }, [authenticateAndGetKey, setEncryptionKeyConfigured, setKey]);

    const handleKeySubmit = useCallback(
        async (value: string) => {
            const candidate = value.trim();
            if (!candidate) {
                return;
            }

            try {
                showLoading('Validating key...');
                await api.post('/pin/verify', {
                    key: encodeKey(candidate),
                });
                await setKey(candidate);
                await setEncryptionKeyConfigured(true);
                Toast.show({ type: 'success', text1: 'Encryption key saved for quick access.' });
                setPromptKey(false);

                // Offer biometric enrollment if available but not enabled
                if (bioAvailable && !bioEnabled) {
                    const enrolled = await enableBiometric(candidate);
                    if (enrolled) {
                        Toast.show({ type: 'success', text1: 'Biometric unlock enabled!' });
                    }
                }
            } catch (error) {
                console.error('Key validation failed', error);
                Toast.show({
                    type: 'error',
                    text1: 'Invalid encryption key',
                    text2: 'Double-check your PIN and try again.',
                });
            } finally {
                hideLoading();
            }
        },
        [bioAvailable, bioEnabled, enableBiometric, hideLoading, setEncryptionKeyConfigured, setKey, showLoading],
    );

    const handleAdd = useCallback(
        async ({ title, username, password }: { title: string; username: string; password: string }) => {
            if (!encodedKey) {
                setPromptKey(true);
                Toast.show({ type: 'info', text1: 'Enter your encryption PIN to continue.' });
                throw new Error('Encryption key required');
            }

            showLoading('Saving password...');
            try {
                const { data } = await api.post('/vault/add', {
                    title,
                    username,
                    password,
                    key: encodedKey,
                });
                Toast.show({ type: 'success', text1: 'Password added successfully.' });

                // Save category if selected
                if (addCategory && data?._id) {
                    await setCategoryForEntry('vault', data._id, addCategory);
                    setCategoryMap((prev) => ({ ...prev, [data._id]: addCategory }));
                }
                setAddCategory(null);
                await fetchVault();
            } catch (error) {
                console.error('Add password failed', error);
                Toast.show({
                    type: 'error',
                    text1: 'Unable to add password',
                    text2: error instanceof Error ? error.message : 'Please try again later.',
                });
            } finally {
                hideLoading();
            }
        },
        [addCategory, encodedKey, fetchVault, hideLoading, showLoading],
    );

    const handleUpdate = useCallback(
        async ({ title, username, password }: { title: string; username: string; password: string }) => {
            if (!encodedKey || !editEntry) {
                setPromptKey(true);
                return;
            }

            showLoading('Updating password...');
            try {
                await api.patch('/vault/update', {
                    id: editEntry._id,
                    title,
                    username,
                    password,
                    key: encodedKey,
                });
                Toast.show({ type: 'success', text1: 'Password updated.' });
                setEditEntry(null);
                await fetchVault();
            } catch (error) {
                console.error('Update password failed', error);
                Toast.show({ type: 'error', text1: 'Unable to update password.' });
            } finally {
                hideLoading();
            }
        },
        [editEntry, encodedKey, fetchVault, hideLoading, showLoading],
    );

    const handlePrepareEdit = useCallback(
        async (entry: VaultEntry) => {
            if (!encodedKey) {
                setPromptKey(true);
                return;
            }

            showLoading('Fetching password...');
            try {
                const { data } = await api.post<{ password: string } | string>(`/vault/${entry._id}`, {
                    key: encodedKey,
                });

                const secret = typeof data === 'string' ? decodeKey(data) : decodeKey(data.password);
                setEditEntry({ ...entry, password: secret });
            } catch (error) {
                console.error('Failed to fetch password for editing', error);
                Toast.show({ type: 'error', text1: 'Unable to fetch password.' });
            } finally {
                hideLoading();
            }
        },
        [encodedKey, hideLoading, showLoading],
    );

    const handleDelete = useCallback(async () => {
        if (!deleteEntry) {
            return;
        }

        showLoading('Deleting password...');
        try {
            await api.delete(`/vault/delete/${deleteEntry._id}`);
            Toast.show({ type: 'success', text1: `${deleteEntry.title} removed.` });
            setDeleteEntry(null);
            await fetchVault();
        } catch (error) {
            console.error('Delete password failed', error);
            Toast.show({ type: 'error', text1: 'Unable to delete password.' });
        } finally {
            hideLoading();
        }
    }, [deleteEntry, fetchVault, hideLoading, showLoading]);

    const handleReveal = useCallback(
        async (entry: VaultEntry) => {
            if (!encodedKey) {
                setPromptKey(true);
                return;
            }

            showLoading('Decrypting password...');
            try {
                const { data } = await api.post<{ password: string } | string>(`/vault/${entry._id}`, {
                    key: encodedKey,
                });

                const secret = typeof data === 'string' ? decodeKey(data) : decodeKey(data.password);
                setRevealedPasswords((prev) => ({ ...prev, [entry._id]: secret }));

                if (hideTimers.current[entry._id]) {
                    clearTimeout(hideTimers.current[entry._id]);
                }
                hideTimers.current[entry._id] = setTimeout(() => {
                    setRevealedPasswords((prev) => {
                        const next = { ...prev };
                        delete next[entry._id];
                        return next;
                    });
                }, 5000);
            } catch (error) {
                console.error('Reveal password failed', error);
                Toast.show({ type: 'error', text1: 'Unable to decrypt password.' });
                if ((error as { response?: { status?: number } })?.response?.status === 401) {
                    await clearKey();
                }
            } finally {
                hideLoading();
            }
        },
        [clearKey, encodedKey, hideLoading, showLoading],
    );

    const handleCopy = useCallback(async (value: string, label: string) => {
        await Clipboard.setStringAsync(value);
        Toast.show({ type: 'success', text1: `${label} copied to clipboard.` });
    }, []);

    const handleCategoryChange = useCallback(async (entryId: string, categoryKey: string | null) => {
        await setCategoryForEntry('vault', entryId, categoryKey);
        setCategoryMap((prev) => {
            const next = { ...prev };
            if (categoryKey) {
                next[entryId] = categoryKey;
            } else {
                delete next[entryId];
            }
            return next;
        });
    }, []);

    const renderItem = ({ item }: { item: VaultEntry }) => {
        const revealed = revealedPasswords[item._id];
        const catKey = categoryMap[item._id];
        const catDef = catKey ? getCategoryDef('vault', catKey) : undefined;

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
                            <MaterialCommunityIcons name="eye-outline" size={18} color="#1e3a8a" />
                            <Text style={styles.revealLabel}>Reveal</Text>
                        </Pressable>
                    )}
                    <Pressable style={styles.iconButton} onPress={() => handlePrepareEdit(item)}>
                        <MaterialCommunityIcons name="pencil" size={18} color="#2563eb" />
                    </Pressable>
                    <Pressable style={styles.iconButton} onPress={() => setDeleteEntry(item)}>
                        <MaterialCommunityIcons name="trash-can" size={18} color="#ef4444" />
                    </Pressable>
                </View>
            </View>
        );
    };

    const listEmptyComponent = () => (
        <View style={styles.emptyState}>
            <MaterialCommunityIcons name="shield-key-outline" size={48} color="rgba(148, 163, 184, 0.8)" />
            <Text style={styles.emptyTitle}>No passwords yet</Text>
            <Text style={styles.emptySubtitle}>Tap the plus button to start securing your credentials.</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Password Vault</Text>
                    <Text style={styles.headerSubtitle}>All your credentials, strongly encrypted and searchable.</Text>
                </View>
                <MaterialCommunityIcons name="shield-lock" size={36} color="#38bdf8" />
            </View>

            <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={20} color="rgba(15, 23, 42, 0.3)" />
                <TextInput
                    placeholder="Search by title"
                    placeholderTextColor="rgba(15, 23, 42, 0.3)"
                    style={styles.searchInput}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
                <Pressable style={styles.clearButton} onPress={() => setSearchTerm('')}>
                    <MaterialCommunityIcons name="close" size={18} color="rgba(15, 23, 42, 0.6)" />
                </Pressable>
            </View>

            <CategoryFilterBar
                categories={VAULT_CATEGORIES}
                selected={categoryFilter}
                onSelect={setCategoryFilter}
            />

            <FlatList
                data={filteredEntries}
                keyExtractor={(item) => item._id}
                contentContainerStyle={filteredEntries.length === 0 ? styles.emptyList : { gap: 16, paddingBottom: 120 }}
                renderItem={renderItem}
                ListEmptyComponent={listEmptyComponent}
            />

            <Pressable style={styles.fab} onPress={() => setAddVisible(true)}>
                <MaterialCommunityIcons name="plus" size={26} color="#fff" />
            </Pressable>

            <VaultFormModal
                visible={isAddVisible}
                mode="create"
                onClose={() => { setAddVisible(false); setAddCategory(null); }}
                onSubmit={handleAdd}
                categoryKey={addCategory}
                onCategoryChange={setAddCategory}
                categories={VAULT_CATEGORIES}
            />

            {editEntry ? (
                <VaultFormModal
                    visible
                    mode="edit"
                    initialValues={{ title: editEntry.title, username: editEntry.username, password: editEntry.password ?? '' }}
                    onClose={() => setEditEntry(null)}
                    onSubmit={handleUpdate}
                    categoryKey={categoryMap[editEntry._id] ?? null}
                    onCategoryChange={(key) => handleCategoryChange(editEntry._id, key)}
                    categories={VAULT_CATEGORIES}
                />
            ) : null}

            {deleteEntry ? (
                <VaultDeleteModal
                    visible
                    title={deleteEntry.title}
                    onClose={() => setDeleteEntry(null)}
                    onConfirm={handleDelete}
                />
            ) : null}

            <EncryptionKeyModal
                visible={promptKey && isKeyHydrated}
                onClose={() => setPromptKey(false)}
                onConfirm={handleKeySubmit}
                caption={encryptionKeyConfigured ? 'Re-enter your encryption PIN to continue.' : 'Set your encryption PIN to unlock passwords.'}
                biometricAvailable={bioAvailable && bioEnabled}
                onBiometric={handleBiometricUnlock}
            />
        </View>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e2e8f0',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#020617',
        padding: 20,
        borderRadius: 20,
        marginBottom: 20,
        gap: 18,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(226, 232, 240, 0.75)',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#0f172a',
    },
    clearButton: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.06)',
    },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 18,
        flexDirection: 'row',
        gap: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
    },
    itemSubtitle: {
        fontSize: 14,
        color: Colors.light.tint,
    },
    itemTimestamp: {
        fontSize: 12,
        color: 'rgba(15, 23, 42, 0.6)',
    },
    itemActions: {
        gap: 12,
        alignItems: 'flex-end',
    },
    revealButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(37, 99, 235, 0.15)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    revealLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e3a8a',
    },
    iconButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(148, 163, 184, 0.18)',
    },
    revealedBadge: {
        backgroundColor: '#22d3ee',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    revealedLabel: {
        color: '#0f172a',
        fontWeight: '600',
    },
    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptyState: {
        alignItems: 'center',
        gap: 8,
        paddingTop: 48,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
    },
    emptySubtitle: {
        fontSize: 14,
        color: 'rgba(15, 23, 42, 0.65)',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 32,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.tint,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
});
