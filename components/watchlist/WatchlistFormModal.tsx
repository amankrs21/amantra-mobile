import { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';

type WatchlistValues = {
    title: string;
    category: string;
    year?: string;
    status: string;
    rating?: number;
    notes?: string;
    subscribeNews?: boolean;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    onSubmit: (values: WatchlistValues) => Promise<void> | void;
    mode?: 'create' | 'edit';
    initialValues?: Partial<WatchlistValues>;
};

const CATEGORY_OPTIONS = [
    { key: 'movie', label: '🎬 Movie' },
    { key: 'series', label: '📺 Series' },
    { key: 'other', label: '📁 Other' },
];

export default function WatchlistFormModal({ visible, onClose, onSubmit, mode = 'create', initialValues }: Props) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [title, setTitle] = useState(initialValues?.title ?? '');
    const [category, setCategory] = useState(initialValues?.category ?? 'movie');
    const [year, setYear] = useState(initialValues?.year ?? '');
    const [rating, setRating] = useState(initialValues?.rating ?? 0);
    const [notes, setNotes] = useState(initialValues?.notes ?? '');
    const [subscribeNews, setSubscribeNews] = useState(initialValues?.subscribeNews ?? false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setSubmitting(true);
        try {
            await onSubmit({
                title: title.trim(),
                category,
                year: year.trim() || undefined,
                status: initialValues?.status ?? 'to_watch',
                rating: rating || undefined,
                notes: notes.trim() || undefined,
                subscribeNews,
            });
            if (mode === 'create') { setTitle(''); setCategory('movie'); setYear(''); setRating(0); setNotes(''); setSubscribeNews(false); }
            onClose();
        } finally { setSubmitting(false); }
    };

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.sheet}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.handleBar} />
                        <Text style={styles.sheetTitle}>{mode === 'edit' ? 'Edit Item' : 'Add to Watchlist'}</Text>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Title *</Text>
                            <TextInput value={title} onChangeText={setTitle} placeholder="Movie or series name" placeholderTextColor={colors.placeholder} style={styles.input} />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Category</Text>
                            <View style={styles.chipRow}>
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <Pressable key={opt.key} style={[styles.chip, category === opt.key && styles.chipActive]} onPress={() => setCategory(opt.key)}>
                                        <Text style={[styles.chipText, category === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Year</Text>
                            <TextInput value={year} onChangeText={setYear} placeholder="2026" placeholderTextColor={colors.placeholder} style={styles.input} keyboardType="number-pad" maxLength={4} />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Rating ({rating}/10)</Text>
                            <View style={styles.starsRow}>
                                {Array.from({ length: 10 }, (_, i) => (
                                    <Pressable key={i} onPress={() => setRating(i + 1 === rating ? 0 : i + 1)}>
                                        <MaterialCommunityIcons name={i < rating ? 'star' : 'star-outline'} size={26} color={i < rating ? '#f59e0b' : colors.textTertiary} />
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Notes</Text>
                            <TextInput value={notes} onChangeText={setNotes} placeholder="Optional notes..." placeholderTextColor={colors.placeholder} style={[styles.input, styles.textArea]} multiline numberOfLines={3} />
                        </View>

                        <View style={styles.switchRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.switchLabel}>🔔 Subscribe to news</Text>
                                <Text style={styles.switchSubtitle}>Get release & update news in Newsletter</Text>
                            </View>
                            <Switch value={subscribeNews} onValueChange={setSubscribeNews} trackColor={{ true: colors.accent, false: colors.border }} thumbColor="#fff" />
                        </View>

                        <View style={styles.buttonRow}>
                            <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}><Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text></Pressable>
                            <Pressable style={[styles.button, styles.submitButton, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting || !title.trim()}>
                                <Text style={styles.buttonLabel}>{submitting ? 'Saving...' : mode === 'edit' ? 'Update' : 'Add'}</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.surfaceSolid, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85%', borderWidth: 1, borderColor: c.border },
    handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.textTertiary, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 20 },
    fieldGroup: { gap: 6, marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    input: { borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: c.text, backgroundColor: c.inputBg },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: c.surfaceSolid, borderWidth: 1, borderColor: c.border },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    chipTextActive: { color: '#ffffff' },
    starsRow: { flexDirection: 'row', gap: 2 },
    switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
    switchLabel: { fontSize: 16, fontWeight: '600', color: c.text },
    switchSubtitle: { fontSize: 13, color: c.textSecondary },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    button: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: c.border },
    submitButton: { backgroundColor: c.accent },
    buttonLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
    cancelLabel: { color: c.text },
});
