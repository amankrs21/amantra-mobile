import { useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ThemeColors } from '@/constants/theme';

type Props = {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
};

export default function SearchBar({ value, onChangeText, placeholder = 'Search by title' }: Props) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.placeholder} />
            <TextInput placeholder={placeholder} placeholderTextColor={colors.placeholder} style={styles.searchInput} value={value} onChangeText={onChangeText} />
            {value ? (
                <Pressable style={styles.clearButton} onPress={() => onChangeText('')}>
                    <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
            ) : null}
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceSolid, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, fontSize: 16, color: c.text },
    clearButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cancelBg },
});
