import type { ApiList, ApiPayload } from './types';

const ACCESS_KEY = 'rivera-access-token';
const REFRESH_KEY = 'rivera-refresh-token';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function getStored(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storeTokens(access: string, refresh?: string) {
  window.localStorage.setItem(ACCESS_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  sessionExpiredNotified = false;
}

export function clearSession() {
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Storage can be unavailable in hardened browsers.
  }
}

export function hasSession() {
  return Boolean(getStored(ACCESS_KEY) || getStored(REFRESH_KEY));
}

let sessionExpiredHandlers: Array<() => void> = [];
let sessionExpiredNotified = false;

/** Subscribe to be notified when the session is forcibly cleared (token invalid/expired
 *  beyond repair). Returns an unsubscribe function. */
export function onSessionExpired(handler: () => void) {
  sessionExpiredHandlers.push(handler);
  return () => {
    sessionExpiredHandlers = sessionExpiredHandlers.filter(existing => existing !== handler);
  };
}

/** A page load can fire many parallel requests (initial data load); if the token is
 *  dead, every single one would otherwise notify independently. Fire once per episode. */
function notifySessionExpired() {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  sessionExpiredHandlers.forEach(handler => handler());
}

async function parseResponse(response: Response) {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

let refreshPromise: Promise<string | null> | null = null;

/** The backend rotates+blacklists refresh tokens, so concurrent 401s (e.g. the initial
 *  page load firing a dozen parallel requests) must share a single refresh attempt —
 *  otherwise only the first succeeds and every other one spuriously kills the session. */
function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const refresh = getStored(REFRESH_KEY);
  if (!refresh) return Promise.resolve(null);
  refreshPromise = fetch(`${API_BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async response => {
      if (!response.ok) {
        clearSession();
        return null;
      }
      const tokens = await response.json() as { access: string; refresh?: string };
      storeTokens(tokens.access, tokens.refresh);
      return tokens.access;
    })
    .catch(() => null)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const access = getStored(ACCESS_KEY);
  const headers = new Headers(init.headers);
  if (access) headers.set('Authorization', `Bearer ${access}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers });
  const isLoginRequest = path === '/auth/token/';
  if (response.status === 401 && !isLoginRequest) {
    if (retry && getStored(REFRESH_KEY)) {
      const nextAccess = await refreshAccessToken();
      if (nextAccess) return request<T>(path, init, false);
    }
    clearSession();
    notifySessionExpired();
  }
  const payload = await parseResponse(response);
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? String((payload as { detail: unknown }).detail)
      : `API request failed (${response.status})`;
    throw new ApiError(response.status, detail, payload);
  }
  return payload as T;
}

function body(payload?: ApiPayload) {
  if (!payload) return undefined;
  return payload instanceof FormData ? payload : JSON.stringify(payload);
}

export async function login(username: string, password: string) {
  const tokens = await request<{ access: string; refresh: string }>('/auth/token/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  storeTokens(tokens.access, tokens.refresh);
  return tokens;
}

export async function logout() {
  const refresh = getStored(REFRESH_KEY);
  if (refresh) {
    try {
      await request('/auth/logout/', { method: 'POST', body: JSON.stringify({ refresh }) });
    } catch {
      // Best-effort blacklist; always clear local session regardless.
    }
  }
  clearSession();
}

export async function listAll<T>(resource: string, params: Record<string, string | number | boolean | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  query.set('page_size', '1000');
  let path: string | null = `/${resource}/?${query.toString()}`;
  const rows: T[] = [];
  while (path) {
    const page: ApiList<T> | T[] = await request(path);
    if (Array.isArray(page)) return page;
    rows.push(...page.results);
    if (page.next) {
      const nextUrl: URL = new URL(page.next, API_BASE);
      path = `${nextUrl.pathname.replace(/^\/api/, '')}${nextUrl.search}`;
    } else {
      path = null;
    }
  }
  return rows;
}

export async function downloadExport(resource: string) {
  const fetchFile = async (access: string | null) => fetch(`${API_BASE}/${resource}/export/`, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  let response = await fetchFile(getStored(ACCESS_KEY));
  if (response.status === 401 && getStored(REFRESH_KEY)) {
    const access = await refreshAccessToken();
    if (access) response = await fetchFile(access);
  }
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new ApiError(response.status, `Export failed (${response.status})`, payload);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `${resource}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, payload?: ApiPayload) => request<T>(path, { method: 'POST', body: body(payload) }),
  patch: <T>(path: string, payload: ApiPayload) => request<T>(path, { method: 'PATCH', body: body(payload) }),
  put: <T>(path: string, payload: ApiPayload) => request<T>(path, { method: 'PUT', body: body(payload) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
  list: listAll,
  create: <T>(resource: string, payload: ApiPayload) => request<T>(`/${resource}/`, { method: 'POST', body: body(payload) }),
  update: <T>(resource: string, id: string | number, payload: ApiPayload) => request<T>(`/${resource}/${id}/`, { method: 'PATCH', body: body(payload) }),
  remove: (resource: string, id: string | number) => request<void>(`/${resource}/${id}/`, { method: 'DELETE' }),
  restore: <T>(resource: string, id: string | number) => request<T>(`/${resource}/${id}/restore/?include_archived=true`, { method: 'POST' }),
  export: downloadExport,
};

// Every router resource exposed by the backend. Keeping this registry in one
// place makes permissions/admin screens able to use the same typed client.
export const resources = {
  users: 'users', permissions: 'permissions', approvals: 'approvals', auditLogs: 'audit-logs',
 clients: 'clients', clientOrders: 'client-orders', clientOrderItems: 'client-order-items', clientDeliveries: 'client-deliveries', clientPayments: 'client-payments',
  clientReturns: 'client-returns', clientDebtAdjustments: 'client-debt-adjustments', materials: 'materials', productCategories: 'product-categories',
  products: 'products', productMaterialNorms: 'product-material-norms', materialStocks: 'material-stocks', materialTransactions: 'material-transactions',
  defectiveMaterialStocks: 'defective-material-stocks', defectiveMaterialTransactions: 'defective-material-transactions', finishedGoodsStocks: 'finished-goods-stocks',
  finishedGoodsTransactions: 'finished-goods-transactions', productionBatches: 'production-batches', productionBatchItems: 'production-batch-items',
  productionMaterialUsages: 'production-material-usages', employees: 'employees', employeeTerminations: 'employee-terminations',
  leaveRequests: 'leave-requests', workSchedules: 'work-schedules', employeeFaceEncodings: 'employee-face-encodings',
  attendanceDevices: 'attendance-devices', attendanceEvents: 'attendance-events', attendanceRecords: 'attendance-records', operationTypes: 'operation-types',
  dailyWorkEntries: 'daily-work-entries', monthlyPayrolls: 'monthly-payrolls',
  cashAccounts: 'cash-accounts', cashTransactions: 'cash-transactions', expenses: 'expenses', dashboard: 'dashboard',
} as const;

export const actions = {
  approve: (id: string) => api.post(`/approvals/${id}/approve/`),
  reject: (id: string, reason: string) => api.post(`/approvals/${id}/reject/`, { reason }),
  dashboardSummary: <T>(range?: { date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (range?.date_from) query.set('date_from', range.date_from);
    if (range?.date_to) query.set('date_to', range.date_to);
    const qs = query.toString();
    return api.get<T>(`/dashboard/summary/${qs ? `?${qs}` : ''}`);
  },
  dashboardTimeseries: <T>(range?: { date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (range?.date_from) query.set('date_from', range.date_from);
    if (range?.date_to) query.set('date_to', range.date_to);
    const qs = query.toString();
    return api.get<T>(`/dashboard/timeseries/${qs ? `?${qs}` : ''}`);
  },
  topClients: <T>(limit = 10) => api.get<T>(`/dashboard/top_clients/?limit=${limit}`),
  authMe: <T>() => api.get<T>('/auth/me/'),
  deviceAttendanceCheck: <T>(payload: FormData | Record<string, unknown>) => api.post<T>('/attendance-events/check/', payload),
  deliverBatch: <T>(batchId: string, payload: { quantity: number; date: string; size?: string; color?: string }) => api.post<T>(`/production-batches/${batchId}/deliver/`, payload),
  calculatePayroll: <T>(month: string) => api.post<T>('/monthly-payrolls/calculate/', { month }),
  approvePayroll: <T>(id: string) => api.post<T>(`/monthly-payrolls/${id}/approve/`),
  markPayrollPaid: <T>(id: string) => api.post<T>(`/monthly-payrolls/${id}/mark_paid/`),
  unlockPayroll: <T>(id: string) => api.post<T>(`/monthly-payrolls/${id}/unlock/`),
};

export { API_BASE };
