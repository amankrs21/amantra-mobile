import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import EmptyState from '@/components/ui/EmptyState';
import { useSwipeFilter } from '@/hooks/use-swipe-filter';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import api from '@/services/api';

type Article = {
    title: string;
    description?: string;
    url: string;
    imageUrl?: string;
    source?: string;
    tag?: string;
    publishedAt?: string;
    relevance?: string;
    watchlistTitle?: string;
};

const TABS = [
    { key: 'all', label: 'All', icon: 'newspaper-variant' },
    { key: 'ai', label: 'AI', icon: 'robot' },
    { key: 'quantum', label: 'Quantum', icon: 'atom' },
    { key: 'tech', label: 'Tech', icon: 'laptop' },
    { key: 'watchlist', label: 'My Watchlist', icon: 'bell-ring' },
];

export default function NewsletterScreen() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [allArticles, setAllArticles] = useState<Article[]>([]);
    const [watchlistArticles, setWatchlistArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [hasFetched, setHasFetched] = useState(false);
    const [hasWatchlistFetched, setHasWatchlistFetched] = useState(false);

    const tabKeys = useMemo(() => TABS.map((t) => t.key), []);
    const { panHandlers: swipePanHandlers, animatedStyle: swipeAnimatedStyle } = useSwipeFilter(tabKeys, activeTab, setActiveTab);

    // Filtered articles — local filtering, no API call
    const displayedArticles = useMemo(() => {
        if (activeTab === 'watchlist') return watchlistArticles;
        if (activeTab === 'all') return allArticles;
        return allArticles.filter((a) => a.tag === activeTab);
    }, [allArticles, watchlistArticles, activeTab]);

    // Fetch all articles once
    const fetchAll = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
            toast.info('📰 Loading news...', { description: 'Fetching latest articles — this may take 15-30s on first load.' });
        }
        try {
            const { data } = await api.get('/newsletter/feed');
            const list = data?.articles ?? [];
            setAllArticles(list);
            setHasFetched(true);
            if (!silent && list.length > 0) toast.success(`${list.length} articles loaded!`);
        } catch (error) {
            console.error('Newsletter fetch failed', error);
            if (!silent) toast.error('Unable to load news.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Fetch watchlist articles (separate, personalized)
    const fetchWatchlist = useCallback(async () => {
        try {
            const { data } = await api.get('/newsletter/feed?category=watchlist');
            setWatchlistArticles(data?.articles ?? []);
            if (data?.message) toast.info(data.message);
            setHasWatchlistFetched(true);
        } catch (error) {
            console.error('Watchlist news fetch failed', error);
        }
    }, []);

    useEffect(() => {
        if (!hasFetched) { void fetchAll(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Lazy-load watchlist tab
    useEffect(() => {
        if (activeTab === 'watchlist' && !hasWatchlistFetched) void fetchWatchlist();
    }, [activeTab, hasWatchlistFetched, fetchWatchlist]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        if (activeTab === 'watchlist') {
            setHasWatchlistFetched(false);
            void fetchWatchlist().finally(() => setRefreshing(false));
        } else {
            setHasFetched(false);
            void fetchAll(true);
        }
    }, [activeTab, fetchAll, fetchWatchlist]);

    const handleOpen = useCallback(async (url: string) => {
        try { await Linking.openURL(url); }
        catch { toast.error('Unable to open link.'); }
    }, []);

    const renderArticle = useCallback(({ item }: { item: Article }) => (
        <Pressable style={styles.card} onPress={() => handleOpen(item.url)}>
            <View style={styles.cardContent}>
                {item.watchlistTitle ? (
                    <View style={styles.watchlistBadge}>
                        <MaterialCommunityIcons name="movie-open" size={11} color={colors.accent} />
                        <Text style={styles.watchlistBadgeText}>{item.watchlistTitle}</Text>
                    </View>
                ) : null}
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                {item.description ? <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text> : null}
                <View style={styles.cardMeta}>
                    {item.source ? <Text style={styles.sourceText}>{item.source}</Text> : null}
                    {item.tag && item.tag !== 'watchlist' ? (
                        <View style={styles.tagBadge}>
                            <Text style={styles.tagText}>{item.tag}</Text>
                        </View>
                    ) : null}
                    {item.relevance === 'high' ? (
                        <View style={styles.hotBadge}>
                            <MaterialCommunityIcons name="fire" size={12} color="#ef4444" />
                            <Text style={styles.hotText}>Hot</Text>
                        </View>
                    ) : null}
                </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
        </Pressable>
    ), [colors, handleOpen, styles]);

    const showLoading = loading && !hasFetched;
    const showWatchlistLoading = activeTab === 'watchlist' && !hasWatchlistFetched;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.headerTitle}>Newsletter</Text>
            <Text style={styles.headerSubtitle}>AI-curated news from the last 48 hours.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.tabRow}>
                {TABS.map((tab) => (
                    <Pressable key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
                        <MaterialCommunityIcons name={tab.icon as any} size={14} color={activeTab === tab.key ? '#fff' : colors.textSecondary} />
                        <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {showLoading || showWatchlistLoading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Fetching & curating news...</Text>
                </View>
            ) : (
                <Animated.View style={[{ flex: 1 }, swipeAnimatedStyle]} {...swipePanHandlers}>
                <FlatList
                    data={displayedArticles}
                    keyExtractor={(item, index) => `${item.url}-${index}`}
                    contentContainerStyle={displayedArticles.length === 0 ? styles.emptyList : { gap: 10, paddingBottom: 40 }}
                    renderItem={renderArticle}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
                    ListEmptyComponent={() => (
                        <EmptyState icon="newspaper-variant-outline" title="No news to show" subtitle="Pull to refresh or check back later." />
                    )}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                />
                </Animated.View>
            )}
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingHorizontal: 20, paddingTop: 4 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: c.text },
    headerSubtitle: { fontSize: 13, color: c.textSecondary, marginBottom: 8 },
    tabRow: { gap: 6, paddingBottom: 8, height: 36 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: c.surfaceSolid, borderWidth: 1, borderColor: c.border, height: 28 },
    tabActive: { backgroundColor: c.accent, borderColor: c.accent },
    tabText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    tabTextActive: { color: '#ffffff' },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceSolid, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: c.border },
    cardContent: { flex: 1, gap: 4 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: c.text, lineHeight: 20 },
    cardDesc: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    sourceText: { fontSize: 11, fontWeight: '600', color: c.accent },
    tagBadge: { backgroundColor: c.border, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    tagText: { fontSize: 10, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase' },
    hotBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    hotText: { fontSize: 10, fontWeight: '700', color: '#ef4444' },
    watchlistBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${c.accent}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 4 },
    watchlistBadgeText: { fontSize: 11, fontWeight: '700', color: c.accent },
    loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: c.textSecondary },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
});
