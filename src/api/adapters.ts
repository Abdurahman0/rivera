import type {
  ApiAttendanceRecord,
  ApiClient,
  ApiClientDelivery,
  ApiClientOrder,
  ApiClientPayment,
  ApiDailyWorkEntry,
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
import i18n from '../i18n';
import type {
  CategoryDatum,
  Client,
  FinanceEntry,
  Material,
  Order,
  PieceworkRecord,
  Product,
  ProductCategory,
  ProductionBatch,
  ProductionRecord,
  StaffMember,
  StockMovement,
} from '../types/crm';

const number = (value: unknown) => Number(value) || 0;
const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const materialUnit = (value: ApiMaterial['unit']): Material['unit'] => value === 'piece' ? 'pcs' : value === 'linear_meter' ? 'm' : value;
const productPlaceholder = (name: string) => {
  const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'R';
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="28" font-weight="700">${initials}</text></svg>`)}`;
};

export interface OperationalApiData {
  clients: ApiClient[];
  clientOrders: ApiClientOrder[];
  deliveries: ApiClientDelivery[];
  payments: ApiClientPayment[];
  materials: ApiMaterial[];
  suppliers: ApiSupplier[];
  materialStocks: ApiMaterialStock[];
  materialTransactions: ApiMaterialTransaction[];
  categories: ApiProductCategory[];
  products: ApiProduct[];
  norms: ApiProductMaterialNorm[];
  finishedStocks: ApiFinishedGoodsStock[];
  finishedTransactions: ApiFinishedGoodsTransaction[];
  batches: ApiProductionBatch[];
  employees: ApiEmployee[];
  attendance: ApiAttendanceRecord[];
  operationTypes: ApiOperationType[];
  workEntries: ApiDailyWorkEntry[];
  expenses: ApiExpense[];
}

export interface FrontendData {
  clients: Client[];
  staff: StaffMember[];
  products: Product[];
  categories: ProductCategory[];
  orders: Order[];
  materials: Material[];
  stockIn: StockMovement[];
  stockOut: StockMovement[];
  movementHistory: StockMovement[];
  revenueEntries: FinanceEntry[];
  expenseEntries: FinanceEntry[];
  productionRecords: ProductionRecord[];
  pieceworkRecords: PieceworkRecord[];
  productionBatches: ProductionBatch[];
  categoryAnalytics: CategoryDatum[];
  staffFlow: Array<{ day: string; came: number; late: number; left: number }>;
  operationTypeOptions: Array<{ id: string; name: string }>;
}

export function adaptOperationalData(data: OperationalApiData): FrontendData {
  const clientNames = new Map(data.clients.map(row => [row.id, row.full_name]));
  const productNames = new Map(data.products.map(row => [row.id, row.name]));
  const categoryNames = new Map(data.categories.map(row => [row.id, row.name]));
  const employeeNames = new Map(data.employees.map(row => [row.id, row.full_name]));
  const operationNames = new Map(data.operationTypes.map(row => [row.id, row.name]));
  const batchNames = new Map(data.batches.map(row => [row.id, row.batch_number]));
  const batchById = new Map(data.batches.map(row => [row.id, row]));
  const materialById = new Map(data.materials.map(row => [row.id, row]));
  const supplierNames = new Map(data.suppliers.map(row => [row.id, row.name]));
  const materialStock = new Map(data.materialStocks.map(row => [row.material, number(row.quantity)]));
  const finishedStock = new Map<string, number>();
  data.finishedStocks.forEach(row => finishedStock.set(row.product, (finishedStock.get(row.product) || 0) + row.quantity));
  const deliveredByProduct = new Map<string, number>();
  data.deliveries.forEach(row => deliveredByProduct.set(row.product, (deliveredByProduct.get(row.product) || 0) + row.quantity));
  const attendanceByEmployee = new Map<string, ApiAttendanceRecord[]>();
  data.attendance.forEach(row => attendanceByEmployee.set(row.employee, [...(attendanceByEmployee.get(row.employee) || []), row]));
  const normsByProduct = new Map<string, ApiProductMaterialNorm[]>();
  data.norms.forEach(row => normsByProduct.set(row.product, [...(normsByProduct.get(row.product) || []), row]));

  const categories: ProductCategory[] = data.categories.map((row, index) => ({
    id: row.id,
    name: row.name,
    code: row.name.slice(0, 3).toUpperCase(),
    description: '',
    sortOrder: index + 1,
    api: row as unknown as Record<string, unknown>,
  }));

  const products: Product[] = data.products.map(row => {
    const sold = deliveredByProduct.get(row.id) || 0;
    const price = number(row.unit_price_with_tax_uzs);
    return {
      id: row.id,
      name: row.name,
      description: [row.material_type, row.size_range].filter(Boolean).join(' · '),
      category: row.category ? categoryNames.get(row.category) || '—' : '—',
      categoryId: row.category || '',
      sku: row.code,
      supplier: '—',
      warehouse: '—',
      color: row.color,
      composition: row.material_type,
      gsm: 0,
      width: row.size_range,
      price,
      currency: 'UZS',
      imageUrl: productPlaceholder(row.name),
      gallery: [],
      status: 'Active',
      isActive: !row.is_archived,
      isRecommended: false,
      subsidyEnabled: false,
      stock: finishedStock.get(row.id) || 0,
      minStock: 0,
      unit: 'pcs',
      sold,
      revenue: sold * price,
      trend: 0,
      recipe: (normsByProduct.get(row.id) || []).map(norm => {
        const material = materialById.get(norm.material);
        return { id: norm.id, materialId: norm.material, materialName: material?.name || norm.material, qtyPerUnit: number(norm.norm_per_unit), unit: material ? materialUnit(material.unit) : 'pcs' };
      }),
      api: row as unknown as Record<string, unknown>,
    };
  });

  const clients: Client[] = data.clients.map(row => ({
    id: row.id,
    name: row.full_name,
    phone: row.phone,
    source: row.address || '—',
    status: row.status || 'active',
    statusKey: row.status || 'active',
    manager: '—',
    value: number(row.balance),
    lastContact: row.updated_at.slice(0, 10),
    fabric: row.note || '—',
    api: row as unknown as Record<string, unknown>,
  }));

  const orders: Order[] = data.clientOrders.map(row => ({
    id: row.id,
    orderId: row.order_number,
    client: clientNames.get(row.client) || row.client,
    orderDate: row.order_date,
    dueDate: row.due_date || '—',
    totalAmount: number(row.total_amount_uzs),
    status: row.status,
    statusKey: row.status,
    notes: row.note,
    clientId: row.client,
    api: row as unknown as Record<string, unknown>,
  }));

  const materials: Material[] = data.materials.map(row => {
    const stock = materialStock.get(row.id) || 0;
    const minStock = number(row.min_stock_level);
    const statusKey = stock === 0 ? 'outOfStock' : stock <= minStock ? 'low' : 'ok';
    return {
      id: row.id,
      name: row.name,
      sku: row.code,
      supplier: (row.supplier && supplierNames.get(row.supplier)) || '—',
      unit: materialUnit(row.unit),
      price: number(row.unit_price),
      stock,
      minStock,
      status: statusKey,
      statusKey,
      api: row as unknown as Record<string, unknown>,
    };
  });

  const staff: StaffMember[] = data.employees.map(row => {
    const records = attendanceByEmployee.get(row.id) || [];
    const present = records.filter(record => record.status === 'present' || record.status === 'late').length;
    const attendance = records.length ? Math.round((present / records.length) * 100) : 0;
    const latest = [...records].sort((a, b) => b.work_date.localeCompare(a.work_date))[0];
    return {
      id: row.id,
      name: row.full_name,
      role: row.position,
      phone: row.phone,
      salary: number(row.daily_rate),
      hireDate: row.hire_date,
      shift: row.salary_type,
      arrival: dateTime(latest?.first_check_in_at),
      leaving: dateTime(latest?.last_check_out_at),
      status: row.status,
      statusKey: latest?.status === 'late' ? 'late' : row.status === 'active' ? 'onTime' : 'leftEarly',
      attendance,
      api: row as unknown as Record<string, unknown>,
    };
  });

  const pieceworkRecords: PieceworkRecord[] = data.workEntries.map((row, index) => ({
    id: index + 1,
    employeeName: employeeNames.get(row.employee) || row.employee,
    operationName: operationNames.get(row.operation_type) || row.operation_type,
    product: row.related_batch ? batchNames.get(row.related_batch) || row.related_batch : '—',
    quantity: row.quantity_done,
    ratePerPiece: row.quantity_done ? number(row.amount) / row.quantity_done : 0,
    unit: 'pcs',
    week: row.date,
  }));

  const productionRecords: ProductionRecord[] = data.workEntries.map((row, index) => ({
    id: index + 1,
    date: row.date,
    employee: employeeNames.get(row.employee) || row.employee,
    role: '',
    product: row.related_batch ? productNames.get(batchById.get(row.related_batch)?.product || '') || batchNames.get(row.related_batch) || row.related_batch : '—',
    operation: operationNames.get(row.operation_type) || row.operation_type,
    quantity: row.quantity_done,
    unit: 'pcs',
    amount: number(row.amount),
    orderId: row.related_batch ? batchNames.get(row.related_batch) || null : null,
    shift: '',
    notes: row.note,
    api: row as unknown as Record<string, unknown>,
  }));

  const employeesByBatch = new Map<string, Set<string>>();
  data.workEntries.forEach(row => {
    if (!row.related_batch) return;
    const key = String(row.related_batch);
    const name = employeeNames.get(row.employee) || row.employee;
    if (!employeesByBatch.has(key)) employeesByBatch.set(key, new Set());
    employeesByBatch.get(key)!.add(name);
  });

  const materialIssuesByBatch = new Map<string, Map<string, {
    materialId: string;
    materialName: string;
    unit: Material['unit'];
    quantity: number;
    approvedQuantity: number;
    pendingQuantity: number;
    rejectedQuantity: number;
    count: number;
  }>>();
  data.materialTransactions
    .filter(row => row.transaction_type === 'out_production' && row.related_production_batch)
    .forEach(row => {
      const batchId = String(row.related_production_batch);
      const material = materialById.get(row.material);
      const materialId = String(row.material);
      const batchIssues = materialIssuesByBatch.get(batchId) || new Map();
      const current = batchIssues.get(materialId) || {
        materialId,
        materialName: material?.name || materialId,
        unit: material ? materialUnit(material.unit) : 'pcs',
        quantity: 0,
        approvedQuantity: 0,
        pendingQuantity: 0,
        rejectedQuantity: 0,
        count: 0,
      };
      const qty = number(row.quantity);
      current.quantity += qty;
      current.count += 1;
      if (row.status === 'approved') current.approvedQuantity += qty;
      else if (row.status === 'rejected') current.rejectedQuantity += qty;
      else current.pendingQuantity += qty;
      batchIssues.set(materialId, current);
      materialIssuesByBatch.set(batchId, batchIssues);
    });

  const productionBatches: ProductionBatch[] = data.batches.map(row => ({
    id: row.id,
    dateLabel: row.started_date,
    product: productNames.get(row.product) || row.product,
    productId: row.product,
    plannedQty: row.planned_quantity,
    producedQty: row.delivered_to_warehouse,
    unit: 'pcs',
    employees: [...(employeesByBatch.get(String(row.id)) || [])],
    shift: row.status,
    orderId: row.batch_number,
    notes: row.note,
    materialIssueRuns: Math.max(0, ...[...(materialIssuesByBatch.get(String(row.id))?.values() || [])].map(issue => issue.count)),
    materialIssueCount: [...(materialIssuesByBatch.get(String(row.id))?.values() || [])].reduce((sum, issue) => sum + issue.count, 0),
    materialIssues: [...(materialIssuesByBatch.get(String(row.id))?.values() || [])],
    api: row as unknown as Record<string, unknown>,
  }));

  const materialMovements: StockMovement[] = data.materialTransactions.map((row, index) => ({
    id: index + 1,
    date: row.date,
    product: materialById.get(row.material)?.name || row.material,
    quantity: `${row.quantity} ${materialById.has(row.material) ? materialUnit(materialById.get(row.material)!.unit) : ''}`,
    supplier: row.transaction_type === 'in' ? row.note || '__incoming__' : undefined,
    client: row.transaction_type !== 'in' ? row.note || `__type__${row.transaction_type}` : undefined,
    employee: `__status__${row.status}`,
    type: row.transaction_type === 'in' ? 'in' : 'out',
    note: row.note || `__type__${row.transaction_type}`,
  }));
  const finishedMovements: StockMovement[] = data.finishedTransactions.map((row, index) => ({
    id: materialMovements.length + index + 1,
    date: row.date,
    product: productNames.get(row.product) || row.product,
    quantity: `${row.quantity} pcs`,
    supplier: row.transaction_type === 'in_production' || row.transaction_type === 'return_client' ? row.note || '__production__' : undefined,
    client: row.transaction_type === 'out_client' ? row.note || '__client__' : undefined,
    employee: `__status__${row.status}`,
    type: row.transaction_type === 'in_production' || row.transaction_type === 'return_client' ? 'in' : 'out',
    note: row.note || `__ftype__${row.transaction_type}`,
  }));
  const movementHistory = [...materialMovements, ...finishedMovements].sort((a, b) => b.date.localeCompare(a.date));

  const revenueEntries: FinanceEntry[] = data.payments.map((row, index) => ({
    id: index + 1,
    date: row.payment_date,
    client: clientNames.get(row.client) || row.client,
    order: `__method__${row.payment_method}`,
    amount: number(row.amount_uzs),
  }));
  const expenseEntries: FinanceEntry[] = data.expenses.map((row, index) => ({
    id: index + 1,
    date: row.date,
    category: row.category,
    description: row.note,
    amount: number(row.amount_uzs),
  }));

  const categoryAnalytics: CategoryDatum[] = categories.map((category, index) => ({
    name: category.name,
    value: products.length ? Math.round((products.filter(product => product.categoryId === category.id).length / products.length) * 100) : 0,
    color: ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9'][index % 5],
  }));

  const attendanceDates = [...new Set(data.attendance.map(row => row.work_date))].sort().slice(-5);
  const weekdayLocale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const staffFlow = attendanceDates.map(day => {
    const rows = data.attendance.filter(row => row.work_date === day);
    return {
      day: new Date(`${day}T00:00:00`).toLocaleDateString(weekdayLocale, { weekday: 'short' }),
      came: rows.filter(row => row.first_check_in_at).length,
      late: rows.filter(row => row.status === 'late').length,
      left: rows.filter(row => row.last_check_out_at).length,
    };
  });

  const operationTypeOptions = data.operationTypes.map(row => ({ id: row.id, name: row.name }));

  return { clients, staff, products, categories, orders, materials, stockIn: movementHistory.filter(row => row.type === 'in'), stockOut: movementHistory.filter(row => row.type === 'out'), movementHistory, revenueEntries, expenseEntries, productionRecords, pieceworkRecords, productionBatches, categoryAnalytics, staffFlow, operationTypeOptions };
}
