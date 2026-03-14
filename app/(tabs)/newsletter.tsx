import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
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
import Toast from 'react-native-toast-message';

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

    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    const fetchArticles = useCallback(async (category: string, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = category !== 'all' ? `?category=${category}` : '';
            const { data } = await api.get(`/newsletter/feed${params}`);
            const list = data?.articles ?? (Array.isArray(data) ? data : []);
            setArticles(list);
            if (data?.message) {
                Toast.show({ type: 'info', text1: data.message });
            }
        } catch (error) {
            console.error('Newsletter fetch failed', error);
            if (!silent) Toast.show({ type: 'error', text1: 'Unable to load news.' });
            setArticles([]);
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

    const handleOpen = useCallback(async (url: string) => {
        try { await Linking.openURL(url); }
        catch { Toast.show({ type: 'error', text1: 'Unable to open link.' }); }
    }, []);

    const renderArticle = useCallback(({ item }: { item: Article }) => (
        <Pressable style={styles.card} onPress={() => handleOpen(item.url)}>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                {item.description ? <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text> : null}
                <View style={styles.cardMeta}>
                    {item.source ? <Text style={styles.sourceText}>{item.source}</Text> : null}
                    {item.tag ? (
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.headerTitle}>Newsletter</Text>
            <Text style={styles.headerSubtitle}>AI-curated news from the last 24 hours.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
                {TABS.map((tab) => (
                    <Pressable key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
                        <MaterialCommunityIcons name={tab.icon as any} size={16} color={activeTab === tab.key ? '#fff' : colors.textSecondary} />
                        <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {loading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Fetching & curating news...</Text>
                </View>
            ) : (
                <FlatList
                    data={articles}
                    keyExtractor={(item, index) => `${item.url}-${index}`}
                    contentContainerStyle={articles.length === 0 ? styles.emptyList : { gap: 12, paddingBottom: 40 }}
                    renderItem={renderArticle}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="newspaper-variant-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>No news to show</Text>
                            <Text style={styles.emptySubtitle}>Pull to refresh or check back later.</Text>
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
    container: { flex: 1, backgroundColor: c.background, padding: 20 },
    headerTitle: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 2 },
    headerSubtitle: { fontSize: 14, color: c.textSecondary, marginBottom: 14 },
    tabRow: { gap: 8, paddingBottom: 14 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surfaceSolid, borderWidth: 1, borderColor: c.border },
    tabActive: { backgroundColor: c.accent, borderColor: c.accent },
    tabText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    tabTextActive: { color: '#ffffff' },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceSolid, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: c.border },
    cardContent: { flex: 1, gap: 6 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.text, lineHeight: 21 },
    cardDesc: { fontSize: 14, color: c.textSecondary, lineHeight: 19 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    sourceText: { fontSize: 12, fontWeight: '600', color: c.accent },
    tagBadge: { backgroundColor: c.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    tagText: { fontSize: 11, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase' },
    hotBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    hotText: { fontSize: 11, fontWeight: '700', color: '#ef4444' },
    loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: c.textSecondary },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyState: { alignItems: 'center', gap: 8, paddingTop: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
});
