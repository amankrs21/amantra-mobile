import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { useAuth } from '@/hooks/use-auth';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';

const WEATHER_API_URL = process.env.EXPO_PUBLIC_WEATHER_API_URL ?? 'https://api.openweathermap.org/data/2.5/weather';
const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY;

const WeatherSchema = z.object({
    name: z.string(),
    sys: z.object({ country: z.string().optional() }),
    weather: z.array(z.object({ description: z.string(), icon: z.string() })).nonempty(),
    main: z.object({ temp: z.number(), feels_like: z.number(), temp_min: z.number(), temp_max: z.number(), humidity: z.number(), pressure: z.number() }),
    wind: z.object({ speed: z.number() }),
});
type WeatherPayload = z.infer<typeof WeatherSchema>;

const TOOL_CARDS = [
    { key: 'vault', title: 'Vault', description: 'Passwords & encrypted notes.', icon: 'shield-lock', color: '#2563eb', route: '/(tabs)/vault' },
    { key: 'watchlist', title: 'Watchlist', description: 'Track movies & series.', icon: 'movie-open', color: '#8b5cf6', route: '/(tabs)/watchlist' },
    { key: 'newsletter', title: 'Newsletter', description: 'Curated AI & tech news.', icon: 'newspaper-variant', color: '#0ea5e9', route: '/(tabs)/newsletter' },
];

const WEATHER_TTL_MS = 1000 * 60 * 30;
const k2c = (v: number) => Math.round(v - 273.15);
const capitalize = (s: string) => s.split(' ').map((w) => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { user } = useAuth();

    const [now, setNow] = useState(() => new Date());
    const [city, setCity] = useState('');
    const [weather, setWeather] = useState<WeatherPayload | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

    useEffect(() => { const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t); }, []);

    // Set city and fetch weather once user is available
    useEffect(() => {
        const userCity = user?.weatherCity || 'New York';
        setCity(userCity);
        if (!lastFetchedAt || Date.now() - lastFetchedAt > WEATHER_TTL_MS) {
            void handleSearch(userCity, true);
        }
    }, [user?.weatherCity]); // eslint-disable-line react-hooks/exhaustive-deps

    const timeLabel = useMemo(() => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), [now]);
    const dateLabel = useMemo(() => now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }), [now]);

    const handleSearch = useCallback(async (inputCity?: string, silent?: boolean) => {
        if (!WEATHER_API_KEY) { if (!silent) toast.info('Weather unavailable.'); return; }
        const query = (inputCity ?? city).trim();
        if (!query) return;
        setIsFetching(true);
        try {
            const r = await fetch(`${WEATHER_API_URL}?q=${encodeURIComponent(query)}&appid=${WEATHER_API_KEY}`);
            if (!r.ok) throw new Error('City not found');
            const parsed = WeatherSchema.parse(await r.json());
            setWeather(parsed); setLastFetchedAt(Date.now());
        } catch (e) {
            setWeather(null);
            toast.error('Unable to fetch weather', { description: e instanceof Error ? e.message : 'Try again.' });
        } finally { setIsFetching(false); Keyboard.dismiss(); }
    }, [city]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
            {/* Greeting & time */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.greeting}>{getGreeting()}</Text>
                    <Text style={styles.date}>{dateLabel}</Text>
                </View>
                <Text style={styles.time}>{timeLabel}</Text>
            </View>

            {/* Weather */}
            <View style={styles.weatherCard}>
                {/* Search */}
                <View style={styles.searchRow}>
                    <MaterialCommunityIcons name="magnify" size={18} color={colors.placeholder} />
                    <TextInput
                        placeholder="Search city weather"
                        placeholderTextColor={colors.placeholder}
                        style={styles.searchInput}
                        value={city}
                        onChangeText={setCity}
                        returnKeyType="search"
                        onSubmitEditing={() => handleSearch()}
                        autoCapitalize="words"
                    />
                    <Pressable style={[styles.searchButton, isFetching && { opacity: 0.5 }]} onPress={() => handleSearch()} disabled={isFetching}>
                        <Text style={styles.searchButtonText}>{isFetching ? '...' : 'Go'}</Text>
                    </Pressable>
                </View>

                {weather ? (
                    <>
                        {/* Main temp display */}
                        <View style={styles.tempSection}>
                            <View style={styles.tempLeft}>
                                <Text style={styles.tempValue}>{k2c(weather.main.temp)}°</Text>
                                <Text style={styles.tempUnit}>C</Text>
                            </View>
                            <View style={styles.tempRight}>
                                <Text style={styles.locationText}>{weather.name}</Text>
                                <Text style={styles.descriptionText}>{capitalize(weather.weather[0].description)}</Text>
                                <Text style={styles.feelsLike}>Feels like {k2c(weather.main.feels_like)}°C</Text>
                            </View>
                        </View>

                        {/* Metric chips — 2 rows of 3 */}
                        <View style={styles.metricGrid}>
                            <View style={styles.metricItem}>
                                <MaterialCommunityIcons name="thermometer-low" size={16} color={colors.tint} />
                                <Text style={styles.metricValue}>{k2c(weather.main.temp_min)}°</Text>
                                <Text style={styles.metricLabel}>Min</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <MaterialCommunityIcons name="thermometer-high" size={16} color={colors.danger} />
                                <Text style={styles.metricValue}>{k2c(weather.main.temp_max)}°</Text>
                                <Text style={styles.metricLabel}>Max</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <MaterialCommunityIcons name="water-percent" size={16} color="#0ea5e9" />
                                <Text style={styles.metricValue}>{weather.main.humidity}%</Text>
                                <Text style={styles.metricLabel}>Humidity</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <MaterialCommunityIcons name="weather-windy" size={16} color="#64748b" />
                                <Text style={styles.metricValue}>{(weather.wind.speed * 3.6).toFixed(0)}</Text>
                                <Text style={styles.metricLabel}>km/h</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <MaterialCommunityIcons name="gauge" size={16} color="#8b5cf6" />
                                <Text style={styles.metricValue}>{weather.main.pressure}</Text>
                                <Text style={styles.metricLabel}>hPa</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <MaterialCommunityIcons name="arrow-up-down" size={16} color="#f59e0b" />
                                <Text style={styles.metricValue}>{k2c(weather.main.temp_max) - k2c(weather.main.temp_min)}°</Text>
                                <Text style={styles.metricLabel}>Range</Text>
                            </View>
                        </View>
                    </>
                ) : (
                    <View style={styles.noWeather}>
                        <MaterialCommunityIcons name="weather-partly-cloudy" size={36} color={colors.textTertiary} />
                        <Text style={styles.noWeatherText}>Search a city to see live weather.</Text>
                    </View>
                )}
            </View>

            {/* Quick Access */}
            <Text style={styles.sectionTitle}>Quick Access</Text>
            <View style={styles.toolGrid}>
                {TOOL_CARDS.map((tool) => (
                    <Pressable key={tool.key} style={({ pressed }) => [styles.toolCard, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]} onPress={() => router.push(tool.route as never)}>
                        <View style={[styles.toolIcon, { backgroundColor: `${tool.color}15` }]}>
                            <MaterialCommunityIcons name={tool.icon as any} size={24} color={tool.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toolTitle}>{tool.title}</Text>
                            <Text style={styles.toolDesc}>{tool.description}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.chevron} />
                    </Pressable>
                ))}
            </View>
        </ScrollView>
    );
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 6) return '🌙 Good Night';
    if (h < 12) return '☀️ Good Morning';
    if (h < 17) return '🌤️ Good Afternoon';
    if (h < 21) return '🌆 Good Evening';
    return '🌙 Good Night';
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, gap: 20, paddingBottom: 48 },

    // Header
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greeting: { fontSize: 22, fontWeight: '700', color: c.text },
    date: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
    time: { fontSize: 36, fontWeight: '800', color: c.text },

    // Weather card
    weatherCard: { backgroundColor: c.surfaceSolid, borderRadius: 24, padding: 18, gap: 16, borderWidth: 1, borderColor: c.border },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: c.inputBorder },
    searchInput: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 10 },
    searchButton: { backgroundColor: c.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
    searchButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    // Temperature
    tempSection: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    tempLeft: { flexDirection: 'row', alignItems: 'flex-start' },
    tempValue: { fontSize: 56, fontWeight: '800', color: c.text, lineHeight: 60 },
    tempUnit: { fontSize: 20, fontWeight: '600', color: c.textSecondary, marginTop: 8 },
    tempRight: { flex: 1, gap: 2 },
    locationText: { fontSize: 18, fontWeight: '700', color: c.text },
    descriptionText: { fontSize: 14, color: c.textSecondary },
    feelsLike: { fontSize: 12, color: c.textTertiary, marginTop: 2 },

    // Metrics — 3x2 grid
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    metricItem: { width: '31%', flexGrow: 1, flexBasis: '30%', alignItems: 'center', gap: 3, paddingVertical: 10, backgroundColor: c.chipBg, borderRadius: 14 },
    metricValue: { fontSize: 16, fontWeight: '700', color: c.text },
    metricLabel: { fontSize: 11, color: c.textTertiary },

    // No weather
    noWeather: { alignItems: 'center', gap: 8, paddingVertical: 20 },
    noWeatherText: { fontSize: 14, color: c.textTertiary },

    // Section
    sectionTitle: { fontSize: 20, fontWeight: '700', color: c.text },

    // Tools
    toolGrid: { gap: 12 },
    toolCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceSolid, borderRadius: 18, padding: 16, gap: 14, borderWidth: 1, borderColor: c.border },
    toolIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    toolTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    toolDesc: { fontSize: 13, color: c.textSecondary, marginTop: 1 },
});
