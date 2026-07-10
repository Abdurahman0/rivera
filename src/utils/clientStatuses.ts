import type { StatusTone } from '../types/crm';

export interface CustomClientStatus {
  key: string;
  label: string;
  tone: StatusTone;
}

export const BUILT_IN_CLIENT_STATUSES = ['active', 'new', 'vip', 'blocked', 'inactive'] as const;

const STORAGE_KEY = 'rivera-client-custom-statuses';

/** The backend `Client.status` field is freeform text, not a catalog with its own endpoint,
 *  so custom statuses the user defines here only exist client-side (localStorage). */
export function loadCustomClientStatuses(): CustomClientStatus[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is CustomClientStatus =>
      Boolean(entry) && typeof entry === 'object' &&
      typeof (entry as CustomClientStatus).key === 'string' &&
      typeof (entry as CustomClientStatus).label === 'string' &&
      typeof (entry as CustomClientStatus).tone === 'string');
  } catch {
    return [];
  }
}

export function saveCustomClientStatuses(statuses: CustomClientStatus[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
}

export function slugifyStatusKey(label: string): string {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || `status_${Math.random().toString(36).slice(2, 8)}`;
}
