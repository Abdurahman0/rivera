/** The backend `ProductCategory` model only has a `name` field — no color of its own —
 *  so category colors are a client-side-only preference (localStorage), keyed by the
 *  category's real backend id. Categories with no saved color fall back to a palette
 *  color picked by their position, matching the existing dashboard analytics palette. */
export const CATEGORY_COLOR_PALETTE = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#ef4444', '#22c55e'] as const;

const STORAGE_KEY = 'rivera-category-colors';

export function loadCategoryColors(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, value]) => typeof value === 'string')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveCategoryColors(colors: Record<string, string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

export function defaultCategoryColor(index: number): string {
  return CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length];
}

export function categoryColor(categoryId: string, index: number, overrides: Record<string, string>): string {
  return overrides[categoryId] || defaultCategoryColor(index);
}
