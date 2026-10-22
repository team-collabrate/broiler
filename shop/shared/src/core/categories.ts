import type { Variant } from './types';

/** A tab at the counter. The owner can change this list (settings/categories); these are the starting tabs. */
export interface Category {
  key: string;
  name: string;
  nameTa: string;
  /** Optional photo for the tab: an image key or https link. */
  image?: string | null;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { key: 'chicken', name: 'Chicken', nameTa: 'கோழி' },
  { key: 'other', name: 'Others', nameTa: 'மற்றவை' },
  { key: 'mutton', name: 'Mutton', nameTa: 'மட்டன்' },
];

/** Names of tabs used by earlier versions, so old orders still show a proper label. */
const LEGACY_LABELS: Record<string, string> = {
  broiler: 'பிராய்லர்',
  naatukoli: 'நாட்டுக்கோழி',
  kadai: 'காடை',
  offal: 'ஈரல் • குடல் • இரத்தம்',
  more: 'மற்றவை',
};

const LEGACY_LABELS_EN: Record<string, string> = {
  broiler: 'Broiler',
  naatukoli: 'Country chicken',
  kadai: 'Quail',
  offal: 'Offal',
  more: 'Others',
};

/** The three counter tabs an earlier version's categories fold into, so old menu items land under a current tab. */
const LEGACY_CATEGORY: Record<string, string> = {
  broiler: 'chicken',
  naatukoli: 'chicken',
  kadai: 'chicken',
  offal: 'mutton',
  more: 'other',
};

/** The current category key for a stored one: older keys fold into the three tabs, anything else is kept. */
export function canonicalCategory(key: string): string {
  return LEGACY_CATEGORY[key] ?? key;
}

/** Tab label for a category key: Tamil by default, English (`Chicken`) for the counter screen. Unknown keys fall back to the key itself. */
export function categoryLabel(key: string, categories: Category[] = DEFAULT_CATEGORIES, lang: 'ta' | 'en' = 'ta'): string {
  const found = categories.find((c) => c.key === key);
  if (lang === 'en') return found?.name || LEGACY_LABELS_EN[key] || key;
  return found?.nameTa ?? LEGACY_LABELS[key] ?? key;
}

/** Position of a category among the tabs; unknown keys sort last. */
export function categoryOrder(key: string, categories: Category[] = DEFAULT_CATEGORIES): number {
  const index = categories.findIndex((c) => c.key === key);
  return index === -1 ? categories.length : index;
}

/** A categories list from stored data: valid entries only, never empty (falls back to the defaults). */
export function normalizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return DEFAULT_CATEGORIES;
  const seen = new Set<string>();
  const list: Category[] = [];
  for (const c of raw) {
    const key = typeof c?.key === 'string' ? c.key.trim() : '';
    const nameTa = typeof c?.nameTa === 'string' ? c.nameTa.trim() : '';
    const name = typeof c?.name === 'string' ? c.name.trim() : '';
    if (key === '' || seen.has(key) || (nameTa === '' && name === '')) continue;
    seen.add(key);
    list.push({ key, name: name || nameTa, nameTa: nameTa || name, image: typeof c.image === 'string' && c.image !== '' ? c.image : null });
  }
  return list.length > 0 ? list : DEFAULT_CATEGORIES;
}

export const VARIANT_LABELS: Record<Variant, { name: string; nameTa: string }> = {
  live: { name: 'Live', nameTa: 'உயிருடன்' },
  skin: { name: 'With skin', nameTa: 'தோலுடன்' },
  skinless: { name: 'Skinless', nameTa: 'தோலில்லா' },
  bone: { name: 'With bone', nameTa: 'எலும்புடன்' },
  boneless: { name: 'Boneless', nameTa: 'எலும்பில்லா' },
};
