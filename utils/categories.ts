import AsyncStorage from '@react-native-async-storage/async-storage';

export type CategoryType = 'vault' | 'notes';

export type CategoryDef = {
    key: string;
    label: string;
    color: string;
    icon: string;
};

export const VAULT_CATEGORIES: CategoryDef[] = [
    { key: 'social', label: 'Social', color: '#3b82f6', icon: 'account-group' },
    { key: 'email', label: 'Email', color: '#8b5cf6', icon: 'email' },
    { key: 'banking', label: 'Banking', color: '#10b981', icon: 'bank' },
    { key: 'shopping', label: 'Shopping', color: '#f59e0b', icon: 'cart' },
    { key: 'work', label: 'Work', color: '#0ea5e9', icon: 'briefcase' },
    { key: 'entertainment', label: 'Entertainment', color: '#ec4899', icon: 'gamepad-variant' },
    { key: 'other', label: 'Other', color: '#64748b', icon: 'dots-horizontal' },
];

export const NOTES_CATEGORIES: CategoryDef[] = [
    { key: 'personal', label: 'Personal', color: '#8b5cf6', icon: 'account' },
    { key: 'work', label: 'Work', color: '#0ea5e9', icon: 'briefcase' },
    { key: 'ideas', label: 'Ideas', color: '#f59e0b', icon: 'lightbulb' },
    { key: 'important', label: 'Important', color: '#ef4444', icon: 'alert-circle' },
    { key: 'other', label: 'Other', color: '#64748b', icon: 'dots-horizontal' },
];

const STORAGE_KEYS: Record<CategoryType, string> = {
    vault: 'securevault:vault-categories',
    notes: 'securevault:notes-categories',
};

export type CategoryMapping = Record<string, string>; // entryId -> categoryKey

export async function getCategoryMapping(type: CategoryType): Promise<CategoryMapping> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS[type]);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export async function setCategoryForEntry(
    type: CategoryType,
    entryId: string,
    categoryKey: string | null,
): Promise<void> {
    const mapping = await getCategoryMapping(type);
    if (categoryKey) {
        mapping[entryId] = categoryKey;
    } else {
        delete mapping[entryId];
    }
    await AsyncStorage.setItem(STORAGE_KEYS[type], JSON.stringify(mapping));
}

export async function removeCategoryForEntry(type: CategoryType, entryId: string): Promise<void> {
    await setCategoryForEntry(type, entryId, null);
}

export function getCategoryDef(type: CategoryType, categoryKey: string): CategoryDef | undefined {
    const categories = type === 'vault' ? VAULT_CATEGORIES : NOTES_CATEGORIES;
    return categories.find((c) => c.key === categoryKey);
}
