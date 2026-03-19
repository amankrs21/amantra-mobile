import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { toast } from 'sonner-native';
import { z } from 'zod';

import EncryptionKeyModal from '@/components/modals/EncryptionKeyModal';
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
    getCategoryDef,
    NOTES_CATEGORIES,
} from '@/utils/categories';
import { decodeKey, encodeKey } from '@/utils/crypto';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NoteSchema = z.object({ _id: z.string(), title: z.string(), updatedAt: z.string(), createdAt: z.string().optional(), category: z.string().nullable().optional() });
type Note = z.infer<typeof NoteSchema> & { content?: string };
const NoteListSchema = z.array(NoteSchema);

export default function NotesScreen() {
    const { encryptionKeyConfigured, setEncryptionKeyConfigured } = useAuth();
    const { encodedKey, setKey, isHydrated: isKeyHydrated } = useEncryptionKey();
    const { showLoading, hideLoading } = useLoading();
    const { isAvailable: bioAvailable, isEnabled: bioEnabled, authenticateAndGetKey, enableBiometric } = useBiometric();
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [notes, setNotes] = useState<Note[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [addVisible, setAddVisible] = useState(false);
    const [editNote, setEditNote] = useState<Note | null>(null);
    const [deleteNote, setDeleteNote] = useState<Note | null>(null);
    const [promptKey, setPromptKey] = useState(false);
    const [activeContent, setActiveContent] = useState<Record<string, string>>({});
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [addCategory, setAddCategory] = useState<string | null>(null);

    const filteredNotes = useMemo(() => {
        let result = notes;
        if (searchTerm.trim()) { const n = searchTerm.trim().toLowerCase(); result = result.filter((note) => note.title.toLowerCase().includes(n)); }
        if (categoryFilter) result = result.filter((note) => note.category === categoryFilter);
        return result;
    }, [notes, searchTerm, categoryFilter]);

    const fetchNotes = useCallback(async () => {
        showLoading('Loading encrypted notes...');
        try { const { data } = await api.get('/journal/fetch'); const parsed = NoteListSchema.safeParse(data); if (!parsed.success) throw new Error('Unable to load notes'); setNotes(parsed.data); }
        catch (error) { console.error('Fetch notes failed', error); toast.error('Unable to load notes.'); }
        finally { hideLoading(); }
    }, [hideLoading, showLoading]);

    useEffect(() => { void fetchNotes(); }, [fetchNotes]);

    const handleBiometricUnlock = useCallback(async () => {
        const key = await authenticateAndGetKey();
        if (key) { await setKey(key); await setEncryptionKeyConfigured(true); toast.success('Unlocked with biometrics.'); setPromptKey(false); }
    }, [authenticateAndGetKey, setEncryptionKeyConfigured, setKey]);

    const handleKeySubmit = useCallback(async (value: string) => {
        const candidate = value.trim(); if (!candidate) return;
        try {
            showLoading('Validating key...');
            const endpoint = encryptionKeyConfigured ? '/pin/verify' : '/pin/setText';
            await api.post(endpoint, { key: encodeKey(candidate) });
            await setKey(candidate); await setEncryptionKeyConfigured(true);
            toast.success('Encryption key saved.'); setPromptKey(false);
            if (bioAvailable && !bioEnabled) { const enrolled = await enableBiometric(candidate); if (enrolled) toast.success('Biometric unlock enabled!'); }
        } catch (error) { console.error('Key validation failed', error); toast.error('Invalid encryption key.'); }
        finally { hideLoading(); }
    }, [bioAvailable, bioEnabled, enableBiometric, hideLoading, setEncryptionKeyConfigured, setKey, showLoading]);

    const decryptNote = useCallback(async (noteId: string) => {
        if (!encodedKey) { setPromptKey(true); return; }
        showLoading('Decrypting note...');
        try { const { data } = await api.post<{ content: string } | string>(`/journal/${noteId}`, { key: encodedKey }); const decrypted = typeof data === 'string' ? decodeKey(data) : data.content; setActiveContent((prev) => ({ ...prev, [noteId]: decrypted })); }
        catch (error) { console.error('Decrypt note failed', error); toast.error('Unable to decrypt note.'); }
        finally { hideLoading(); }
    }, [encodedKey, hideLoading, showLoading]);

    const toggleExpand = useCallback((note: Note) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (expandedId === note._id) { setExpandedId(null); return; }
        setExpandedId(note._id);
        if (!activeContent[note._id]) void decryptNote(note._id);
    }, [activeContent, decryptNote, expandedId]);

    const handleAdd = useCallback(async ({ title, content }: { title: string; content: string }) => {
        if (!encodedKey) { setPromptKey(true); toast.info('Enter your encryption PIN to continue.'); throw new Error('Encryption key required'); }
        showLoading('Saving secure note...');
        try {
            await api.post('/journal/add', { title, content, key: encodedKey, category: addCategory });
            toast.success('Note saved securely.');
            setAddCategory(null); await fetchNotes();
        } catch (error) { console.error('Add note failed', error); toast.error('Unable to add note.'); }
        finally { hideLoading(); }
    }, [addCategory, encodedKey, fetchNotes, hideLoading, showLoading]);

    const handlePrepareEdit = useCallback(async (note: Note) => {
        if (!encodedKey) { setPromptKey(true); return; }
        showLoading('Fetching note...');
        try { const { data } = await api.post<{ content: string } | string>(`/journal/${note._id}`, { key: encodedKey }); const decrypted = typeof data === 'string' ? decodeKey(data) : data.content; setEditNote({ ...note, content: decrypted }); }
        catch (error) { console.error('Prepare edit failed', error); toast.error('Unable to load note.'); }
        finally { hideLoading(); }
    }, [encodedKey, hideLoading, showLoading]);

    const handleUpdate = useCallback(async ({ title, content, category }: { title: string; content: string; category?: string | null }) => {
        if (!encodedKey || !editNote) { setPromptKey(true); return; }
        showLoading('Updating note...');
        try {
            await api.patch('/journal/update', { id: editNote._id, title, content, key: encodedKey, category: category ?? editNote.category ?? null });
            toast.success('Note updated.'); setEditNote(null); await fetchNotes();
            setActiveContent((prev) => ({ ...prev, [editNote._id]: content }));
        } catch (error) { console.error('Update note failed', error); toast.error('Unable to update note.'); }
        finally { hideLoading(); }
    }, [editNote, encodedKey, fetchNotes, hideLoading, showLoading]);

    const handleDelete = useCallback(async () => {
        if (!deleteNote) return;
        showLoading('Deleting note...');
        try { await api.delete(`/journal/delete/${deleteNote._id}`); toast.success('Note deleted.'); setDeleteNote(null); await fetchNotes(); }
        catch (error) { console.error('Delete note failed', error); toast.error('Unable to delete note.'); }
        finally { hideLoading(); }
    }, [deleteNote, fetchNotes, hideLoading, showLoading]);

    const handleCategoryChange = useCallback(async (entryId: string, categoryKey: string | null) => {
        try {
            await api.patch('/journal/update', { id: entryId, category: categoryKey });
            setNotes((prev) => prev.map((n) => n._id === entryId ? { ...n, category: categoryKey } : n));
        } catch (error) {
            console.error('Category update failed', error);
            toast.error('Unable to update category.');
        }
    }, []);

    const renderItem = ({ item }: { item: Note }) => {
        const expanded = expandedId === item._id;
        const content = expanded ? activeContent[item._id] ?? 'Decrypting…' : undefined;
        const catDef = item.category ? getCategoryDef('notes', item.category) : undefined;
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
                        <Pressable style={styles.noteActionButton} onPress={() => handlePrepareEdit(item)}>
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
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Secure Notes</Text>
                    <Text style={styles.headerSubtitle}>Private journal entries with client-side encryption.</Text>
                </View>
                <MaterialCommunityIcons name="notebook" size={36} color="#facc15" />
            </View>

            <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.placeholder} />
                <TextInput placeholder="Search notes by title" placeholderTextColor={colors.placeholder} style={styles.searchInput} value={searchTerm} onChangeText={setSearchTerm} />
                <Pressable style={styles.clearButton} onPress={() => setSearchTerm('')}>
                    <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
            </View>

            <CategoryFilterBar categories={NOTES_CATEGORIES} selected={categoryFilter} onSelect={setCategoryFilter} />

            <FlatList
                data={filteredNotes}
                keyExtractor={(item) => item._id}
                contentContainerStyle={filteredNotes.length === 0 ? styles.emptyList : { gap: 16, paddingBottom: 120 }}
                renderItem={renderItem}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="notebook-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No secure notes yet</Text>
                        <Text style={styles.emptySubtitle}>Capture your thoughts with encrypted journal entries.</Text>
                    </View>
                )}
            />

            <Pressable style={styles.fab} onPress={() => setAddVisible(true)}>
                <MaterialCommunityIcons name="plus" size={26} color={colors.fabIcon} />
            </Pressable>

            <NoteFormModal visible={addVisible} mode="create" onClose={() => { setAddVisible(false); setAddCategory(null); }} onSubmit={handleAdd} categoryKey={addCategory} onCategoryChange={setAddCategory} categories={NOTES_CATEGORIES} />
            {editNote ? (<NoteFormModal visible mode="edit" initialValues={{ title: editNote.title, content: editNote.content ?? '' }} onClose={() => setEditNote(null)} onSubmit={handleUpdate} categoryKey={editNote.category ?? null} onCategoryChange={(key) => handleCategoryChange(editNote._id, key)} categories={NOTES_CATEGORIES} />) : null}
            {deleteNote ? (<NoteDeleteModal visible title={deleteNote.title} onClose={() => setDeleteNote(null)} onConfirm={handleDelete} />) : null}
            <EncryptionKeyModal visible={promptKey && isKeyHydrated} onClose={() => setPromptKey(false)} onConfirm={handleKeySubmit} caption={encryptionKeyConfigured ? 'Re-enter your encryption PIN to reveal notes.' : 'Set your encryption PIN to unlock notes.'} biometricAvailable={bioAvailable && bioEnabled} onBiometric={handleBiometricUnlock} />
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
    noteCard: { backgroundColor: c.surfaceSolid, borderRadius: 20, padding: 18, gap: 12, shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: c.border },
    noteHeader: { flexDirection: 'row', alignItems: 'center' },
    noteTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    noteTimestamp: { fontSize: 12, color: c.textSecondary },
    noteContent: { fontSize: 15, color: c.text, lineHeight: 20 },
    noteActions: { flexDirection: 'row', gap: 12 },
    noteActionButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surfaceSolid, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: c.border },
    noteActionLabel: { fontSize: 13, fontWeight: '600', color: c.text },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyState: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
    fab: { position: 'absolute', right: 24, bottom: 32, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fab, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
});
