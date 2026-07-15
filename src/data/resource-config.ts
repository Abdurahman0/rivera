import { resources } from '../api/client';
import type { ResourceConfig, ResourceOption } from '../components/ApiResourceManager';

const options = (values: Array<[string, string]>): ResourceOption[] => values.map(([value, label]) => ({ value, label }));
const statusField = {
  name: 'status' as const, label: 'admin.fields.status' as const, readOnly: true as const, table: true as const,
  options: options([
    ['draft', 'admin.options.transactionStatus.draft'], ['pending_approval', 'admin.options.transactionStatus.pending_approval'],
    ['approved', 'admin.options.transactionStatus.approved'], ['rejected', 'admin.options.transactionStatus.rejected'],
  ]),
};
const f = (key: string) => `admin.fields.${key}`;
const r = (key: 'title' | 'description') => (resourceKey: string) => `admin.resources.${resourceKey}.${key}`;
const title = r('title');
const description = r('description');

// Piecework norms are a single rate viewed at four scales. The workday is 8 hours
// (480 min — matches the backend payroll's minutes-per-day divisor) and a month is
// 26 working days (same constant the payroll UI uses).
const WORKDAY_MINUTES = 480;
const WORKING_DAYS_PER_MONTH = 26;
const roundNorm = (value: number) => String(Math.round(value * 100) / 100);

function deriveNormsFromMinutes(minutesPerPiece: number): Record<string, string> {
  if (!Number.isFinite(minutesPerPiece) || minutesPerPiece <= 0) return {};
  const daily = WORKDAY_MINUTES / minutesPerPiece;
  return { hourly_norm: roundNorm(60 / minutesPerPiece), daily_norm: roundNorm(daily), monthly_norm: roundNorm(daily * WORKING_DAYS_PER_MONTH) };
}

function deriveNormsFromHourly(piecesPerHour: number): Record<string, string> {
  if (!Number.isFinite(piecesPerHour) || piecesPerHour <= 0) return {};
  const daily = piecesPerHour * (WORKDAY_MINUTES / 60);
  return { time_norm_minutes: roundNorm(60 / piecesPerHour), daily_norm: roundNorm(daily), monthly_norm: roundNorm(daily * WORKING_DAYS_PER_MONTH) };
}

// Audit rows arrive with raw backend identifiers (page keys, action slugs, model
// class names); these enumerations map every value the backend can emit onto a
// locale key so the log reads as plain language.
const enumOptions = (domain: string, values: string[]): ResourceOption[] => values.map(value => ({ value, label: `admin.options.${domain}.${value}` }));
const AUDIT_PAGES = ['dashboard', 'clients', 'products', 'materials', 'inventory', 'production', 'employees', 'attendance', 'payroll', 'finance', 'approvals', 'audit', 'users'];
const AUDIT_ACTIONS = [
  'create', 'update', 'archive', 'restore', 'approve', 'reject', 'approve_payroll', 'mark_payroll_paid', 'unlock_payroll',
  'create_pending_material_purchase', 'create_pending_client_delivery', 'create_pending_client_return', 'create_pending_client_debt_adjustment',
  'create_pending_material_transaction', 'create_pending_defective_material_transaction', 'create_pending_finished_goods_transaction',
  'create_pending_cash_transaction', 'create_pending_expense', 'create_pending_leave_request',
];
const AUDIT_OBJECTS = [
  'User', 'UserPagePermission', 'ApprovalRequest', 'AuditLog',
  'Client', 'ClientOrder', 'ClientOrderItem', 'ClientDelivery', 'ClientPayment', 'ClientReturn', 'ClientDebtAdjustment',
  'Material', 'MaterialStock', 'MaterialTransaction', 'DefectiveMaterialStock', 'DefectiveMaterialTransaction', 'Supplier',
  'Product', 'ProductCategory', 'ProductMaterialNorm', 'FinishedGoodsStock', 'FinishedGoodsTransaction', 'WarehouseLocation',
  'ProductionBatch', 'ProductionBatchItem', 'ProductionMaterialUsage',
  'Employee', 'Department', 'EmployeeTermination', 'EmployeeFaceEncoding', 'WorkSchedule', 'LeaveRequest',
  'AttendanceDevice', 'AttendanceEvent', 'AttendanceRecord',
  'OperationType', 'DailyWorkEntry', 'MonthlyPayroll', 'SalaryAdjustment',
  'Expense', 'CashAccount', 'CashTransaction',
];

export const operationsConfigs: Record<string, ResourceConfig> = {
  clientOrders: {
    resource: resources.clientOrders, title: title('clientOrders'), description: description('clientOrders'),
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name', secondary: 'phone' }, required: true },
      { name: 'order_number', label: f('orderNumber'), required: true, table: true },
      { name: 'order_date', label: f('orderDate'), type: 'date', required: true, table: true },
      { name: 'due_date', label: f('dueDate'), type: 'date', nullable: true, table: true },
      { name: 'total_amount_uzs', label: f('totalAmount'), type: 'money', readOnly: true, table: true },
      { name: 'status', label: f('status'), type: 'select', required: true, table: true, options: options([['draft', 'admin.options.orderStatus.draft'], ['confirmed', 'admin.options.orderStatus.confirmed'], ['completed', 'admin.options.orderStatus.completed'], ['cancelled', 'admin.options.orderStatus.cancelled']]) },
      { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  deliveries: {
    resource: resources.clientDeliveries, title: title('deliveries'), description: description('deliveries'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name', secondary: 'phone' }, required: true, table: true },
      { name: 'order', label: f('order'), lookup: { resource: resources.clientOrders, label: 'order_number', secondary: 'order_date' }, nullable: true, table: true },
      { name: 'product', label: f('product'), lookup: { resource: resources.products, label: 'name', secondary: 'code' }, required: true, table: true },
      { name: 'size', label: f('size') }, { name: 'color', label: f('color') }, { name: 'quantity', label: f('quantity'), type: 'number', required: true, table: true },
      { name: 'unit_price', label: f('unitPrice'), type: 'number', step: '0.01', required: true }, { name: 'delivery_date', label: f('deliveryDate'), type: 'date', required: true, table: true },
      { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  payments: {
    resource: resources.clientPayments, title: title('payments'), description: description('payments'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name', secondary: 'phone' }, required: true, table: true },
      { name: 'order', label: f('order'), lookup: { resource: resources.clientOrders, label: 'order_number', secondary: 'order_date' }, nullable: true, table: true },
      { name: 'payment_method', label: f('method'), type: 'select', required: true, table: true, options: options([['cash', 'admin.options.paymentMethod.cash'], ['card', 'admin.options.paymentMethod.card'], ['bank_transfer', 'admin.options.paymentMethod.bank_transfer']]) },
      { name: 'amount', label: f('amount'), type: 'number', step: '0.01', required: true, table: true }, { name: 'amount_uzs', label: f('amountUzs'), readOnly: true },
      { name: 'payment_date', label: f('paymentDate'), type: 'date', required: true, table: true }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  returns: {
    resource: resources.clientReturns, title: title('returns'), description: description('returns'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name' }, required: true, table: true },
      { name: 'order', label: f('order'), lookup: { resource: resources.clientOrders, label: 'order_number', secondary: 'order_date' }, nullable: true, table: true },
      { name: 'product', label: f('product'), lookup: { resource: resources.products, label: 'name', secondary: 'code' }, required: true, table: true },
      { name: 'size', label: f('size') }, { name: 'color', label: f('color') }, { name: 'quantity', label: f('quantity'), type: 'number', required: true, table: true },
      { name: 'unit_price', label: f('unitPrice'), type: 'number', step: '0.01', required: true },
      { name: 'return_date', label: f('returnDate'), type: 'date', required: true, table: true },
      { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  orderItems: {
    resource: resources.clientOrderItems, title: title('orderItems'), description: description('orderItems'),
    fields: [
      {
        name: 'product', label: f('product'), required: true, table: true,
        lookup: {
          resource: resources.products, label: 'name', secondary: 'code',
          // Auto-fills the product's own colour into the item row; the price is derived
          // from the product on the backend, so it isn't asked for here.
          autofill: row => ({ color: String(row.color ?? '') }),
        },
      },
      { name: 'size', label: f('size'), table: true }, { name: 'color', label: f('color'), table: true }, { name: 'quantity', label: f('quantity'), type: 'number', required: true, table: true },
      { name: 'unit_price', label: f('unitPrice'), type: 'money', readOnly: true, table: true }, { name: 'total_amount', label: f('totalAmount'), type: 'money', readOnly: true, table: true },
      { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  materialStocks: {
    resource: resources.materialStocks, title: title('materialStocks'), description: description('materialStocks'), readOnly: true,
    fields: [{ name: 'material', label: f('material'), lookup: { resource: resources.materials, label: 'name', secondary: 'code' }, table: true }, { name: 'quantity', label: f('quantity'), table: true }, { name: 'total_value', label: f('totalValue'), table: true }],
  },
  defectiveStocks: {
    resource: resources.defectiveMaterialStocks, title: title('defectiveStocks'), description: description('defectiveStocks'), readOnly: true,
    fields: [{ name: 'material', label: f('material'), lookup: { resource: resources.materials, label: 'name' }, table: true }, { name: 'quantity', label: f('quantity'), table: true }, { name: 'note', label: f('note'), table: true }],
  },
  defectiveTransactions: {
    resource: resources.defectiveMaterialTransactions, title: title('defectiveTransactions'), description: description('defectiveTransactions'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'material', label: f('material'), lookup: { resource: resources.materials, label: 'name' }, required: true, table: true }, { name: 'quantity', label: f('quantity'), type: 'number', step: '0.0001', required: true, table: true },
      { name: 'date', label: f('date'), type: 'date', required: true, table: true },
      { ...statusField }, { name: 'note', label: f('note'), type: 'textarea', table: true },
    ],
  },
  materialUsages: {
    resource: resources.productionMaterialUsages, title: title('materialUsages'), description: description('materialUsages'),
    fields: [
      { name: 'batch', label: f('batch'), lookup: { resource: resources.productionBatches, label: 'batch_number' }, required: true, table: true }, { name: 'material', label: f('material'), lookup: { resource: resources.materials, label: 'name' }, required: true, table: true },
      { name: 'norm_quantity', label: f('normQuantity'), type: 'number', step: '0.0001', required: true, table: true }, { name: 'defect_quantity', label: f('defect'), type: 'number', step: '0.0001' }, { name: 'actual_delivered', label: f('actualDelivered'), type: 'number', step: '0.0001', table: true },
      { name: 'delivered_date', label: f('deliveredDate'), type: 'date', nullable: true }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  operationTypes: {
    resource: resources.operationTypes, title: title('operationTypes'), description: description('operationTypes'),
    fields: [
      { name: 'name', label: f('name'), required: true, table: true },
      // The four norms are one fact expressed four ways (8h day, 26 working days/month):
      // typing the per-piece time or the hourly norm auto-fills the rest; the filled
      // values stay editable, so the user can still fine-tune any of them by hand.
      { name: 'time_norm_minutes', label: f('timeNormMinutes'), type: 'number', step: '0.01', nullable: true, table: true, derive: value => deriveNormsFromMinutes(Number(value)) },
      { name: 'hourly_norm', label: f('hourlyNorm'), type: 'number', step: '0.01', nullable: true, table: true, derive: value => deriveNormsFromHourly(Number(value)) },
      { name: 'daily_norm', label: f('dailyNorm'), type: 'number', step: '0.01', nullable: true }, { name: 'monthly_norm', label: f('monthlyNorm'), type: 'number', step: '0.01', nullable: true },
      { name: 'price_per_unit', label: f('pricePerUnit'), type: 'number', step: '0.01', required: true, table: true },
    ],
  },
  workEntries: {
    resource: resources.dailyWorkEntries, title: title('workEntries'), description: description('workEntries'),
    fields: [
      { name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name' }, required: true, table: true }, { name: 'operation_type', label: f('operation'), lookup: { resource: resources.operationTypes, label: 'name' }, required: true, table: true },
      { name: 'date', label: f('date'), type: 'date', required: true, table: true }, { name: 'quantity_done', label: f('quantity'), type: 'number', required: true, table: true }, { name: 'amount', label: f('amount'), readOnly: true, table: true },
      { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  expenses: {
    resource: resources.expenses, title: title('expenses'), description: description('expenses'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'category', label: f('category'), required: true, table: true }, { name: 'amount', label: f('amount'), type: 'money', step: '0.01', required: true, table: true },
      { name: 'date', label: f('date'), type: 'date', required: true, table: true }, { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  schedules: {
    resource: resources.workSchedules, title: title('schedules'), description: description('schedules'),
    fields: [
      { name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name', secondary: 'employee_code' }, required: true, table: true }, { name: 'name', label: f('name'), required: true },
      { name: 'start_time', label: f('start'), type: 'time', required: true, table: true }, { name: 'end_time', label: f('end'), type: 'time', required: true, table: true }, { name: 'lunch_start', label: f('lunchStart'), type: 'time', nullable: true }, { name: 'lunch_end', label: f('lunchEnd'), type: 'time', nullable: true },
      { name: 'late_after_minutes', label: f('lateAfterMinutes'), type: 'number', required: true }, { name: 'effective_from', label: f('effectiveFrom'), type: 'date', required: true }, { name: 'effective_to', label: f('effectiveTo'), type: 'date', nullable: true }, { name: 'is_active', label: f('active'), type: 'checkbox', table: true },
    ],
  },
};

export const systemConfigs: Record<string, ResourceConfig> = {
  users: {
    resource: resources.users, title: title('users'), description: description('users'),
    fields: [{ name: 'username', label: f('username'), required: true, table: true }, { name: 'full_name', label: f('fullName'), required: true, table: true }, { name: 'phone', label: f('phone') }, { name: 'email', label: f('email'), type: 'text', table: true }, { name: 'is_active', label: f('active'), type: 'checkbox', table: true }, { name: 'is_superadmin', label: f('superadmin'), type: 'checkbox', table: true }, { name: 'password', label: f('password'), type: 'password' }],
  },
  devices: {
    resource: resources.attendanceDevices, title: title('devices'), description: description('devices'),
    fields: [{ name: 'name', label: f('name'), required: true, table: true }, { name: 'token', label: f('deviceToken'), required: true, table: true }, { name: 'is_active', label: f('active'), type: 'checkbox', table: true }, { name: 'last_seen_at', label: f('lastSeen'), type: 'datetime-local', readOnly: true, table: true }],
  },
  audit: {
    resource: resources.auditLogs, title: title('audit'), description: description('audit'), readOnly: true,
    fields: [
      { name: 'created_at', label: f('time'), type: 'datetime-local', table: true }, { name: 'user', label: f('user'), lookup: { resource: resources.users, label: 'username' }, table: true },
      { name: 'page', label: f('page'), options: enumOptions('page', AUDIT_PAGES), table: true }, { name: 'action', label: f('action'), options: enumOptions('auditAction', AUDIT_ACTIONS), table: true },
      { name: 'object_type', label: f('objectType'), options: enumOptions('auditObject', AUDIT_OBJECTS), table: true }, { name: 'object_label', label: f('object'), table: true },
      { name: 'description', label: f('description') },
    ],
  },
};
