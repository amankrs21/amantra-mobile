import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { type CategoryDef } from '@/utils/categories';

type CategoryBadgeProps = {
    category: CategoryDef;
    size?: 'small' | 'normal';
};

export default function CategoryBadge({ category, size = 'normal' }: CategoryBadgeProps) {
    const isSmall = size === 'small';
    return (
        <View
            style={[
                styles.badge,
                { backgroundColor: `${category.color}18` },
                isSmall && styles.badgeSmall,
            ]}
        >
            <MaterialCommunityIcons
                name={category.icon as any}
                size={isSmall ? 12 : 14}
                color={category.color}
            />
            <Text
                style={[
                    styles.label,
                    { color: category.color },
                    isSmall && styles.labelSmall,
                ]}
            >
                {category.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    badgeSmall: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
    },
    labelSmall: {
        fontSize: 11,
    },
});
