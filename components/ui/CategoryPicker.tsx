import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { type CategoryDef } from '@/utils/categories';

type CategoryPickerProps = {
    categories: CategoryDef[];
    selected: string | null;
    onSelect: (key: string | null) => void;
};

export default function CategoryPicker({ categories, selected, onSelect }: CategoryPickerProps) {
    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {categories.map((cat) => {
                    const active = selected === cat.key;
                    return (
                        <Pressable
                            key={cat.key}
                            style={[
                                styles.chip,
                                active && { backgroundColor: cat.color },
                            ]}
                            onPress={() => onSelect(active ? null : cat.key)}
                        >
                            <MaterialCommunityIcons
                                name={cat.icon as any}
                                size={16}
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
    container: {
        marginVertical: 4,
    },
    scroll: {
        gap: 8,
        paddingHorizontal: 2,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.06)',
    },
    chipLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    chipLabelActive: {
        color: '#fff',
    },
});
