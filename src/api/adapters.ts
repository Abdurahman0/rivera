import type {
  ApiAttendanceRecord,
  ApiClient,
  ApiClientDelivery,
  ApiClientOrder,
  ApiClientOrderItem,
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
import { categoryColor, loadCategoryColors } from '../utils/categoryColors';
import type {
  AttendanceLogEntry,
  CategoryDatum,
  Client,
  FinanceEntry,
  FinishedVariant,
  Material,
  Order,
  PieceworkRecord,
  Product,
  ProductCategory,
  ProductionBatch,
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
  orderItems: ApiClientOrderItem[];
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
  revenueEntries: FinanceEntry[];
  expenseEntries: FinanceEntry[];
  pieceworkRecords: PieceworkRecord[];
  productionBatches: ProductionBatch[];
  categoryAnalytics: CategoryDatum[];
  attendanceLog: AttendanceLogEntry[];
  operationTypeOptions: Array<{ id: string; name: string }>;
  finishedVariants: FinishedVariant[];
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

  const legacyCategoryColors = loadCategoryColors();
  const categories: ProductCategory[] = data.categories.map((row, index) => ({
    id: row.id,
    name: row.name,
    code: row.name.slice(0, 3).toUpperCase(),
    description: '',
    sortOrder: index + 1,
    color: row.color || categoryColor(String(row.id), index, legacyCategoryColors),
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

  // Per-order, per-product piece counts: what the order asked for (its items) vs what
  // actually went out against it (approved deliveries linked to the order).
  const orderedByOrder = new Map<string, Map<string, number>>();
  data.orderItems.forEach(item => {
    const perProduct = orderedByOrder.get(item.order) ?? new Map<string, number>();
    perProduct.set(item.product, (perProduct.get(item.product) || 0) + number(item.quantity));
    orderedByOrder.set(item.order, perProduct);
  });
  const deliveredByOrder = new Map<string, Map<string, number>>();
  data.deliveries.filter(row => row.status === 'approved' && row.order).forEach(row => {
    const perProduct = deliveredByOrder.get(String(row.order)) ?? new Map<string, number>();
    perProduct.set(row.product, (perProduct.get(row.product) || 0) + number(row.quantity));
    deliveredByOrder.set(String(row.order), perProduct);
  });

  const orders: Order[] = data.clientOrders.map(row => {
    const ordered = orderedByOrder.get(String(row.id)) ?? new Map<string, number>();
    const delivered = deliveredByOrder.get(String(row.id)) ?? new Map<string, number>();
    const items = [...new Set([...ordered.keys(), ...delivered.keys()])].map(productId => ({
      productName: productNames.get(productId) || '—',
      ordered: ordered.get(productId) || 0,
      delivered: delivered.get(productId) || 0,
    })).sort((a, b) => b.ordered - a.ordered);
    return {
      id: row.id,
      orderId: row.order_number,
      client: clientNames.get(row.client) || '__deleted__',
      orderDate: row.order_date,
      dueDate: row.due_date || '—',
      totalAmount: number(row.total_amount_uzs),
      status: row.status,
      statusKey: row.status,
      notes: row.note,
      clientId: row.client,
      orderedQty: items.reduce((sum, item) => sum + item.ordered, 0),
      deliveredQty: items.reduce((sum, item) => sum + item.delivered, 0),
      items,
      api: row as unknown as Record<string, unknown>,
    };
  });

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
    quantity: row.quantity_done,
    ratePerPiece: row.quantity_done ? number(row.amount) / row.quantity_done : 0,
    unit: 'pcs',
    week: row.date,
  }));


  // Actual material consumed per batch: approved out_production transactions only
  // (materials auto-consume when a warehouse delivery is approved).
  const materialIssuesByBatch = new Map<string, Map<string, {
    materialId: string;
    materialName: string;
    unit: Material['unit'];
    quantity: number;
  }>>();
  data.materialTransactions
    .filter(row => row.transaction_type === 'out_production' && row.related_production_batch && row.status === 'approved')
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
      };
      current.quantity += number(row.quantity);
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
    shift: row.status,
    orderId: row.batch_number,
    notes: row.note,
    materialIssues: [...(materialIssuesByBatch.get(String(row.id))?.values() || [])],
    api: row as unknown as Record<string, unknown>,
  }));

  const materialMovements: StockMovement[] = data.materialTransactions.map((row, index) => ({
    id: index + 1,
    date: row.date,
    product: materialById.get(row.material)?.name || '__deleted__',
    quantity: `${row.quantity} ${materialById.has(row.material) ? materialUnit(materialById.get(row.material)!.unit) : ''}`,
    supplier: row.transaction_type === 'in' ? row.note || '__incoming__' : undefined,
    client: row.transaction_type !== 'in' ? row.note || `__type__${row.transaction_type}` : undefined,
    employee: `__status__${row.status}`,
    type: row.transaction_type === 'in' ? 'in' : 'out',
    note: row.note || `__type__${row.transaction_type}`,
    sourceKind: 'material' as const,
    txType: row.transaction_type,
    status: row.status,
  }));
  const finishedMovements: StockMovement[] = data.finishedTransactions.map((row, index) => ({
    id: materialMovements.length + index + 1,
    date: row.date,
    product: productNames.get(row.product) || '__deleted__',
    quantity: `${row.quantity} pcs`,
    supplier: row.transaction_type === 'in_production' || row.transaction_type === 'return_client' ? row.note || '__production__' : undefined,
    client: row.transaction_type === 'out_client' ? row.note || '__client__' : undefined,
    employee: `__status__${row.status}`,
    type: row.transaction_type === 'in_production' || row.transaction_type === 'return_client' ? 'in' : 'out',
    note: row.note || `__ftype__${row.transaction_type}`,
    sourceKind: 'finished' as const,
    txType: row.transaction_type,
    status: row.status,
  }));
  const movementHistory = [...materialMovements, ...finishedMovements].sort((a, b) => b.date.localeCompare(a.date));

  const finishedVariants: FinishedVariant[] = data.finishedStocks.map(row => ({
    productId: row.product,
    size: row.size,
    color: row.color,
    quantity: row.quantity,
  }));

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

  const categoryAnalytics: CategoryDatum[] = categories.map(category => ({
    name: category.name,
    value: products.length ? Math.round((products.filter(product => product.categoryId === category.id).length / products.length) * 100) : 0,
    color: category.color,
  }));

  const attendanceLog: AttendanceLogEntry[] = data.attendance.map(row => ({
    id: row.id,
    employeeId: row.employee,
    workDate: row.work_date,
    checkIn: row.first_check_in_at,
    checkOut: row.last_check_out_at,
    workedMinutes: row.worked_minutes,
  }));

  const operationTypeOptions = data.operationTypes.map(row => ({ id: row.id, name: row.name }));

  return { clients, staff, products, categories, orders, materials, stockIn: movementHistory.filter(row => row.type === 'in'), stockOut: movementHistory.filter(row => row.type === 'out'), revenueEntries, expenseEntries, pieceworkRecords, productionBatches, categoryAnalytics, attendanceLog, operationTypeOptions, finishedVariants };
}
