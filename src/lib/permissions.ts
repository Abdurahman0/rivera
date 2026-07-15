import type { ApiCurrentUser } from '../api/types';
import type { PageId } from '../types/crm';

export type PermissionLevel = 'view' | 'manage';

/** Backend `page` permission keys behind each frontend nav page. A nav page is
 *  visible if the user has at least `view` on any one of its backend pages. */
export const NAV_PAGE_BACKEND_PAGES: Record<PageId, string[]> = {
  dashboard: ['dashboard'],
  clients: ['clients'],
  orders: ['clients'],
  production: ['production'],
  materials: ['materials'],
  products: ['products'],
  warehouse: ['inventory'],
  staff: ['employees', 'attendance', 'payroll'],
  finance: ['finance'],
  approvals: ['approvals'],
  system: ['users', 'settings', 'backups', 'audit', 'security_logs'],
};

/** Backend page each Operations/System admin-panel resource belongs to. */
export const RESOURCE_BACKEND_PAGE: Record<string, string> = {
  clientOrders: 'clients', deliveries: 'clients', payments: 'clients', returns: 'clients',
  materialStocks: 'inventory', defectiveStocks: 'inventory', defectiveTransactions: 'inventory',
  materialUsages: 'production',
  schedules: 'employees',
  devices: 'attendance',
  operationTypes: 'payroll', workEntries: 'payroll', payrolls: 'payroll',
  expenses: 'finance',
  users: 'users',
  audit: 'audit',
};

/** Backend page each entity-modal kind (create/edit) is governed by. */
export const ENTITY_KIND_BACKEND_PAGE: Record<string, string> = {
  client: 'clients',
  staff: 'employees',
  product: 'products',
  category: 'products',
  order: 'clients',
  material: 'materials',
  batch: 'production',
  payment: 'clients',
  stockMovement: 'inventory',
};

export function hasPagePermission(user: ApiCurrentUser | null, page: string, level: PermissionLevel): boolean {
  if (!user) return false;
  if (user.is_superadmin) return true;
  if ((user.permissions as { all?: string }).all === 'manage') return true;
  const granted = (user.permissions as Record<string, PermissionLevel>)[page];
  if (!granted) return false;
  return level === 'view' ? true : granted === 'manage';
}

export function canViewNavPage(user: ApiCurrentUser | null, page: PageId): boolean {
  return NAV_PAGE_BACKEND_PAGES[page].some(backendPage => hasPagePermission(user, backendPage, 'view'));
}
