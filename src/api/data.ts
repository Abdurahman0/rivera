import { actions, api, ApiError, resources } from './client';
import { adaptOperationalData, type FrontendData, type OperationalApiData } from './adapters';
import type {
  ApiAttendanceRecord,
  ApiApproval,
  ApiClient,
  ApiClientDelivery,
  ApiClientOrder,
  ApiClientPayment,
  ApiDailyWorkEntry,
  ApiDashboardSummary,
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
  ApiSupplier,
} from './types';

export interface AppData extends FrontendData {
  summary: ApiDashboardSummary | null;
  approvals: ApiApproval[];
  topClientIds: string[];
}

export const EMPTY_DATA: AppData = {
  clients: [], staff: [], products: [], categories: [], orders: [], materials: [], stockIn: [], stockOut: [], movementHistory: [],
  revenueEntries: [], expenseEntries: [], productionRecords: [], pieceworkRecords: [], productionBatches: [], categoryAnalytics: [], summary: null,
  staffFlow: [],
  approvals: [],
  topClientIds: [],
  operationTypeOptions: [],
};

async function allowedList<T>(resource: string) {
  try {
    return await api.list<T>(resource);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return [];
    throw error;
  }
}

async function allowedSummary() {
  try {
    return await actions.dashboardSummary<ApiDashboardSummary>();
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

export async function loadAppData(): Promise<AppData> {
  const [
    clients, clientOrders, deliveries, payments, materials, suppliers, materialStocks, materialTransactions, categories, products, norms,
    finishedStocks, finishedTransactions, batches, employees, attendance, operationTypes, workEntries, expenses, summary, approvals, topClients,
  ] = await Promise.all([
    allowedList<ApiClient>(resources.clients),
    allowedList<ApiClientOrder>(resources.clientOrders),
    allowedList<ApiClientDelivery>(resources.clientDeliveries),
    allowedList<ApiClientPayment>(resources.clientPayments),
    allowedList<ApiMaterial>(resources.materials),
    allowedList<ApiSupplier>(resources.suppliers),
    allowedList<ApiMaterialStock>(resources.materialStocks),
    allowedList<ApiMaterialTransaction>(resources.materialTransactions),
    allowedList<ApiProductCategory>(resources.productCategories),
    allowedList<ApiProduct>(resources.products),
    allowedList<ApiProductMaterialNorm>(resources.productMaterialNorms),
    allowedList<ApiFinishedGoodsStock>(resources.finishedGoodsStocks),
    allowedList<ApiFinishedGoodsTransaction>(resources.finishedGoodsTransactions),
    allowedList<ApiProductionBatch>(resources.productionBatches),
    allowedList<ApiEmployee>(resources.employees),
    allowedList<ApiAttendanceRecord>(resources.attendanceRecords),
    allowedList<ApiOperationType>(resources.operationTypes),
    allowedList<ApiDailyWorkEntry>(resources.dailyWorkEntries),
    allowedList<ApiExpense>(resources.expenses),
    allowedSummary(),
    allowedList<ApiApproval>(resources.approvals),
    allowedTopClients(),
  ]);
  const operational: OperationalApiData = {
    clients, clientOrders, deliveries, payments, materials, suppliers, materialStocks, materialTransactions, categories, products, norms,
    finishedStocks, finishedTransactions, batches, employees, attendance, operationTypes, workEntries, expenses,
  };
  return { ...adaptOperationalData(operational), summary, approvals, topClientIds: topClients.map(row => row.client) };
}
