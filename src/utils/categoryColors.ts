/** Category colors live on the backend `ProductCategory.color` field. The localStorage
 *  map below is read-only legacy: colors picked before the backend field existed still
 *  render (via the adapter fallback) until the user re-picks them, which now persists
 *  server-side. Categories with no color at all fall back to a palette color by position. */
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

export function defaultCategoryColor(index: number): string {
  return CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length];
}

export function categoryColor(categoryId: string, index: number, overrides: Record<string, string>): string {
  return overrides[categoryId] || defaultCategoryColor(index);
}
