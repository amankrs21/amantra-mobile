import { useEffect, useMemo, useState } from 'react';
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

type PartItem = { name: string; watched: boolean };

type WatchlistValues = {
    title: string;
    category: string;
    year?: string;
    status: string;
    rating?: number;
    notes?: string;
    subscribeNews?: boolean;
    parts?: PartItem[] | null;
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

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('movie');
    const [year, setYear] = useState('');
    const [rating, setRating] = useState(0);
    const [notes, setNotes] = useState('');
    const [subscribeNews, setSubscribeNews] = useState(false);
    const [parts, setParts] = useState<PartItem[]>([]);
    const [newPartName, setNewPartName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (visible) {
            setTitle(initialValues?.title ?? '');
            setCategory(initialValues?.category ?? 'movie');
            setYear(initialValues?.year ?? '');
            setRating(initialValues?.rating ?? 0);
            setNotes(initialValues?.notes ?? '');
            setSubscribeNews(initialValues?.subscribeNews ?? false);
            setParts(initialValues?.parts ?? []);
            setNewPartName('');
        }
    }, [visible, initialValues]);

    const handleAddPart = () => {
        const name = newPartName.trim();
        if (!name) return;
        setParts((prev) => [...prev, { name, watched: false }]);
        setNewPartName('');
    };

    const handleTogglePart = (index: number) => {
        setParts((prev) => prev.map((p, i) => i === index ? { ...p, watched: !p.watched } : p));
    };

    const handleRemovePart = (index: number) => {
        setParts((prev) => prev.filter((_, i) => i !== index));
    };

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
                parts: parts.length > 0 ? parts : null,
            });
            if (mode === 'create') {
                setTitle(''); setCategory('movie'); setYear(''); setRating(0);
                setNotes(''); setSubscribeNews(false); setParts([]); setNewPartName('');
            }
            onClose();
        } finally { setSubmitting(false); }
    };

    const watchedCount = parts.filter((p) => p.watched).length;

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.sheet}>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

                        {/* Parts / Sub-items */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>
                                Parts {parts.length > 0 ? `(${watchedCount}/${parts.length} watched)` : '(optional)'}
                            </Text>
                            <Text style={styles.helperText}>For franchises with multiple entries (e.g. Harry Potter 1-8, Avengers series)</Text>

                            {parts.map((part, index) => (
                                <View key={index} style={styles.partRow}>
                                    <Pressable onPress={() => handleTogglePart(index)}>
                                        <MaterialCommunityIcons
                                            name={part.watched ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                                            size={22}
                                            color={part.watched ? '#10b981' : colors.textTertiary}
                                        />
                                    </Pressable>
                                    <Text style={[styles.partName, part.watched && styles.partNameWatched]}>{part.name}</Text>
                                    <Pressable onPress={() => handleRemovePart(index)} style={styles.partRemove}>
                                        <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.danger} />
                                    </Pressable>
                                </View>
                            ))}

                            <View style={styles.addPartRow}>
                                <TextInput
                                    value={newPartName}
                                    onChangeText={setNewPartName}
                                    placeholder="e.g. Part 1: The Philosopher's Stone"
                                    placeholderTextColor={colors.placeholder}
                                    style={[styles.input, styles.addPartInput]}
                                    onSubmitEditing={handleAddPart}
                                    returnKeyType="done"
                                />
                                <Pressable style={[styles.addPartButton, !newPartName.trim() && { opacity: 0.4 }]} onPress={handleAddPart} disabled={!newPartName.trim()}>
                                    <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                                </Pressable>
                            </View>
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
    sheet: { backgroundColor: c.surfaceSolid, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%', borderWidth: 1, borderColor: c.border },
    handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.textTertiary, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 20 },
    fieldGroup: { gap: 6, marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    helperText: { fontSize: 12, color: c.textTertiary, marginTop: -2 },
    input: { borderRadius: 14, borderWidth: 1, borderColor: c.inputBorder, paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: c.text, backgroundColor: c.inputBg },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: c.surfaceSolid, borderWidth: 1, borderColor: c.border },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    chipTextActive: { color: '#ffffff' },
    starsRow: { flexDirection: 'row', gap: 2 },
    // Parts
    partRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4 },
    partName: { flex: 1, fontSize: 15, color: c.text },
    partNameWatched: { textDecorationLine: 'line-through', color: c.textTertiary },
    partRemove: { padding: 4 },
    addPartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    addPartInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
    addPartButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    // Switch & buttons
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
