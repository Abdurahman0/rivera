import type { PageId, Product, StatusTone, StockMovement } from '../types/crm';

export function getPageFromPath(pathname: string): PageId {
  const path = pathname.replace(/^\/+/, '').split('/')[0];
  const pages: PageId[] = ['dashboard', 'clients', 'orders', 'products', 'warehouse', 'staff', 'finance'];
  return pages.includes(path as PageId) ? (path as PageId) : 'dashboard';
}

export function hexToRgba(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function statusTone(statusKey: string): StatusTone {
  if (statusKey === 'won' || statusKey === 'contract' || statusKey === 'onTime') return 'success';
  if (statusKey === 'followUp' || statusKey === 'sample' || statusKey === 'late') return 'warning';
  if (statusKey === 'leftEarly') return 'danger';
  if (statusKey === 'newLead' || statusKey === 'remote') return 'info';
  return 'neutral';
}

export function orderStatusTone(statusKey: string): StatusTone {
  if (statusKey === 'delivered' || statusKey === 'confirmed') return 'success';
  if (statusKey === 'pending' || statusKey === 'production') return 'warning';
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

export function exportCsv(name: string, rows: Array<Array<unknown>>) {
  if (typeof window === 'undefined') return;
  const csv = rows
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'rivera-export'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function unitLabel(unit: Product['unit'], t: (key: string) => string) {
  if (unit === 'm') return t('common.meters');
  if (unit === 'kg') return t('common.kg');
  return t('common.pcs');
}
