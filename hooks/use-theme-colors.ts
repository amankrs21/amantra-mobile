import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/constants/theme';

export function useThemeColors(): ThemeColors {
    const { colors } = useTheme();
    return colors;
}
