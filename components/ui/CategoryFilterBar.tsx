import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';
import { type CategoryDef } from '@/utils/categories';

type CategoryFilterBarProps = {
    categories: CategoryDef[];
    selected: string | null;
    onSelect: (key: string | null) => void;
};

export default function CategoryFilterBar({ categories, selected, onSelect }: CategoryFilterBarProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.wrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <Pressable
                    style={[styles.chip, !selected && styles.chipActive]}
                    onPress={() => onSelect(null)}
                >
                    <MaterialCommunityIcons name="view-grid" size={14} color={!selected ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.chipLabel, !selected && styles.chipLabelActive]}>All</Text>
                </Pressable>
                {categories.map((cat) => {
                    const active = selected === cat.key;
                    return (
                        <Pressable
                            key={cat.key}
                            style={[styles.chip, active && { backgroundColor: cat.color }]}
                            onPress={() => onSelect(active ? null : cat.key)}
                        >
                            <MaterialCommunityIcons
                                name={cat.icon as any}
                                size={14}
                                color={active ? '#fff' : cat.color}
                            />
                            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                                {cat.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    wrapper: { marginBottom: 12 },
    scroll: { gap: 8 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
        backgroundColor: c.chipBg,
    },
    chipActive: { backgroundColor: c.accent },
    chipLabel: { fontSize: 12, fontWeight: '600', color: c.chipText },
    chipLabelActive: { color: '#fff' },
});
