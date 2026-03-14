import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { type CategoryDef } from '@/utils/categories';

type CategoryFilterBarProps = {
    categories: CategoryDef[];
    selected: string | null;
    onSelect: (key: string | null) => void;
};

export default function CategoryFilterBar({ categories, selected, onSelect }: CategoryFilterBarProps) {
    return (
        <View style={styles.wrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <Pressable
                    style={[styles.chip, !selected && styles.chipActive]}
                    onPress={() => onSelect(null)}
                >
                    <MaterialCommunityIcons name="view-grid" size={14} color={!selected ? '#fff' : '#64748b'} />
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

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 12,
    },
    scroll: {
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.06)',
    },
    chipActive: {
        backgroundColor: '#1e293b',
    },
    chipLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    chipLabelActive: {
        color: '#fff',
    },
});
