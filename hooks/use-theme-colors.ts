import { useColorScheme } from 'react-native';
import { Colors, type ThemeColors } from '@/constants/theme';

export function useThemeColors() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
