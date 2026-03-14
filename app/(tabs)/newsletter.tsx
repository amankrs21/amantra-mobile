import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
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
import Toast from 'react-native-toast-message';

import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import api from '@/services/api';

type Article = {
    _id?: string;
    title: string;
    description?: string;
    url: string;
    imageUrl?: string;
    source?: string;
    category?: string;
    publishedAt?: string;
};

const FILTER_TABS = [
    { key: 'all', label: 'All', icon: '📰' },
    { key: 'ai', label: 'AI', icon: '🤖' },
    { key: 'quantum', label: 'Quantum', icon: '⚛️' },
    { key: 'tech', label: 'Tech', icon: '💻' },
    { key: 'entertainment', label: 'Entertainment', icon: '🎬' },
    { key: 'watchlist', label: 'My Watchlist', icon: '🎯' },
];

function timeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export default function NewsletterScreen() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    const fetchArticles = useCallback(async (category: string, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = category !== 'all' ? `?category=${category}` : '';
            const { data } = await api.get(`/newsletter/feed${params}`);
            setArticles(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Newsletter fetch failed', error);
            if (!silent) Toast.show({ type: 'error', text1: 'Unable to load news.' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { void fetchArticles(activeTab); }, [activeTab, fetchArticles]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        void fetchArticles(activeTab, true);
    }, [activeTab, fetchArticles]);

    const handleOpenArticle = useCallback(async (url: string) => {
        try { await Linking.openURL(url); }
        catch { Toast.show({ type: 'error', text1: 'Unable to open article.' }); }
    }, []);

    const renderArticle = useCallback(({ item }: { item: Article }) => (
        <Pressable style={styles.articleCard} onPress={() => handleOpenArticle(item.url)}>
            {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.articleImage} resizeMode="cover" />
            ) : (
                <View style={styles.articleImagePlaceholder}>
                    <MaterialCommunityIcons name="newspaper-variant-outline" size={32} color={colors.textTertiary} />
                </View>
            )}
            <View style={styles.articleContent}>
                <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.articleMeta}>
                    {item.source ? <Text style={styles.articleSource}>{item.source}</Text> : null}
                    {item.publishedAt ? <Text style={styles.articleTime}>{timeAgo(item.publishedAt)}</Text> : null}
                </View>
                {item.description ? <Text style={styles.articleDescription} numberOfLines={2}>{item.description}</Text> : null}
                {item.category ? (
                    <View style={styles.tagBadge}>
                        <Text style={styles.tagText}>{item.category}</Text>
                    </View>
                ) : null}
            </View>
        </Pressable>
    ), [colors, handleOpenArticle, styles]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.headerTitle}>Newsletter</Text>
            <Text style={styles.headerSubtitle}>Curated tech, AI, and entertainment news.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {FILTER_TABS.map((tab) => (
                    <Pressable key={tab.key} style={[styles.filterChip, activeTab === tab.key && styles.filterChipActive]} onPress={() => setActiveTab(tab.key)}>
                        <Text style={[styles.filterChipText, activeTab === tab.key && styles.filterChipTextActive]}>{tab.icon} {tab.label}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {loading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Fetching latest news...</Text>
                </View>
            ) : (
                <FlatList
                    data={articles}
                    keyExtractor={(item, index) => item._id ?? `${item.url}-${index}`}
                    contentContainerStyle={articles.length === 0 ? styles.emptyList : { gap: 16, paddingBottom: 40 }}
                    renderItem={renderArticle}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="newspaper-variant-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>No news to show</Text>
                            <Text style={styles.emptySubtitle}>Pull to refresh or try a different category.</Text>
                        </View>
                    )}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                />
            )}
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 24 },
    headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 4 },
    headerSubtitle: { fontSize: 14, color: c.textSecondary, marginBottom: 16 },
    filterRow: { gap: 8, paddingBottom: 16 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: c.chipBg },
    filterChipActive: { backgroundColor: c.accent },
    filterChipText: { fontSize: 13, fontWeight: '600', color: c.chipText },
    filterChipTextActive: { color: '#ffffff' },
    articleCard: { backgroundColor: c.surfaceSolid, borderRadius: 20, overflow: 'hidden', shadowColor: c.cardShadow, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: c.border },
    articleImage: { width: '100%', height: 160, backgroundColor: c.chipBg },
    articleImagePlaceholder: { width: '100%', height: 100, backgroundColor: c.chipBg, alignItems: 'center', justifyContent: 'center' },
    articleContent: { padding: 16, gap: 8 },
    articleTitle: { fontSize: 17, fontWeight: '700', color: c.text, lineHeight: 22 },
    articleMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    articleSource: { fontSize: 12, fontWeight: '600', color: c.accent },
    articleTime: { fontSize: 12, color: c.textSecondary },
    articleDescription: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    tagBadge: { backgroundColor: c.chipBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
    tagText: { fontSize: 11, fontWeight: '700', color: c.chipText, textTransform: 'uppercase' },
    loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: c.textSecondary },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyState: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
});
