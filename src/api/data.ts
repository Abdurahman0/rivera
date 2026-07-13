import { actions, api, ApiError, resources } from './client';
import { adaptOperationalData, type FrontendData, type OperationalApiData } from './adapters';
import type { DashboardDateRange, PageId } from '../types/crm';
import type {
  ApiAttendanceRecord,
  ApiApproval,
  ApiClient,
  ApiClientDelivery,
  ApiClientOrder,
  ApiClientOrderItem,
  ApiClientPayment,
  ApiDailyWorkEntry,
  ApiDashboardSummary,
  ApiDashboardTimeseries,
  ApiEmployee,
  ApiExpense,
  ApiFinishedGoodsStock,
  ApiFinishedGoodsTransaction,
  ApiMaterial,
  ApiMaterialStock,
  ApiMaterialTransaction,
  ApiOperationType,
  ApiProduct,
  ApiProductCategory,
  ApiProductMaterialNorm,
  ApiProductionBatch,
} from './types';

export interface AppData extends FrontendData {
  summary: ApiDashboardSummary | null;
  revenueSeries: ApiDashboardTimeseries | null;
  approvals: ApiApproval[];
  topClientIds: string[];
}

export const EMPTY_DATA: AppData = {
  clients: [], staff: [], products: [], categories: [], orders: [], materials: [], stockIn: [], stockOut: [],
  revenueEntries: [], expenseEntries: [], pieceworkRecords: [], productionBatches: [], categoryAnalytics: [], summary: null,
  attendanceLog: [],
  approvals: [],
  topClientIds: [],
  revenueSeries: null,
  operationTypeOptions: [],
  finishedVariants: [],
};

const EMPTY_OPERATIONAL_DATA: OperationalApiData = {
  clients: [],
  clientOrders: [],
  orderItems: [],
  deliveries: [],
  payments: [],
  materials: [],
  materialStocks: [],
  materialTransactions: [],
  categories: [],
  products: [],
  norms: [],
  finishedStocks: [],
  finishedTransactions: [],
  batches: [],
  employees: [],
  attendance: [],
  operationTypes: [],
  workEntries: [],
  expenses: [],
};

type OperationalKey = keyof OperationalApiData;

const operationalLoaders = {
  clients: () => allowedList<ApiClient>(resources.clients),
  clientOrders: () => allowedList<ApiClientOrder>(resources.clientOrders),
  orderItems: () => allowedList<ApiClientOrderItem>(resources.clientOrderItems),
  deliveries: () => allowedList<ApiClientDelivery>(resources.clientDeliveries),
  payments: () => allowedList<ApiClientPayment>(resources.clientPayments),
  materials: () => allowedList<ApiMaterial>(resources.materials),
  materialStocks: () => allowedList<ApiMaterialStock>(resources.materialStocks),
  materialTransactions: () => allowedList<ApiMaterialTransaction>(resources.materialTransactions),
  categories: () => allowedList<ApiProductCategory>(resources.productCategories),
  products: () => allowedList<ApiProduct>(resources.products),
  norms: () => allowedList<ApiProductMaterialNorm>(resources.productMaterialNorms),
  finishedStocks: () => allowedList<ApiFinishedGoodsStock>(resources.finishedGoodsStocks),
  finishedTransactions: () => allowedList<ApiFinishedGoodsTransaction>(resources.finishedGoodsTransactions),
  batches: () => allowedList<ApiProductionBatch>(resources.productionBatches),
  employees: () => allowedList<ApiEmployee>(resources.employees),
  attendance: () => allowedList<ApiAttendanceRecord>(resources.attendanceRecords),
  operationTypes: () => allowedList<ApiOperationType>(resources.operationTypes),
  workEntries: () => allowedList<ApiDailyWorkEntry>(resources.dailyWorkEntries),
  expenses: () => allowedList<ApiExpense>(resources.expenses),
} satisfies Record<OperationalKey, () => Promise<unknown[]>>;

const PAGE_OPERATIONAL_KEYS: Record<PageId, OperationalKey[]> = {
  dashboard: [
    'clients', 'clientOrders', 'materials', 'materialStocks', 'categories', 'products', 'deliveries', 'finishedStocks', 'employees', 'attendance',
  ],
  clients: ['clients'],
  orders: ['clients', 'clientOrders', 'orderItems', 'deliveries', 'payments', 'products', 'batches', 'employees', 'operationTypes', 'workEntries'],
  production: [
    'products', 'categories', 'norms', 'materials', 'materialStocks', 'materialTransactions', 'deliveries', 'finishedStocks', 'batches', 'employees', 'operationTypes', 'workEntries',
  ],
  materials: ['materials', 'materialStocks'],
  products: ['products', 'categories', 'norms', 'materials', 'deliveries', 'finishedStocks'],
  warehouse: ['products', 'categories', 'deliveries', 'finishedStocks', 'materials', 'materialTransactions', 'finishedTransactions', 'batches'],
  staff: ['employees', 'attendance', 'batches', 'operationTypes', 'workEntries'],
  finance: ['clients', 'clientOrders', 'payments', 'expenses'],
  approvals: ['materials', 'products'],
  system: [],
};

async function allowedList<T>(resource: string, params?: Record<string, string>) {
  try {
    return await api.list<T>(resource, params);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return [];
    throw error;
  }
}

async function allowedSummary(range?: DashboardDateRange | null) {
  try {
    return await actions.dashboardSummary<ApiDashboardSummary>(
      range ? { date_from: range.startDate, date_to: range.endDate } : undefined,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  }
}

async function allowedTimeseries(range?: DashboardDateRange | null) {
  try {
    return await actions.dashboardTimeseries<ApiDashboardTimeseries>(
      range ? { date_from: range.startDate, date_to: range.endDate } : undefined,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  }
}

async function allowedTopClients() {
  try {
    return await actions.topClients<Array<{ client: string }>>(10);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return [];
    throw error;
  }
}

async function loadOperationalData(page: PageId): Promise<OperationalApiData> {
  const entries = await Promise.all(
    [...new Set(PAGE_OPERATIONAL_KEYS[page])].map(async key => [key, await operationalLoaders[key]()] as const),
  );
  return { ...EMPTY_OPERATIONAL_DATA, ...Object.fromEntries(entries) } as OperationalApiData;
}

export async function loadAppData(page: PageId, dashboardRange?: DashboardDateRange | null): Promise<AppData> {
  const shouldLoadSummary = page === 'dashboard' || page === 'warehouse';
  const shouldLoadApprovals = page === 'approvals';
  const shouldLoadTopClients = page === 'dashboard';

  const [operational, summary, approvals, topClients, revenueSeries] = await Promise.all([
    loadOperationalData(page),
    shouldLoadSummary ? allowedSummary(page === 'dashboard' ? dashboardRange : null) : Promise.resolve(null),
    // The approvals page needs the whole history; every other page still fetches the
    // pending ones so the sidebar can show the awaiting-review notification count.
    shouldLoadApprovals ? allowedList<ApiApproval>(resources.approvals) : allowedList<ApiApproval>(resources.approvals, { status: 'pending' }),
    shouldLoadTopClients ? allowedTopClients() : Promise.resolve([]),
    page === 'dashboard' ? allowedTimeseries(dashboardRange) : Promise.resolve(null),
  ]);

  return { ...adaptOperationalData(operational), summary, revenueSeries, approvals, topClientIds: topClients.map(row => row.client) };
}
