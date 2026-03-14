import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
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
    year: string;
    status: 'to-watch' | 'watching' | 'watched';
    rating?: number;
    notes?: string;
    subscribeNews?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

const CATEGORIES = [
    { key: 'all', label: 'All', icon: '🎯' },
    { key: 'movie', label: 'Movies', icon: '🎬' },
    { key: 'series', label: 'Series', icon: '📺' },
    { key: 'bollywood', label: 'Bollywood', icon: '🇮🇳' },
    { key: 'anime', label: 'Anime', icon: '🎌' },
    { key: 'documentary', label: 'Documentary', icon: '📹' },
];

const STATUS_OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'to-watch', label: 'To Watch' },
    { key: 'watching', label: 'Watching' },
    { key: 'watched', label: 'Watched' },
];

const STATUS_COLORS: Record<string, string> = {
    'to-watch': '#3b82f6',
    'watching': '#f59e0b',
    'watched': '#10b981',
};

export default function WatchlistScreen() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { showLoading, hideLoading } = useLoading();

    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [addVisible, setAddVisible] = useState(false);
    const [editItem, setEditItem] = useState<WatchlistItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<WatchlistItem | null>(null);

    const filteredItems = useMemo(() => {
        let result = items;
        if (categoryFilter !== 'all') result = result.filter((i) => i.category === categoryFilter);
        if (statusFilter !== 'all') result = result.filter((i) => i.status === statusFilter);
        return result;
    }, [items, categoryFilter, statusFilter]);

    const fetchItems = useCallback(async () => {
        try {
            const { data } = await api.get('/watchlist/fetch');
            setItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Watchlist fetch failed', error);
            Toast.show({ type: 'error', text1: 'Unable to load watchlist.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchItems(); }, [fetchItems]);

    const handleAdd = useCallback(async (item: Omit<WatchlistItem, '_id'>) => {
        showLoading('Adding to watchlist...');
        try {
            await api.post('/watchlist/add', item);
            Toast.show({ type: 'success', text1: 'Added to watchlist!' });
            await fetchItems();
        } catch (error) {
            console.error('Add watchlist failed', error);
            Toast.show({ type: 'error', text1: 'Unable to add item.' });
        } finally { hideLoading(); }
    }, [fetchItems, hideLoading, showLoading]);

    const handleUpdate = useCallback(async (item: Omit<WatchlistItem, '_id'>) => {
        if (!editItem) return;
        showLoading('Updating...');
        try {
            await api.patch(`/watchlist/update/${editItem._id}`, item);
            Toast.show({ type: 'success', text1: 'Watchlist item updated.' });
            setEditItem(null);
            await fetchItems();
        } catch (error) {
            console.error('Update watchlist failed', error);
            Toast.show({ type: 'error', text1: 'Unable to update item.' });
        } finally { hideLoading(); }
    }, [editItem, fetchItems, hideLoading, showLoading]);

    const handleDelete = useCallback(async () => {
        if (!deleteItem) return;
        showLoading('Removing...');
        try {
            await api.delete(`/watchlist/delete/${deleteItem._id}`);
            Toast.show({ type: 'success', text1: `${deleteItem.title} removed.` });
            setDeleteItem(null);
            await fetchItems();
        } catch (error) {
            console.error('Delete watchlist failed', error);
            Toast.show({ type: 'error', text1: 'Unable to delete item.' });
        } finally { hideLoading(); }
    }, [deleteItem, fetchItems, hideLoading, showLoading]);

    const handleToggleNews = useCallback(async (item: WatchlistItem) => {
        try {
            await api.patch(`/watchlist/update/${item._id}`, { subscribeNews: !item.subscribeNews });
            setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, subscribeNews: !i.subscribeNews } : i));
            Toast.show({ type: 'success', text1: item.subscribeNews ? 'Unsubscribed from news' : 'Subscribed to news' });
        } catch (error) {
            console.error('Toggle news failed', error);
        }
    }, []);

    const renderStars = (rating?: number) => {
        if (!rating) return null;
        return (
            <View style={styles.starsRow}>
                {Array.from({ length: 10 }, (_, i) => (
                    <MaterialCommunityIcons key={i} name={i < rating ? 'star' : 'star-outline'} size={14} color={i < rating ? '#f59e0b' : colors.textTertiary} />
                ))}
            </View>
        );
    };

    const renderItem = useCallback(({ item }: { item: WatchlistItem }) => {
        const catDef = CATEGORIES.find((c) => c.key === item.category);
        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <View style={styles.badgeRow}>
                            {catDef ? <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{catDef.icon} {catDef.label}</Text></View> : null}
                            {item.year ? <Text style={styles.yearText}>{item.year}</Text> : null}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status] ?? colors.accent}20` }]}>
                            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] ?? colors.accent }]} />
                            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? colors.accent }]}>
                                {item.status === 'to-watch' ? 'To Watch' : item.status === 'watching' ? 'Watching' : 'Watched'}
                            </Text>
                        </View>
                        {renderStars(item.rating)}
                        {item.notes ? <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text> : null}
                    </View>
                    <View style={styles.cardActions}>
                        <Pressable style={styles.bellButton} onPress={() => handleToggleNews(item)}>
                            <MaterialCommunityIcons name={item.subscribeNews ? 'bell-ring' : 'bell-outline'} size={20} color={item.subscribeNews ? '#f59e0b' : colors.textTertiary} />
                        </Pressable>
                        <Pressable style={styles.iconButton} onPress={() => setEditItem(item)}>
                            <MaterialCommunityIcons name="pencil" size={18} color={colors.accent} />
                        </Pressable>
                        <Pressable style={styles.iconButton} onPress={() => setDeleteItem(item)}>
                            <MaterialCommunityIcons name="trash-can" size={18} color={colors.danger} />
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }, [colors, handleToggleNews, styles]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.headerTitle}>Watchlist</Text>
            <Text style={styles.headerSubtitle}>Track movies, series, and shows you love.</Text>

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {CATEGORIES.map((cat) => (
                    <Pressable key={cat.key} style={[styles.filterChip, categoryFilter === cat.key && styles.filterChipActive]} onPress={() => setCategoryFilter(cat.key)}>
                        <Text style={[styles.filterChipText, categoryFilter === cat.key && styles.filterChipTextActive]}>{cat.icon} {cat.label}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Status filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {STATUS_OPTIONS.map((s) => (
                    <Pressable key={s.key} style={[styles.statusChip, statusFilter === s.key && styles.statusChipActive]} onPress={() => setStatusFilter(s.key)}>
                        <Text style={[styles.statusChipText, statusFilter === s.key && styles.statusChipTextActive]}>{s.label}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {loading ? (
                <View style={styles.loadingState}><ActivityIndicator size="large" color={colors.accent} /></View>
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={filteredItems.length === 0 ? styles.emptyList : { gap: 16, paddingBottom: 120 }}
                    renderItem={renderItem}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="movie-open-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>No items in your watchlist yet</Text>
                            <Text style={styles.emptySubtitle}>Tap the plus button to start tracking your favorites.</Text>
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
    container: { flex: 1, backgroundColor: c.background, padding: 24 },
    headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 4 },
    headerSubtitle: { fontSize: 14, color: c.textSecondary, marginBottom: 16 },
    filterRow: { gap: 8, paddingBottom: 12 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: c.chipBg },
    filterChipActive: { backgroundColor: c.accent },
    filterChipText: { fontSize: 13, fontWeight: '600', color: c.chipText },
    filterChipTextActive: { color: '#ffffff' },
    statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: c.chipBg },
    statusChipActive: { backgroundColor: c.accent },
    statusChipText: { fontSize: 13, fontWeight: '600', color: c.chipText },
    statusChipTextActive: { color: '#ffffff' },
    card: { backgroundColor: c.surfaceSolid, borderRadius: 20, padding: 18, shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: c.border },
    cardTop: { flexDirection: 'row', gap: 12 },
    cardTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    categoryBadge: { backgroundColor: c.chipBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    categoryBadgeText: { fontSize: 12, fontWeight: '600', color: c.chipText },
    yearText: { fontSize: 13, color: c.textSecondary },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: '700' },
    starsRow: { flexDirection: 'row', gap: 1 },
    notesText: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    cardActions: { gap: 10, alignItems: 'center' },
    bellButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.iconButtonBg },
    iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.iconButtonBg },
    loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyState: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
    fab: { position: 'absolute', right: 24, bottom: 32, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fab, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
});
