import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import WatchlistFormModal from '@/components/watchlist/WatchlistFormModal';
import WatchlistDeleteModal from '@/components/watchlist/WatchlistDeleteModal';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import { useLoading } from '@/hooks/use-loading';
import api from '@/services/api';

type WatchlistItem = {
    _id: string;
    title: string;
    category: string;
    year?: string;
    status: string;
    rating?: number;
    notes?: string;
    subscribeNews?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

const CATEGORIES = [
    { key: 'all', label: 'All' },
    { key: 'movie', label: '🎬 Movies' },
    { key: 'series', label: '📺 Series' },
    { key: 'other', label: '📁 Other' },
];

export default function WatchlistScreen() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { showLoading, hideLoading } = useLoading();

    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [hideWatched, setHideWatched] = useState(false);
    const [addVisible, setAddVisible] = useState(false);
    const [editItem, setEditItem] = useState<WatchlistItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<WatchlistItem | null>(null);

    const filteredItems = useMemo(() => {
        let result = items;
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            result = result.filter((i) => i.title.toLowerCase().includes(q));
        }
        if (categoryFilter !== 'all') result = result.filter((i) => i.category === categoryFilter);
        if (hideWatched) result = result.filter((i) => i.status !== 'watched');
        return result;
    }, [items, searchTerm, categoryFilter, hideWatched]);

    const fetchItems = useCallback(async () => {
        try {
            const { data } = await api.get('/watchlist/fetch');
            setItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Watchlist fetch failed', error);
            Toast.show({ type: 'error', text1: 'Unable to load watchlist.' });
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void fetchItems(); }, [fetchItems]);

    const handleAdd = useCallback(async (item: Omit<WatchlistItem, '_id'>) => {
        showLoading('Adding...');
        try {
            await api.post('/watchlist/add', item);
            Toast.show({ type: 'success', text1: 'Added!' });
            await fetchItems();
        } catch { Toast.show({ type: 'error', text1: 'Unable to add.' }); }
        finally { hideLoading(); }
    }, [fetchItems, hideLoading, showLoading]);

    const handleUpdate = useCallback(async (item: Omit<WatchlistItem, '_id'>) => {
        if (!editItem) return;
        showLoading('Updating...');
        try {
            await api.put(`/watchlist/update/${editItem._id}`, item);
            Toast.show({ type: 'success', text1: 'Updated!' });
            setEditItem(null);
            await fetchItems();
        } catch { Toast.show({ type: 'error', text1: 'Unable to update.' }); }
        finally { hideLoading(); }
    }, [editItem, fetchItems, hideLoading, showLoading]);

    const handleDelete = useCallback(async () => {
        if (!deleteItem) return;
        showLoading('Removing...');
        try {
            await api.delete(`/watchlist/delete/${deleteItem._id}`);
            Toast.show({ type: 'success', text1: `${deleteItem.title} removed.` });
            setDeleteItem(null);
            await fetchItems();
        } catch { Toast.show({ type: 'error', text1: 'Unable to delete.' }); }
        finally { hideLoading(); }
    }, [deleteItem, fetchItems, hideLoading, showLoading]);

    const handleToggleWatched = useCallback(async (item: WatchlistItem) => {
        const newStatus = item.status === 'watched' ? 'to_watch' : 'watched';
        try {
            await api.put(`/watchlist/update/${item._id}`, { status: newStatus });
            setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, status: newStatus } : i));
        } catch { Toast.show({ type: 'error', text1: 'Unable to update.' }); }
    }, []);

    const handleToggleNews = useCallback(async (item: WatchlistItem) => {
        try {
            await api.put(`/watchlist/update/${item._id}`, { subscribeNews: !item.subscribeNews });
            setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, subscribeNews: !i.subscribeNews } : i));
            Toast.show({ type: 'success', text1: item.subscribeNews ? 'Unsubscribed' : 'Subscribed to news' });
        } catch { Toast.show({ type: 'error', text1: 'Failed.' }); }
    }, []);

    const renderItem = useCallback(({ item }: { item: WatchlistItem }) => {
        const isWatched = item.status === 'watched';
        const catDef = CATEGORIES.find((c) => c.key === item.category);
        return (
            <View style={[styles.card, isWatched && styles.cardWatched]}>
                <View style={styles.cardRow}>
                    <Pressable style={styles.checkbox} onPress={() => handleToggleWatched(item)}>
                        <MaterialCommunityIcons
                            name={isWatched ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                            size={24}
                            color={isWatched ? '#10b981' : colors.textTertiary}
                        />
                    </Pressable>
                    <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.cardTitle, isWatched && styles.cardTitleWatched]}>{item.title}</Text>
                        <View style={styles.metaRow}>
                            {catDef && catDef.key !== 'all' ? <Text style={styles.metaText}>{catDef.label}</Text> : null}
                            {item.year ? <Text style={styles.metaText}>{item.year}</Text> : null}
                            {item.rating ? (
                                <View style={styles.ratingBadge}>
                                    <MaterialCommunityIcons name="star" size={11} color="#f59e0b" />
                                    <Text style={styles.ratingText}>{item.rating}/10</Text>
                                </View>
                            ) : null}
                        </View>
                        {item.notes ? <Text style={styles.notesText} numberOfLines={1}>{item.notes}</Text> : null}
                    </View>
                    <View style={styles.cardActions}>
                        <Pressable onPress={() => handleToggleNews(item)}>
                            <MaterialCommunityIcons name={item.subscribeNews ? 'bell-ring' : 'bell-outline'} size={18} color={item.subscribeNews ? '#f59e0b' : colors.textTertiary} />
                        </Pressable>
                        <Pressable onPress={() => setEditItem(item)}>
                            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.accent} />
                        </Pressable>
                        <Pressable onPress={() => setDeleteItem(item)}>
                            <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }, [colors, handleToggleWatched, handleToggleNews, styles]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.headerTitle}>Watchlist</Text>
            <Text style={styles.headerSubtitle}>Track movies & series you want to watch.</Text>

            {/* Search bar */}
            <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.placeholder} />
                <TextInput
                    placeholder="Search by title"
                    placeholderTextColor={colors.placeholder}
                    style={styles.searchInput}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
                {searchTerm ? (
                    <Pressable onPress={() => setSearchTerm('')}>
                        <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
                    </Pressable>
                ) : null}
            </View>

            {/* Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {CATEGORIES.map((cat) => (
                    <Pressable key={cat.key} style={[styles.chip, categoryFilter === cat.key && styles.chipActive]} onPress={() => setCategoryFilter(cat.key)}>
                        <Text style={[styles.chipText, categoryFilter === cat.key && styles.chipTextActive]}>{cat.label}</Text>
                    </Pressable>
                ))}
                <View style={styles.watchedToggle}>
                    <Text style={styles.watchedLabel}>Hide watched</Text>
                    <Switch
                        value={hideWatched}
                        onValueChange={setHideWatched}
                        trackColor={{ true: '#10b981', false: colors.border }}
                        thumbColor="#fff"
                        style={{ transform: [{ scale: 0.75 }] }}
                    />
                </View>
            </ScrollView>

            {loading ? (
                <View style={styles.loadingState}><ActivityIndicator size="large" color={colors.accent} /></View>
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={filteredItems.length === 0 ? styles.emptyList : { gap: 10, paddingBottom: 120 }}
                    renderItem={renderItem}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="movie-open-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>No items yet</Text>
                            <Text style={styles.emptySubtitle}>Tap + to start tracking movies & series.</Text>
                        </View>
                    )}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
            )}

            <Pressable style={styles.fab} onPress={() => setAddVisible(true)}>
                <MaterialCommunityIcons name="plus" size={26} color={colors.fabIcon} />
            </Pressable>

            <WatchlistFormModal visible={addVisible} onClose={() => setAddVisible(false)} onSubmit={handleAdd} />
            {editItem ? <WatchlistFormModal visible mode="edit" initialValues={editItem} onClose={() => setEditItem(null)} onSubmit={handleUpdate} /> : null}
            {deleteItem ? <WatchlistDeleteModal visible title={deleteItem.title} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} /> : null}
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingHorizontal: 20, paddingTop: 4 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: c.text },
    headerSubtitle: { fontSize: 13, color: c.textSecondary, marginBottom: 8 },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceSolid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginBottom: 8, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, fontSize: 14, color: c.text, padding: 0 },
    filterRow: { gap: 6, paddingBottom: 8, alignItems: 'center', height: 34 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: c.surfaceSolid, borderWidth: 1, borderColor: c.border, height: 26, justifyContent: 'center' },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    chipTextActive: { color: '#ffffff' },
    watchedToggle: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 2 },
    watchedLabel: { fontSize: 11, color: c.textSecondary, fontWeight: '600' },
    card: { backgroundColor: c.surfaceSolid, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: c.border },
    cardWatched: { opacity: 0.55 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkbox: { width: 28, alignItems: 'center' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    cardTitleWatched: { textDecorationLine: 'line-through', color: c.textSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    metaText: { fontSize: 11, color: c.textSecondary },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    ratingText: { fontSize: 11, color: '#f59e0b', fontWeight: '600' },
    notesText: { fontSize: 12, color: c.textTertiary },
    cardActions: { gap: 8, alignItems: 'center' },
    loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyState: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
    fab: { position: 'absolute', right: 24, bottom: 32, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fab, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
});
