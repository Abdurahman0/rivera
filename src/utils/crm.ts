import type { PageId, Product, StatusTone, StockMovement } from '../types/crm';

export function getPageFromPath(pathname: string): PageId {
  const path = pathname.replace(/^\/+/, '').split('/')[0];
  const pages: PageId[] = ['dashboard', 'clients', 'orders', 'production', 'materials', 'products', 'warehouse', 'staff', 'finance', 'approvals', 'system'];
  return pages.includes(path as PageId) ? (path as PageId) : 'dashboard';
}

export function materialStatusTone(statusKey: string): StatusTone {
  if (statusKey === 'ok') return 'success';
  if (statusKey === 'low') return 'warning';
  if (statusKey === 'critical' || statusKey === 'outOfStock') return 'danger';
  return 'neutral';
}

export function hexToRgba(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function statusTone(statusKey: string): StatusTone {
  if (statusKey === 'won' || statusKey === 'contract' || statusKey === 'onTime' || statusKey === 'clear' || statusKey === 'active') return 'success';
  if (statusKey === 'followUp' || statusKey === 'sample' || statusKey === 'late' || statusKey === 'hasBalance' || statusKey === 'new') return 'warning';
  if (statusKey === 'leftEarly' || statusKey === 'blocked') return 'danger';
  if (statusKey === 'newLead' || statusKey === 'remote' || statusKey === 'vip') return 'info';
  if (statusKey === 'inactive') return 'neutral';
  return 'neutral';
}

export function orderStatusTone(statusKey: string): StatusTone {
  if (statusKey === 'delivered' || statusKey === 'completed') return 'success';
  if (statusKey === 'pending' || statusKey === 'production' || statusKey === 'confirmed') return 'warning';
  if (statusKey === 'cancelled') return 'danger';
  if (statusKey === 'draft') return 'neutral';
  return 'info';
}

export function parseQuantity(value: string) {
  const normalized = value.replace(/[^\d.-]/g, '');
  return Number(normalized) || 0;
}

export function calculateInventory(stockIn: StockMovement[], stockOut: StockMovement[]) {
  const inventory: Record<string, number> = {};

  stockIn.forEach(row => {
    inventory[row.product] = (inventory[row.product] ?? 0) + Math.abs(parseQuantity(row.quantity));
  });

  stockOut.forEach(row => {
    inventory[row.product] = (inventory[row.product] ?? 0) - Math.abs(parseQuantity(row.quantity));
  });

  return inventory;
}

export function normalizeCategoryCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

export function unitLabel(unit: Product['unit'], t: (key: string) => string) {
  if (unit === 'm') return t('common.meters');
  if (unit === 'kg') return t('common.kg');
  return t('common.pcs');
}

type Translator = (key: string, options?: Record<string, unknown>) => string;

const BACKEND_ERROR_TRANSLATIONS: Record<string, string> = {
  'insufficient material stock': 'errors.insufficientMaterialStock',
  'insufficient finished goods stock': 'errors.insufficientFinishedGoodsStock',
};

export function translateBackendMessage(t: Translator, message: string) {
  const exactKey = BACKEND_ERROR_TRANSLATIONS[message.trim().toLowerCase()];
  if (exactKey) return t(exactKey, { defaultValue: message });
  return message;
}

export function apiErrorMessage(error: unknown, t: Translator, fallbackKey = 'admin.ui.requestFailed') {
  if (!(error instanceof Error)) return t(fallbackKey);
  const details = (error as Error & { details?: unknown }).details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const detail = (details as Record<string, unknown>).detail;
    if (typeof detail === 'string') return translateBackendMessage(t, detail);
  }
  return translateBackendMessage(t, error.message || t(fallbackKey));
}

/** Translates a statusKey through the shared `statuses.*` dictionary. */
export function statusLabel(t: Translator, statusKey: string) {
  return t(`statuses.${statusKey}`, { defaultValue: statusKey.replaceAll('_', ' ') });
}

/** Translates a raw backend enum value (e.g. employee position, salary type, material unit name) through `admin.options.<domain>.*`. */
export function optionLabel(t: Translator, domain: string, value: string) {
  return t(`admin.options.${domain}.${value}`, { defaultValue: value.replaceAll('_', ' ') });
}

/** Formats an ISO date/datetime string (`2026-06-30` or `2026-06-30T14:00`) as a compact
 *  human-readable date (`30 Iyun 2026`) in the current UI language. Falls back to the raw
 *  value for anything that isn't a plain ISO date. */
export function formatDisplayDate(value: string | null | undefined, t: Translator): string {
  if (!value) return '—';
  const datePart = value.split('T')[0];
  const segments = datePart.split('-');
  if (segments.length !== 3) return value;
  const [year, month, day] = segments.map(Number);
  if (!year || !month || !day) return value;
  const monthName = t(`common.months.${month - 1}`, { defaultValue: String(month) });
  return `${day} ${monthName} ${year}`;
}

/** Like `formatDisplayDate`, but also appends the local time-of-day (for audit-log style
 *  timestamps such as `created_at` where the exact moment matters, not just the day). */
export function formatDisplayDateTime(value: string | null | undefined, t: Translator): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${formatDisplayDate(isoDate, t)}, ${time}`;
}
