import { useCallback, useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { z } from 'zod';

const WEATHER_API_URL = process.env.EXPO_PUBLIC_WEATHER_API_URL ?? 'https://api.openweathermap.org/data/2.5/weather';
const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY;

const WeatherSchema = z.object({
    name: z.string(),
    sys: z.object({
        country: z.string().optional(),
    }),
    weather: z
        .array(
            z.object({
                description: z.string(),
                icon: z.string(),
            }),
        )
        .nonempty(),
    main: z.object({
        temp: z.number(),
        feels_like: z.number(),
        temp_min: z.number(),
        temp_max: z.number(),
        humidity: z.number(),
        pressure: z.number(),
    }),
    wind: z.object({
        speed: z.number(),
    }),
});

type WeatherPayload = z.infer<typeof WeatherSchema>;

type WeatherCountry = {
    name?: { common?: string };
    flags?: { png?: string };
    flag?: string;
};

const TOOL_CARDS = [
    {
        key: 'passwords',
        title: 'Password Vault',
        description: 'Generate, store, and decrypt credentials on demand.',
        icon: 'key-variant',
        accent: ['#2563eb', '#1d4ed8'],
        route: '/(tabs)/passwords',
    },
    {
        key: 'notes',
        title: 'Secure Notes',
        description: 'Encrypt personal notes, journals, and ideas.',
        icon: 'notebook-outline',
        accent: ['#0ea5e9', '#22d3ee'],
        route: '/(tabs)/notes',
    },
];

const WEATHER_TTL_MS = 1000 * 60 * 30; // cache for 30 minutes

export default function HomeScreen() {
    const router = useRouter();
    const [now, setNow] = useState(() => new Date());
    const [city, setCity] = useState('New York');
    const [weather, setWeather] = useState<WeatherPayload | null>(null);
    const [country, setCountry] = useState<WeatherCountry | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!lastFetchedAt || Date.now() - lastFetchedAt > WEATHER_TTL_MS) {
            void handleSearch('New York', true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const timeLabel = useMemo(() => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), [now]);
    const dateLabel = useMemo(() => now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }), [now]);

    const fetchCountry = useCallback(async (countryCode?: string) => {
        if (!countryCode) {
            setCountry(null);
            return;
        }

        try {
            const response = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`);
            if (!response.ok) {
                return;
            }
            const [countryPayload] = (await response.json()) as WeatherCountry[];
            setCountry(countryPayload ?? null);
        } catch (error) {
            console.error('Failed to fetch country details', error);
        }
    }, []);

    const handleSearch = useCallback(
        async (inputCity?: string, silent?: boolean) => {
            if (!WEATHER_API_KEY) {
                if (!silent) {
                    Toast.show({ type: 'info', text1: 'Weather unavailable', text2: 'Set EXPO_PUBLIC_WEATHER_API_KEY to enable weather lookup.' });
                }
                return;
            }

            const query = (inputCity ?? city).trim();
            if (!query) {
                Toast.show({ type: 'info', text1: 'Enter a city to search weather.' });
                return;
            }

            setIsFetching(true);
            try {
                const response = await fetch(`${WEATHER_API_URL}?q=${encodeURIComponent(query)}&appid=${WEATHER_API_KEY}`);
                if (!response.ok) {
                    throw new Error('City not found');
                }
                const payload = await response.json();
                const parsed = WeatherSchema.safeParse(payload);
                if (!parsed.success) {
                    throw new Error('Unexpected response from weather service');
                }

                setWeather(parsed.data);
                setLastFetchedAt(Date.now());
                void fetchCountry(parsed.data.sys.country);
                if (!silent) {
                    Toast.show({ type: 'success', text1: `Weather updated for ${parsed.data.name}` });
                }
            } catch (error) {
                console.error('Weather lookup failed', error);
                setWeather(null);
                setCountry(null);
                Toast.show({
                    type: 'error',
                    text1: 'Unable to fetch weather',
                    text2: error instanceof Error ? error.message : 'Check your connection and try again.',
                });
            } finally {
                setIsFetching(false);
                Keyboard.dismiss();
            }
        },
        [city, fetchCountry],
    );

    const kelvinToCelsius = (value: number) => (value - 273.15).toFixed(1);
    const speedToKmh = (value: number) => (value * 3.6).toFixed(1);

    const weatherDescription = weather?.weather?.[0]?.description ?? '';
    const weatherMetrics = weather
        ? [
            {
                label: 'Feels Like',
                icon: 'thermometer',
                value: `${kelvinToCelsius(weather.main.feels_like)}°C`,
            },
            {
                label: 'Min Temp',
                icon: 'chevron-down',
                value: `${kelvinToCelsius(weather.main.temp_min)}°C`,
            },
            {
                label: 'Max Temp',
                icon: 'chevron-up',
                value: `${kelvinToCelsius(weather.main.temp_max)}°C`,
            },
            {
                label: 'Humidity',
                icon: 'water-percent',
                value: `${weather.main.humidity}%`,
            },
            {
                label: 'Wind',
                icon: 'weather-windy',
                value: `${speedToKmh(weather.wind.speed)} km/h`,
            },
            {
                label: 'Pressure',
                icon: 'gauge',
                value: `${weather.main.pressure} hPa`,
            },
        ]
        : [];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.date}>{dateLabel}</Text>
                    <Text style={styles.time}>{timeLabel}</Text>
                </View>
                <MaterialCommunityIcons name="clock-outline" size={44} color="#38bdf8" />
            </View>

            <View style={styles.weatherCard}>
                <LinearGradient colors={["#0f172a", "#1d4ed8"]} style={styles.weatherGradient}>
                    <View style={styles.weatherHeader}>
                        <Text style={styles.weatherTitle}>Today&apos;s Weather</Text>
                        <MaterialCommunityIcons name="weather-partly-cloudy" size={32} color="#facc15" />
                    </View>
                    <Text style={styles.weatherSubtitle}>
                        Stay ahead with live climate updates powered by OpenWeather.
                    </Text>

                    <View style={styles.searchRow}>
                        <MaterialCommunityIcons name="map-marker" size={22} color="#a5b4fc" />
                        <TextInput
                            placeholder="Search city"
                            placeholderTextColor="rgba(226, 232, 240, 0.6)"
                            style={styles.searchInput}
                            value={city}
                            onChangeText={setCity}
                            returnKeyType="search"
                            onSubmitEditing={() => handleSearch()}
                            autoCapitalize="words"
                        />
                        <Pressable
                            style={[styles.searchButton, isFetching && styles.searchButtonDisabled]}
                            onPress={() => handleSearch()}
                            disabled={isFetching}
                        >
                            <MaterialCommunityIcons name="magnify" size={20} color="#0f172a" />
                        </Pressable>
                    </View>

                    {weather ? (
                        <View style={styles.weatherBody}>
                            <View style={styles.weatherSummary}>
                                <View>
                                    <Text style={styles.weatherLocation}>
                                        {weather.name}
                                        {country?.name?.common ? `, ${country.name.common}` : ''}
                                    </Text>
                                    <Text style={styles.weatherDescription}>{capitalizeWords(weatherDescription)}</Text>
                                </View>
                                <Text style={styles.weatherTemp}>{kelvinToCelsius(weather.main.temp)}°C</Text>
                            </View>

                            <View style={styles.metricGrid}>
                                {weatherMetrics.map((metric) => (
                                    <View key={metric.label} style={styles.metricCard}>
                                        <MaterialCommunityIcons name={metric.icon as any} size={22} color="#38bdf8" />
                                        <Text style={styles.metricLabel}>{metric.label}</Text>
                                        <Text style={styles.metricValue}>{metric.value}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noWeatherState}>
                            <MaterialCommunityIcons name="cloud-alert" size={48} color="#fca5a5" />
                            <Text style={styles.noWeatherText}>Search for a city to view the latest forecast.</Text>
                        </View>
                    )}
                </LinearGradient>
            </View>

            <View style={styles.toolHeadingRow}>
                <Text style={styles.toolHeading}>Your Secure Tools</Text>
                <Text style={styles.toolCaption}>Password vault and encrypted notes, all in one place.</Text>
            </View>

            <View style={styles.toolGrid}>
                {TOOL_CARDS.map((tool) => (
                    <Pressable
                        key={tool.key}
                        style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
                        onPress={() => router.push(tool.route as never)}
                    >
                        <LinearGradient colors={tool.accent} style={styles.toolIconBadge}>
                            <MaterialCommunityIcons name={tool.icon as any} size={28} color="#ffffff" />
                        </LinearGradient>
                        <View style={styles.toolContent}>
                            <Text style={styles.toolTitle}>{tool.title}</Text>
                            <Text style={styles.toolDescription}>{tool.description}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(15, 23, 42, 0.25)" />
                    </Pressable>
                ))}
            </View>
        </ScrollView>
    );
}

function capitalizeWords(value: string) {
    return value
        .split(' ')
        .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
        .join(' ');
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    content: {
        padding: 24,
        gap: 24,
        paddingBottom: 48,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    date: {
        fontSize: 18,
        color: 'rgba(226, 232, 240, 0.8)',
        fontWeight: '500',
    },
    time: {
        fontSize: 36,
        fontWeight: '700',
        color: '#f8fafc',
    },
    weatherCard: {
        borderRadius: 32,
        overflow: 'hidden',
    },
    weatherGradient: {
        padding: 24,
        gap: 18,
    },
    weatherHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    weatherTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#e0f2fe',
    },
    weatherSubtitle: {
        fontSize: 14,
        color: 'rgba(191, 219, 254, 0.8)',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 18,
        paddingHorizontal: 16,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        color: '#f8fafc',
        paddingVertical: Platform.select({ ios: 14, default: 10 }),
    },
    searchButton: {
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 12,
    },
    searchButtonDisabled: {
        opacity: 0.6,
    },
    weatherBody: {
        gap: 20,
    },
    weatherSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    weatherLocation: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
    },
    weatherDescription: {
        fontSize: 15,
        color: 'rgba(224, 242, 254, 0.85)',
        marginTop: 4,
    },
    weatherTemp: {
        fontSize: 48,
        fontWeight: '800',
        color: '#f8fafc',
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metricCard: {
        width: '30%',
        minWidth: 110,
        padding: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
        gap: 6,
    },
    metricLabel: {
        fontSize: 13,
        color: 'rgba(226, 232, 240, 0.75)',
    },
    metricValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#f8fafc',
    },
    noWeatherState: {
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
    },
    noWeatherText: {
        color: '#fee2e2',
        textAlign: 'center',
    },
    toolHeadingRow: {
        gap: 8,
    },
    toolHeading: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
    },
    toolCaption: {
        fontSize: 14,
        color: 'rgba(226, 232, 240, 0.65)',
    },
    toolGrid: {
        gap: 16,
    },
    toolCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        padding: 18,
        gap: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    toolCardPressed: {
        transform: [{ scale: 0.98 }],
        opacity: 0.9,
    },
    toolIconBadge: {
        padding: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toolContent: {
        flex: 1,
        gap: 4,
    },
    toolTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
    },
    toolDescription: {
        fontSize: 14,
        color: 'rgba(15, 23, 42, 0.7)',
    },
});
