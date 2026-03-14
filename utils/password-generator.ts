const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

export type PasswordOptions = {
    length: number;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
};

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
};

export function generatePassword(options: PasswordOptions): string {
    let charset = '';
    const guaranteed: string[] = [];

    if (options.uppercase) {
        charset += UPPERCASE;
        guaranteed.push(UPPERCASE[Math.floor(Math.random() * UPPERCASE.length)]);
    }
    if (options.lowercase) {
        charset += LOWERCASE;
        guaranteed.push(LOWERCASE[Math.floor(Math.random() * LOWERCASE.length)]);
    }
    if (options.numbers) {
        charset += NUMBERS;
        guaranteed.push(NUMBERS[Math.floor(Math.random() * NUMBERS.length)]);
    }
    if (options.symbols) {
        charset += SYMBOLS;
        guaranteed.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }

    if (!charset) {
        charset = LOWERCASE;
        guaranteed.push(LOWERCASE[Math.floor(Math.random() * LOWERCASE.length)]);
    }

    const remaining = options.length - guaranteed.length;
    const result = [...guaranteed];

    for (let i = 0; i < remaining; i++) {
        result.push(charset[Math.floor(Math.random() * charset.length)]);
    }

    // Shuffle
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result.join('');
}
