import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    LayoutAnimation,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    UIManager,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import { z } from 'zod';

import EncryptionKeyModal from '@/components/modals/EncryptionKeyModal';
import VaultDeleteModal from '@/components/passwords/VaultDeleteModal';
import VaultFormModal from '@/components/passwords/VaultFormModal';
import NoteDeleteModal from '@/components/notes/NoteDeleteModal';
import NoteFormModal from '@/components/notes/NoteFormModal';
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
    type CategoryMapping,
    getCategoryDef,
    getCategoryMapping,
    setCategoryForEntry,
    VAULT_CATEGORIES,
    NOTES_CATEGORIES,
} from '@/utils/categories';
import { decodeKey, encodeKey } from '@/utils/crypto';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Schemas ──
const VaultEntrySchema = z.object({ _id: z.string(), title: z.string(), username: z.string(), updatedAt: z.string(), createdAt: z.string().optional() });
type VaultEntry = z.infer<typeof VaultEntrySchema> & { password?: string };
const VaultListSchema = z.array(VaultEntrySchema);

const NoteSchema = z.object({ _id: z.string(), title: z.string(), updatedAt: z.string(), createdAt: z.string().optional() });
type Note = z.infer<typeof NoteSchema> & { content?: string };
const NoteListSchema = z.array(NoteSchema);

type Segment = 'passwords' | 'notes';

export default function VaultScreen() {
    const { encryptionKeyConfigured, setEncryptionKeyConfigured } = useAuth();
    const { encodedKey, setKey, clearKey, isHydrated: isKeyHydrated } = useEncryptionKey();
    const { showLoading, hideLoading } = useLoading();
    const { isAvailable: bioAvailable, isEnabled: bioEnabled, authenticateAndGetKey, enableBiometric } = useBiometric();
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // ── Segment control ──
    const [activeSegment, setActiveSegment] = useState<Segment>('passwords');
    const slideAnim = useRef(new Animated.Value(0)).current;

    const switchSegment = useCallback((seg: Segment) => {
        setActiveSegment(seg);
        Animated.spring(slideAnim, { toValue: seg === 'passwords' ? 0 : 1, useNativeDriver: false, friction: 8, tension: 60 }).start();
    }, [slideAnim]);

    // ── Shared state ──
    const [searchTerm, setSearchTerm] = useState('');
    const [promptKey, setPromptKey] = useState(false);

    // ── Passwords state ──
    const [entries, setEntries] = useState<VaultEntry[]>([]);
    const [isAddVisible, setAddVisible] = useState(false);
    const [editEntry, setEditEntry] = useState<VaultEntry | null>(null);
    const [deleteEntry, setDeleteEntry] = useState<VaultEntry | null>(null);
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
    const hideTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const [vaultCategoryFilter, setVaultCategoryFilter] = useState<string | null>(null);
    const [vaultCategoryMap, setVaultCategoryMap] = useState<CategoryMapping>({});
    const [addVaultCategory, setAddVaultCategory] = useState<string | null>(null);

    // ── Notes state ──
    const [notes, setNotes] = useState<Note[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [noteAddVisible, setNoteAddVisible] = useState(false);
    const [editNote, setEditNote] = useState<Note | null>(null);
    const [deleteNote, setDeleteNote] = useState<Note | null>(null);
    const [activeContent, setActiveContent] = useState<Record<string, string>>({});
    const [notesCategoryFilter, setNotesCategoryFilter] = useState<string | null>(null);
    const [notesCategoryMap, setNotesCategoryMap] = useState<CategoryMapping>({});
    const [addNotesCategory, setAddNotesCategory] = useState<string | null>(null);

    // ── Load categories ──
    useEffect(() => { void getCategoryMapping('vault').then(setVaultCategoryMap); }, []);
    useEffect(() => { void getCategoryMapping('notes').then(setNotesCategoryMap); }, []);

    // ── Filtered lists ──
    const filteredEntries = useMemo(() => {
        let result = entries;
        if (searchTerm.trim()) { const n = searchTerm.trim().toLowerCase(); result = result.filter((e) => e.title.toLowerCase().includes(n)); }
        if (vaultCategoryFilter) result = result.filter((e) => vaultCategoryMap[e._id] === vaultCategoryFilter);
        return result;
    }, [entries, searchTerm, vaultCategoryFilter, vaultCategoryMap]);

    const filteredNotes = useMemo(() => {
        let result = notes;
        if (searchTerm.trim()) { const n = searchTerm.trim().toLowerCase(); result = result.filter((note) => note.title.toLowerCase().includes(n)); }
        if (notesCategoryFilter) result = result.filter((note) => notesCategoryMap[note._id] === notesCategoryFilter);
        return result;
    }, [notes, searchTerm, notesCategoryFilter, notesCategoryMap]);

    // ── Fetch data ──
    const fetchVault = useCallback(async () => {
        showLoading('Loading your vault...');
        try { const { data } = await api.post('/vault/fetch', { offSet: 0, pageSize: 100 }); const parsed = VaultListSchema.safeParse(data); if (!parsed.success) throw new Error('Unable to load vault entries'); setEntries(parsed.data); }
        catch (error) { console.error('Vault fetch failed', error); Toast.show({ type: 'error', text1: 'Cannot fetch passwords', text2: error instanceof Error ? error.message : 'Please try again shortly.' }); }
        finally { hideLoading(); }
    }, [hideLoading, showLoading]);

    const fetchNotes = useCallback(async () => {
        showLoading('Loading encrypted notes...');
        try { const { data } = await api.get('/journal/fetch'); const parsed = NoteListSchema.safeParse(data); if (!parsed.success) throw new Error('Unable to load notes'); setNotes(parsed.data); }
        catch (error) { console.error('Fetch notes failed', error); Toast.show({ type: 'error', text1: 'Unable to load notes.' }); }
        finally { hideLoading(); }
    }, [hideLoading, showLoading]);

    useEffect(() => { void fetchVault(); }, [fetchVault]);
    useEffect(() => { void fetchNotes(); }, [fetchNotes]);

    useEffect(() => { const timers = hideTimers.current; return () => { Object.values(timers).forEach((t) => clearTimeout(t)); }; }, []);

    // ── Shared encryption handlers ──
    const handleBiometricUnlock = useCallback(async () => {
        const key = await authenticateAndGetKey();
        if (key) { await setKey(key); await setEncryptionKeyConfigured(true); Toast.show({ type: 'success', text1: 'Unlocked with biometrics.' }); setPromptKey(false); }
    }, [authenticateAndGetKey, setEncryptionKeyConfigured, setKey]);

    const handleKeySubmit = useCallback(async (value: string) => {
        const candidate = value.trim(); if (!candidate) return;
        try {
            showLoading('Validating key...');
            const endpoint = encryptionKeyConfigured ? '/pin/verify' : '/pin/setText';
            await api.post(endpoint, { key: encodeKey(candidate) });
            await setKey(candidate); await setEncryptionKeyConfigured(true);
            Toast.show({ type: 'success', text1: 'Encryption key saved for quick access.' }); setPromptKey(false);
            if (bioAvailable && !bioEnabled) { const enrolled = await enableBiometric(candidate); if (enrolled) Toast.show({ type: 'success', text1: 'Biometric unlock enabled!' }); }
        } catch { Toast.show({ type: 'error', text1: 'Invalid encryption key.' }); }
        finally { hideLoading(); }
    }, [bioAvailable, bioEnabled, enableBiometric, hideLoading, setEncryptionKeyConfigured, setKey, showLoading]);

    // ── Password CRUD ──
    const handleAddPassword = useCallback(async ({ title, username, password }: { title: string; username: string; password: string }) => {
        if (!encodedKey) { setPromptKey(true); Toast.show({ type: 'info', text1: 'Enter your encryption PIN to continue.' }); throw new Error('Encryption key required'); }
        showLoading('Saving password...');
        try {
            const { data } = await api.post('/vault/add', { title, username, password, key: encodedKey });
            Toast.show({ type: 'success', text1: 'Password added successfully.' });
            if (addVaultCategory && data?._id) { await setCategoryForEntry('vault', data._id, addVaultCategory); setVaultCategoryMap((prev) => ({ ...prev, [data._id]: addVaultCategory })); }
            setAddVaultCategory(null); await fetchVault();
        } catch (error) { console.error('Add password failed', error); Toast.show({ type: 'error', text1: 'Unable to add password.' }); }
        finally { hideLoading(); }
    }, [addVaultCategory, encodedKey, fetchVault, hideLoading, showLoading]);

    const handleUpdatePassword = useCallback(async ({ title, username, password }: { title: string; username: string; password: string }) => {
        if (!encodedKey || !editEntry) { setPromptKey(true); return; }
        showLoading('Updating password...');
        try { await api.patch('/vault/update', { id: editEntry._id, title, username, password, key: encodedKey }); Toast.show({ type: 'success', text1: 'Password updated.' }); setEditEntry(null); await fetchVault(); }
        catch (error) { console.error('Update password failed', error); Toast.show({ type: 'error', text1: 'Unable to update password.' }); }
        finally { hideLoading(); }
    }, [editEntry, encodedKey, fetchVault, hideLoading, showLoading]);

    const handlePrepareEditPassword = useCallback(async (entry: VaultEntry) => {
        if (!encodedKey) { setPromptKey(true); return; }
        showLoading('Fetching password...');
        try { const { data } = await api.post<{ password: string } | string>(`/vault/${entry._id}`, { key: encodedKey }); const secret = typeof data === 'string' ? decodeKey(data) : decodeKey(data.password); setEditEntry({ ...entry, password: secret }); }
        catch (error) { console.error('Failed to fetch password for editing', error); Toast.show({ type: 'error', text1: 'Unable to fetch password.' }); }
        finally { hideLoading(); }
    }, [encodedKey, hideLoading, showLoading]);

    const handleDeletePassword = useCallback(async () => {
        if (!deleteEntry) return;
        showLoading('Deleting password...');
        try { await api.delete(`/vault/delete/${deleteEntry._id}`); Toast.show({ type: 'success', text1: `${deleteEntry.title} removed.` }); setDeleteEntry(null); await fetchVault(); }
        catch (error) { console.error('Delete password failed', error); Toast.show({ type: 'error', text1: 'Unable to delete password.' }); }
        finally { hideLoading(); }
    }, [deleteEntry, fetchVault, hideLoading, showLoading]);

    const handleReveal = useCallback(async (entry: VaultEntry) => {
        if (!encodedKey) { setPromptKey(true); return; }
        showLoading('Decrypting password...');
        try {
            const { data } = await api.post<{ password: string } | string>(`/vault/${entry._id}`, { key: encodedKey });
            const secret = typeof data === 'string' ? decodeKey(data) : decodeKey(data.password);
            setRevealedPasswords((prev) => ({ ...prev, [entry._id]: secret }));
            if (hideTimers.current[entry._id]) clearTimeout(hideTimers.current[entry._id]);
            hideTimers.current[entry._id] = setTimeout(() => { setRevealedPasswords((prev) => { const next = { ...prev }; delete next[entry._id]; return next; }); }, 5000);
        } catch (error) { console.error('Reveal password failed', error); Toast.show({ type: 'error', text1: 'Unable to decrypt password.' }); if ((error as any)?.response?.status === 401) await clearKey(); }
        finally { hideLoading(); }
    }, [clearKey, encodedKey, hideLoading, showLoading]);

    const handleCopy = useCallback(async (value: string, label: string) => { await Clipboard.setStringAsync(value); Toast.show({ type: 'success', text1: `${label} copied to clipboard.` }); }, []);

    const handleVaultCategoryChange = useCallback(async (entryId: string, categoryKey: string | null) => {
        await setCategoryForEntry('vault', entryId, categoryKey);
        setVaultCategoryMap((prev) => { const next = { ...prev }; if (categoryKey) next[entryId] = categoryKey; else delete next[entryId]; return next; });
    }, []);

    // ── Notes CRUD ──
    const decryptNote = useCallback(async (noteId: string) => {
        if (!encodedKey) { setPromptKey(true); return; }
        showLoading('Decrypting note...');
        try { const { data } = await api.post<{ content: string } | string>(`/journal/${noteId}`, { key: encodedKey }); const decrypted = typeof data === 'string' ? decodeKey(data) : data.content; setActiveContent((prev) => ({ ...prev, [noteId]: decrypted })); }
        catch (error) { console.error('Decrypt note failed', error); Toast.show({ type: 'error', text1: 'Unable to decrypt note.' }); }
        finally { hideLoading(); }
    }, [encodedKey, hideLoading, showLoading]);

    const toggleExpand = useCallback((note: Note) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (expandedId === note._id) { setExpandedId(null); return; }
        setExpandedId(note._id);
        if (!activeContent[note._id]) void decryptNote(note._id);
    }, [activeContent, decryptNote, expandedId]);

    const handleAddNote = useCallback(async ({ title, content }: { title: string; content: string }) => {
        if (!encodedKey) { setPromptKey(true); Toast.show({ type: 'info', text1: 'Enter your encryption PIN to continue.' }); throw new Error('Encryption key required'); }
        showLoading('Saving secure note...');
        try {
            const { data } = await api.post('/journal/add', { title, content, key: encodedKey });
            Toast.show({ type: 'success', text1: 'Note saved securely.' });
            if (addNotesCategory && data?._id) { await setCategoryForEntry('notes', data._id, addNotesCategory); setNotesCategoryMap((prev) => ({ ...prev, [data._id]: addNotesCategory })); }
            setAddNotesCategory(null); await fetchNotes();
        } catch (error) { console.error('Add note failed', error); Toast.show({ type: 'error', text1: 'Unable to add note.' }); }
        finally { hideLoading(); }
    }, [addNotesCategory, encodedKey, fetchNotes, hideLoading, showLoading]);

    const handlePrepareEditNote = useCallback(async (note: Note) => {
        if (!encodedKey) { setPromptKey(true); return; }
        showLoading('Fetching note...');
        try { const { data } = await api.post<{ content: string } | string>(`/journal/${note._id}`, { key: encodedKey }); const decrypted = typeof data === 'string' ? decodeKey(data) : data.content; setEditNote({ ...note, content: decrypted }); }
        catch (error) { console.error('Prepare edit failed', error); Toast.show({ type: 'error', text1: 'Unable to load note.' }); }
        finally { hideLoading(); }
    }, [encodedKey, hideLoading, showLoading]);

    const handleUpdateNote = useCallback(async ({ title, content }: { title: string; content: string }) => {
        if (!encodedKey || !editNote) { setPromptKey(true); return; }
        showLoading('Updating note...');
        try {
            await api.patch('/journal/update', { id: editNote._id, title, content, key: encodedKey });
            Toast.show({ type: 'success', text1: 'Note updated.' }); setEditNote(null); await fetchNotes();
            setActiveContent((prev) => ({ ...prev, [editNote._id]: content }));
        } catch (error) { console.error('Update note failed', error); Toast.show({ type: 'error', text1: 'Unable to update note.' }); }
        finally { hideLoading(); }
    }, [editNote, encodedKey, fetchNotes, hideLoading, showLoading]);

    const handleDeleteNote = useCallback(async () => {
        if (!deleteNote) return;
        showLoading('Deleting note...');
        try { await api.delete(`/journal/delete/${deleteNote._id}`); Toast.show({ type: 'success', text1: 'Note deleted.' }); setDeleteNote(null); await fetchNotes(); }
        catch (error) { console.error('Delete note failed', error); Toast.show({ type: 'error', text1: 'Unable to delete note.' }); }
        finally { hideLoading(); }
    }, [deleteNote, fetchNotes, hideLoading, showLoading]);

    const handleNotesCategoryChange = useCallback(async (entryId: string, categoryKey: string | null) => {
        await setCategoryForEntry('notes', entryId, categoryKey);
        setNotesCategoryMap((prev) => { const next = { ...prev }; if (categoryKey) next[entryId] = categoryKey; else delete next[entryId]; return next; });
    }, []);

    // ── Render items ──
    const renderPasswordItem = useCallback(({ item }: { item: VaultEntry }) => {
        const revealed = revealedPasswords[item._id];
        const catKey = vaultCategoryMap[item._id];
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
                            <MaterialCommunityIcons name="eye-outline" size={18} color={colors.revealButtonText} />
                            <Text style={styles.revealLabel}>Reveal</Text>
                        </Pressable>
                    )}
                    <Pressable style={styles.iconButton} onPress={() => handlePrepareEditPassword(item)}>
                        <MaterialCommunityIcons name="pencil" size={18} color={colors.accent} />
                    </Pressable>
                    <Pressable style={styles.iconButton} onPress={() => setDeleteEntry(item)}>
                        <MaterialCommunityIcons name="trash-can" size={18} color={colors.danger} />
                    </Pressable>
                </View>
            </View>
        );
    }, [colors, handleCopy, handlePrepareEditPassword, handleReveal, revealedPasswords, styles, vaultCategoryMap]);

    const renderNoteItem = useCallback(({ item }: { item: Note }) => {
        const expanded = expandedId === item._id;
        const content = expanded ? activeContent[item._id] ?? 'Decrypting…' : undefined;
        const catKey = notesCategoryMap[item._id];
        const catDef = catKey ? getCategoryDef('notes', catKey) : undefined;
        return (
            <View style={styles.noteCard}>
                <Pressable style={styles.noteHeader} onPress={() => toggleExpand(item)}>
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.noteTitle}>{item.title}</Text>
                        {catDef ? <CategoryBadge category={catDef} size="small" /> : null}
                        <Text style={styles.noteTimestamp}>Updated {new Date(item.updatedAt).toLocaleString()}</Text>
                    </View>
                    <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color={colors.textSecondary} />
                </Pressable>
                {expanded ? <Text style={styles.noteContent}>{content}</Text> : null}
                {expanded ? (
                    <View style={styles.noteActions}>
                        <Pressable style={styles.noteActionButton} onPress={() => handlePrepareEditNote(item)}>
                            <MaterialCommunityIcons name="pencil" size={18} color={colors.accent} />
                            <Text style={styles.noteActionLabel}>Edit</Text>
                        </Pressable>
                        <Pressable style={styles.noteActionButton} onPress={() => setDeleteNote(item)}>
                            <MaterialCommunityIcons name="trash-can" size={18} color={colors.danger} />
                            <Text style={styles.noteActionLabel}>Delete</Text>
                        </Pressable>
                    </View>
                ) : null}
            </View>
        );
    }, [activeContent, colors, expandedId, handlePrepareEditNote, notesCategoryMap, styles, toggleExpand]);

    // ── Segment indicator position ──
    const segmentWidth = useRef(0);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Clean header */}
            <Text style={styles.headerTitle}>Vault</Text>
            <Text style={styles.headerSubtitle}>Your passwords and notes, encrypted and secure.</Text>

            {/* Pill segment control */}
            <View style={styles.segmentTrack} onLayout={(e) => { segmentWidth.current = e.nativeEvent.layout.width / 2; }}>
                <Animated.View style={[styles.segmentIndicator, { width: '50%', transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, segmentWidth.current || 150] }) }] }]} />
                <Pressable style={styles.segmentButton} onPress={() => switchSegment('passwords')}>
                    <Text style={[styles.segmentLabel, activeSegment === 'passwords' && styles.segmentLabelActive]}>🔑 Passwords</Text>
                </Pressable>
                <Pressable style={styles.segmentButton} onPress={() => switchSegment('notes')}>
                    <Text style={[styles.segmentLabel, activeSegment === 'notes' && styles.segmentLabelActive]}>📝 Notes</Text>
                </Pressable>
            </View>

            {/* Search bar */}
            <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.placeholder} />
                <TextInput
                    placeholder={activeSegment === 'passwords' ? 'Search by title' : 'Search notes by title'}
                    placeholderTextColor={colors.placeholder}
                    style={styles.searchInput}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
                {searchTerm ? (
                    <Pressable style={styles.clearButton} onPress={() => setSearchTerm('')}>
                        <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                ) : null}
            </View>

            {/* Category filter */}
            {activeSegment === 'passwords' ? (
                <CategoryFilterBar categories={VAULT_CATEGORIES} selected={vaultCategoryFilter} onSelect={setVaultCategoryFilter} />
            ) : (
                <CategoryFilterBar categories={NOTES_CATEGORIES} selected={notesCategoryFilter} onSelect={setNotesCategoryFilter} />
            )}

            {/* List */}
            {activeSegment === 'passwords' ? (
                <FlatList
                    data={filteredEntries}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={filteredEntries.length === 0 ? styles.emptyList : { gap: 16, paddingBottom: 120 }}
                    renderItem={renderPasswordItem}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="shield-key-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>No passwords yet</Text>
                            <Text style={styles.emptySubtitle}>Tap the plus button to start securing your credentials.</Text>
                        </View>
                    )}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
            ) : (
                <FlatList
                    data={filteredNotes}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={filteredNotes.length === 0 ? styles.emptyList : { gap: 16, paddingBottom: 120 }}
                    renderItem={renderNoteItem}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="notebook-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>No secure notes yet</Text>
                            <Text style={styles.emptySubtitle}>Capture your thoughts with encrypted journal entries.</Text>
                        </View>
                    )}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
            )}

            {/* FAB */}
            <Pressable style={styles.fab} onPress={() => activeSegment === 'passwords' ? setAddVisible(true) : setNoteAddVisible(true)}>
                <MaterialCommunityIcons name="plus" size={26} color={colors.fabIcon} />
            </Pressable>

            {/* Password modals */}
            <VaultFormModal visible={isAddVisible} mode="create" onClose={() => { setAddVisible(false); setAddVaultCategory(null); }} onSubmit={handleAddPassword} categoryKey={addVaultCategory} onCategoryChange={setAddVaultCategory} categories={VAULT_CATEGORIES} />
            {editEntry ? (<VaultFormModal visible mode="edit" initialValues={{ title: editEntry.title, username: editEntry.username, password: editEntry.password ?? '' }} onClose={() => setEditEntry(null)} onSubmit={handleUpdatePassword} categoryKey={vaultCategoryMap[editEntry._id] ?? null} onCategoryChange={(key) => handleVaultCategoryChange(editEntry._id, key)} categories={VAULT_CATEGORIES} />) : null}
            {deleteEntry ? (<VaultDeleteModal visible title={deleteEntry.title} onClose={() => setDeleteEntry(null)} onConfirm={handleDeletePassword} />) : null}

            {/* Note modals */}
            <NoteFormModal visible={noteAddVisible} mode="create" onClose={() => { setNoteAddVisible(false); setAddNotesCategory(null); }} onSubmit={handleAddNote} categoryKey={addNotesCategory} onCategoryChange={setAddNotesCategory} categories={NOTES_CATEGORIES} />
            {editNote ? (<NoteFormModal visible mode="edit" initialValues={{ title: editNote.title, content: editNote.content ?? '' }} onClose={() => setEditNote(null)} onSubmit={handleUpdateNote} categoryKey={notesCategoryMap[editNote._id] ?? null} onCategoryChange={(key) => handleNotesCategoryChange(editNote._id, key)} categories={NOTES_CATEGORIES} />) : null}
            {deleteNote ? (<NoteDeleteModal visible title={deleteNote.title} onClose={() => setDeleteNote(null)} onConfirm={handleDeleteNote} />) : null}

            {/* Encryption key modal */}
            <EncryptionKeyModal visible={promptKey && isKeyHydrated} onClose={() => setPromptKey(false)} onConfirm={handleKeySubmit} caption={encryptionKeyConfigured ? 'Re-enter your encryption PIN to continue.' : 'Set your encryption PIN to unlock your vault.'} biometricAvailable={bioAvailable && bioEnabled} onBiometric={handleBiometricUnlock} />
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingHorizontal: 20, paddingTop: 4 },
    headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 2 },
    headerSubtitle: { fontSize: 14, color: c.textSecondary, marginBottom: 12 },

    // Segment control
    segmentTrack: { flexDirection: 'row', backgroundColor: c.surfaceSolid, borderRadius: 16, padding: 4, marginBottom: 16, position: 'relative', borderWidth: 1, borderColor: c.border },
    segmentIndicator: { position: 'absolute', top: 4, left: 4, bottom: 4, backgroundColor: c.accent, borderRadius: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    segmentLabel: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
    segmentLabelActive: { color: '#ffffff', fontWeight: '700' },

    // Search
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceSolid, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, fontSize: 16, color: c.text },
    clearButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cancelBg },

    // Password items
    itemCard: { backgroundColor: c.surfaceSolid, borderRadius: 18, padding: 18, flexDirection: 'row', gap: 16, alignItems: 'center', shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: c.border },
    itemTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    itemSubtitle: { fontSize: 14, color: c.tint },
    itemTimestamp: { fontSize: 12, color: c.textSecondary },
    itemActions: { gap: 12, alignItems: 'flex-end' },
    revealButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.revealButtonBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
    revealLabel: { fontSize: 13, fontWeight: '600', color: c.revealButtonText },
    iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.iconButtonBg },
    revealedBadge: { backgroundColor: c.revealBadge, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    revealedLabel: { color: '#0f172a', fontWeight: '600' },

    // Note items
    noteCard: { backgroundColor: c.surfaceSolid, borderRadius: 20, padding: 18, gap: 12, shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: c.border },
    noteHeader: { flexDirection: 'row', alignItems: 'center' },
    noteTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    noteTimestamp: { fontSize: 12, color: c.textSecondary },
    noteContent: { fontSize: 15, color: c.text, lineHeight: 20 },
    noteActions: { flexDirection: 'row', gap: 12 },
    noteActionButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surfaceSolid, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: c.border },
    noteActionLabel: { fontSize: 13, fontWeight: '600', color: c.text },

    // Shared
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyState: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
    fab: { position: 'absolute', right: 24, bottom: 32, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fab, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
});
