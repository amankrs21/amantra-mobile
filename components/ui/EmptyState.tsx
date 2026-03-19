import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';

type Props = { icon: string; title: string; subtitle: string };

export default function EmptyState({ icon, title, subtitle }: Props) {
    const colors = useThemeColors();
    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name={icon as any} size={48} color={colors.textTertiary} />
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: 'center', gap: 8, paddingTop: 48 },
    title: { fontSize: 18, fontWeight: '600' },
    subtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
