import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import WatchlistFormModal from '@/components/watchlist/WatchlistFormModal';
import WatchlistDeleteModal from '@/components/watchlist/WatchlistDeleteModal';
import CategoryFilterBar from '@/components/ui/CategoryFilterBar';
import EmptyState from '@/components/ui/EmptyState';
import SearchBar from '@/components/ui/SearchBar';
import { useSwipeFilter } from '@/hooks/use-swipe-filter';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import { useLoading } from '@/hooks/use-loading';
import api from '@/services/api';

type PartItem = { name: string; watched: boolean };

type WatchlistItem = {
    _id: string;
    title: string;
    category: string;
    year?: string;
    status: string;
    rating?: number;
    notes?: string;
    subscribeNews?: boolean;
    parts?: PartItem[] | null;
    createdAt?: string;
    updatedAt?: string;
};

const WATCHLIST_CATEGORIES = [
    { key: 'movie', label: 'Movies', icon: 'movie-open', color: '#2563eb' },
    { key: 'series', label: 'Series', icon: 'television-classic', color: '#8b5cf6' },
    { key: 'other', label: 'Other', icon: 'folder-outline', color: '#64748b' },
] as const;

export default function WatchlistScreen() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { showLoading, hideLoading } = useLoading();

    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [hideWatched, setHideWatched] = useState(false);
    const [addVisible, setAddVisible] = useState(false);
    const [editItem, setEditItem] = useState<WatchlistItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<WatchlistItem | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const swipeKeys = useMemo(() => [null, ...WATCHLIST_CATEGORIES.map((c) => c.key)] as (string | null)[], []);
    const { panHandlers: swipePanHandlers, animatedStyle: swipeAnimatedStyle } = useSwipeFilter(swipeKeys, categoryFilter, setCategoryFilter);

    const filteredItems = useMemo(() => {
        let result = items;
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            result = result.filter((i) => i.title.toLowerCase().includes(q));
        }
        if (categoryFilter) result = result.filter((i) => i.category === categoryFilter);
        if (hideWatched) result = result.filter((i) => i.status !== 'watched');
        return result;
    }, [items, searchTerm, categoryFilter, hideWatched]);

    const watchedCount = useMemo(() => items.filter((i) => i.status === 'watched').length, [items]);

    const fetchItems = useCallback(async () => {
        try {
            const { data } = await api.get('/watchlist/fetch');
            setItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Watchlist fetch failed', error);
            toast.error('Unable to load watchlist.');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void fetchItems(); }, [fetchItems]);

    const handleAdd = useCallback(async (item: Omit<WatchlistItem, '_id'>) => {
        showLoading('Adding...');
        try {
            await api.post('/watchlist/add', item);
            toast.success('Added!');
            await fetchItems();
        } catch { toast.error('Unable to add.'); }
        finally { hideLoading(); }
    }, [fetchItems, hideLoading, showLoading]);

    const handleUpdate = useCallback(async (item: Omit<WatchlistItem, '_id'>) => {
        if (!editItem) return;
        showLoading('Updating...');
        try {
            await api.put(`/watchlist/update/${editItem._id}`, item);
            toast.success('Updated!');
            setEditItem(null);
            await fetchItems();
        } catch { toast.error('Unable to update.'); }
        finally { hideLoading(); }
    }, [editItem, fetchItems, hideLoading, showLoading]);

    const handleDelete = useCallback(async () => {
        if (!deleteItem) return;
        showLoading('Removing...');
        try {
            await api.delete(`/watchlist/delete/${deleteItem._id}`);
            toast.success(`${deleteItem.title} removed.`);
            setDeleteItem(null);
            await fetchItems();
        } catch { toast.error('Unable to delete.'); }
        finally { hideLoading(); }
    }, [deleteItem, fetchItems, hideLoading, showLoading]);

    const handleToggleWatched = useCallback(async (item: WatchlistItem) => {
        const newStatus = item.status === 'watched' ? 'to_watch' : 'watched';
        try {
            await api.put(`/watchlist/update/${item._id}`, { status: newStatus });
            setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, status: newStatus } : i));
        } catch { toast.error('Unable to update.'); }
    }, []);

    const handleToggleNews = useCallback(async (item: WatchlistItem) => {
        try {
            await api.put(`/watchlist/update/${item._id}`, { subscribeNews: !item.subscribeNews });
            setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, subscribeNews: !i.subscribeNews } : i));
            toast.success(item.subscribeNews ? 'Unsubscribed' : 'Subscribed to news');
        } catch { toast.error('Failed.'); }
    }, []);

    const handleTogglePart = useCallback(async (item: WatchlistItem, partIndex: number) => {
        if (!item.parts) return;
        const updatedParts = item.parts.map((p, i) => i === partIndex ? { ...p, watched: !p.watched } : p);
        try {
            await api.put(`/watchlist/update/${item._id}`, { parts: updatedParts });
            // Backend auto-computes status from parts
            const watchedCount = updatedParts.filter((p) => p.watched).length;
            const newStatus = watchedCount === 0 ? 'to_watch' : watchedCount === updatedParts.length ? 'watched' : 'watching';
            setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, parts: updatedParts, status: newStatus } : i));
        } catch { toast.error('Unable to update.'); }
    }, []);

    const renderItem = useCallback(({ item }: { item: WatchlistItem }) => {
        const isWatched = item.status === 'watched';
        const isWatching = item.status === 'watching';
        const catDef = WATCHLIST_CATEGORIES.find((c) => c.key === item.category);
        const hasParts = item.parts && item.parts.length > 0;
        const isExpanded = expandedId === item._id;
        const partsWatched = hasParts ? item.parts!.filter((p) => p.watched).length : 0;

        return (
            <View style={[styles.card, isWatched && styles.cardWatched]}>
                <View style={styles.cardRow}>
                    <Pressable style={styles.checkbox} onPress={() => hasParts ? setExpandedId(isExpanded ? null : item._id) : handleToggleWatched(item)}>
                        <MaterialCommunityIcons
                            name={isWatched ? 'checkbox-marked-circle' : isWatching ? 'progress-check' : hasParts ? (isExpanded ? 'chevron-down' : 'chevron-right') : 'checkbox-blank-circle-outline'}
                            size={24}
                            color={isWatched ? '#10b981' : isWatching ? '#f59e0b' : colors.textTertiary}
                        />
                    </Pressable>
                    <Pressable style={{ flex: 1, gap: 2 }} onPress={() => setEditItem(item)} onLongPress={hasParts ? () => setExpandedId(isExpanded ? null : item._id) : undefined}>
                        <Text style={[styles.cardTitle, isWatched && styles.cardTitleWatched]}>{item.title}</Text>
                        {item.notes ? <Text style={styles.notesText} numberOfLines={1}>{item.notes.length > 40 ? item.notes.slice(0, 40) + '…' : item.notes}</Text> : null}
                        <View style={styles.metaRow}>
                            {catDef ? (
                                <View style={[styles.catBadge, { backgroundColor: `${catDef.color}18` }]}>
                                    <MaterialCommunityIcons name={catDef.icon as any} size={10} color={catDef.color} />
                                    <Text style={[styles.catBadgeText, { color: catDef.color }]}>{catDef.label}</Text>
                                </View>
                            ) : null}
                            {item.year ? <Text style={styles.metaText}>{item.year}</Text> : null}
                            {item.rating ? (
                                <View style={styles.ratingBadge}>
                                    <MaterialCommunityIcons name="star" size={11} color="#f59e0b" />
                                    <Text style={styles.ratingText}>{item.rating}/10</Text>
                                </View>
                            ) : null}
                            {hasParts ? (
                                <View style={styles.progressBadge}>
                                    <Text style={styles.progressText}>{partsWatched}/{item.parts!.length} parts</Text>
                                </View>
                            ) : null}
                        </View>
                    </Pressable>
                    <View style={styles.cardActions}>
                        {item.subscribeNews ? (
                            <MaterialCommunityIcons name="bell-ring" size={14} color="#f59e0b" />
                        ) : null}
                        <Pressable style={styles.deleteButton} onPress={() => setDeleteItem(item)}>
                            <MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.danger} />
                        </Pressable>
                    </View>
                </View>
                {/* Expandable parts list */}
                {hasParts && isExpanded ? (
                    <View style={styles.partsContainer}>
                        {item.parts!.map((part, idx) => (
                            <Pressable key={idx} style={styles.partRow} onPress={() => handleTogglePart(item, idx)}>
                                <MaterialCommunityIcons
                                    name={part.watched ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                                    size={20}
                                    color={part.watched ? '#10b981' : colors.textTertiary}
                                />
                                <Text style={[styles.partName, part.watched && styles.partNameDone]}>{part.name}</Text>
                            </Pressable>
                        ))}
                    </View>
                ) : null}
            </View>
        );
    }, [colors, expandedId, handleToggleWatched, handleToggleNews, handleTogglePart, styles]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.headerTitle}>Watchlist</Text>
            <Text style={styles.headerSubtitle}>Track movies & series you want to watch.</Text>

            {/* Search bar — matches Vault */}
            <SearchBar value={searchTerm} onChangeText={setSearchTerm} />

            {/* Category filter — same component as Vault */}
            <CategoryFilterBar categories={WATCHLIST_CATEGORIES as any} selected={categoryFilter} onSelect={setCategoryFilter} />

            {/* Hide watched row */}
            <Pressable style={styles.hideWatchedRow} onPress={() => setHideWatched((v) => !v)}>
                <MaterialCommunityIcons
                    name={hideWatched ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={20}
                    color={hideWatched ? '#10b981' : colors.textTertiary}
                />
                <Text style={styles.hideWatchedLabel}>Hide watched</Text>
                {watchedCount > 0 ? <Text style={styles.hideWatchedCount}>({watchedCount})</Text> : null}
            </Pressable>

            {loading ? (
                <View style={styles.loadingState}><ActivityIndicator size="large" color={colors.accent} /></View>
            ) : (
                <Animated.View style={[{ flex: 1 }, swipeAnimatedStyle]} {...swipePanHandlers}>
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={filteredItems.length === 0 ? styles.emptyList : { gap: 8, paddingBottom: 120 }}
                    renderItem={renderItem}
                    ListEmptyComponent={() => (
                        <EmptyState icon="movie-open-outline" title="No items yet" subtitle="Tap + to start tracking movies & series." />
                    )}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
                </Animated.View>
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
    headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 2 },
    headerSubtitle: { fontSize: 14, color: c.textSecondary, marginBottom: 12 },
    hideWatchedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    hideWatchedLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    hideWatchedCount: { fontSize: 12, color: c.textTertiary },
    card: { backgroundColor: c.surfaceSolid, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: c.border },
    cardWatched: { opacity: 0.55 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkbox: { width: 28, alignItems: 'center' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    cardTitleWatched: { textDecorationLine: 'line-through', color: c.textSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
    catBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    catBadgeText: { fontSize: 10, fontWeight: '700' },
    metaText: { fontSize: 12, color: c.textSecondary },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    ratingText: { fontSize: 11, color: '#f59e0b', fontWeight: '600' },
    notesText: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
    progressBadge: { backgroundColor: 'rgba(245, 158, 11, 0.12)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    progressText: { fontSize: 10, fontWeight: '700', color: '#f59e0b' },
    partsContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 4, paddingLeft: 40 },
    partRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    partName: { fontSize: 14, color: c.text },
    partNameDone: { textDecorationLine: 'line-through', color: c.textTertiary },
    cardActions: { alignItems: 'center', gap: 8 },
    deleteButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.iconButtonBg },
    loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    fab: { position: 'absolute', right: 24, bottom: 32, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fab, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
});
