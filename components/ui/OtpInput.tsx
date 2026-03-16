import { useCallback, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme-colors';

type OtpInputProps = {
    length?: number;
    value: string;
    onChange: (otp: string) => void;
    disabled?: boolean;
};

export default function OtpInput({ length = 6, value, onChange, disabled = false }: OtpInputProps) {
    const colors = useThemeColors();
    const inputs = useRef<(TextInput | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

    const handleChange = useCallback((text: string, index: number) => {
        // Handle paste
        if (text.length > 1) {
            const pasted = text.replace(/[^0-9]/g, '').slice(0, length);
            onChange(pasted.padEnd(length, ' ').slice(0, length).replace(/ /g, ''));
            const nextFocus = Math.min(pasted.length, length - 1);
            inputs.current[nextFocus]?.focus();
            return;
        }

        const digit = text.replace(/[^0-9]/g, '');
        const arr = value.split('').concat(Array(length).fill('')).slice(0, length);
        arr[index] = digit;
        const newValue = arr.join('').replace(/ /g, '').slice(0, length);
        onChange(newValue);

        if (digit && index < length - 1) {
            inputs.current[index + 1]?.focus();
        }
    }, [length, onChange, value]);

    const handleKeyPress = useCallback((e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
            const arr = value.split('').concat(Array(length).fill('')).slice(0, length);
            arr[index - 1] = '';
            onChange(arr.join('').trimEnd());
            inputs.current[index - 1]?.focus();
        }
    }, [digits, length, onChange, value]);

    return (
        <View style={styles.row}>
            {Array.from({ length }).map((_, i) => {
                const isFocused = focusedIndex === i;
                return (
                    <TextInput
                        key={i}
                        ref={(ref) => { inputs.current[i] = ref; }}
                        value={digits[i] || ''}
                        onChangeText={(t) => handleChange(t, i)}
                        onKeyPress={(e) => handleKeyPress(e, i)}
                        onFocus={() => setFocusedIndex(i)}
                        onBlur={() => setFocusedIndex(-1)}
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={!disabled}
                        selectTextOnFocus
                        style={[
                            styles.box,
                            {
                                backgroundColor: colors.inputBg,
                                borderColor: isFocused ? colors.accent : colors.inputBorder,
                                color: colors.text,
                                borderWidth: isFocused ? 2 : 1,
                            },
                        ]}
                    />
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
    box: {
        width: 48,
        height: 56,
        borderRadius: 14,
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
    },
});
