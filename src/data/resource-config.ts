import { resources } from '../api/client';
import type { ResourceConfig, ResourceOption } from '../components/ApiResourceManager';

const options = (values: Array<[string, string]>): ResourceOption[] => values.map(([value, label]) => ({ value, label }));
const currency = options([['UZS', 'UZS'], ['USD', 'USD']]);
const statusField = { name: 'status', label: 'admin.fields.status', readOnly: true, table: true } as const;
const f = (key: string) => `admin.fields.${key}`;
const r = (key: 'title' | 'description') => (resourceKey: string) => `admin.resources.${resourceKey}.${key}`;
const title = r('title');
const description = r('description');

export const operationsConfigs: Record<string, ResourceConfig> = {
  deliveries: {
    resource: resources.clientDeliveries, title: title('deliveries'), description: description('deliveries'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name', secondary: 'phone' }, required: true, table: true },
      { name: 'product', label: f('product'), lookup: { resource: resources.products, label: 'name', secondary: 'code' }, required: true, table: true },
      { name: 'size', label: f('size') }, { name: 'color', label: f('color') }, { name: 'quantity', label: f('quantity'), type: 'number', required: true, table: true },
      { name: 'unit_price', label: f('unitPrice'), type: 'number', step: '0.01', required: true }, { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true },
      { name: 'exchange_rate', label: f('exchangeRate'), type: 'number', step: '0.0001', nullable: true }, { name: 'delivery_date', label: f('deliveryDate'), type: 'date', required: true, table: true },
      { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  payments: {
    resource: resources.clientPayments, title: title('payments'), description: description('payments'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name', secondary: 'phone' }, required: true, table: true },
      { name: 'payment_method', label: f('method'), type: 'select', required: true, table: true, options: options([['cash', 'admin.options.paymentMethod.cash'], ['card', 'admin.options.paymentMethod.card'], ['bank_transfer', 'admin.options.paymentMethod.bank_transfer'], ['usd_cash', 'admin.options.paymentMethod.usd_cash']]) },
      { name: 'amount', label: f('amount'), type: 'number', step: '0.01', required: true, table: true }, { name: 'amount_uzs', label: f('amountUzs'), readOnly: true },
      { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true }, { name: 'exchange_rate', label: f('exchangeRate'), type: 'number', step: '0.0001', nullable: true },
      { name: 'payment_date', label: f('paymentDate'), type: 'date', required: true, table: true }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  returns: {
    resource: resources.clientReturns, title: title('returns'), description: description('returns'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name' }, required: true, table: true },
      { name: 'product', label: f('product'), lookup: { resource: resources.products, label: 'name', secondary: 'code' }, required: true, table: true },
      { name: 'size', label: f('size') }, { name: 'color', label: f('color') }, { name: 'quantity', label: f('quantity'), type: 'number', required: true, table: true },
      { name: 'unit_price', label: f('unitPrice'), type: 'number', step: '0.01', required: true }, { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true },
      { name: 'exchange_rate', label: f('exchangeRate'), type: 'number', step: '0.0001', nullable: true }, { name: 'return_date', label: f('returnDate'), type: 'date', required: true, table: true },
      { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  debts: {
    resource: resources.clientDebtAdjustments, title: title('debts'), description: description('debts'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name' }, required: true, table: true },
      { name: 'amount', label: f('amount'), type: 'number', step: '0.01', required: true, table: true }, { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true },
      { name: 'exchange_rate', label: f('exchangeRate'), type: 'number', step: '0.0001', nullable: true }, { name: 'reason', label: f('reason'), type: 'textarea', required: true, table: true },
      { name: 'date', label: f('date'), type: 'date', required: true, table: true }, { ...statusField },
    ],
  },
  suppliers: {
    resource: resources.suppliers, title: title('suppliers'), description: description('suppliers'),
    fields: [{ name: 'name', label: f('name'), required: true, table: true }, { name: 'phone', label: f('phone'), table: true }, { name: 'address', label: f('address'), type: 'textarea' }, { name: 'note', label: f('note'), type: 'textarea' }],
  },
  materialPurchases: {
    resource: resources.materialPurchases, title: title('materialPurchases'), description: description('materialPurchases'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'supplier', label: f('supplier'), lookup: { resource: resources.suppliers, label: 'name' }, required: true, table: true },
      { name: 'material', label: f('material'), lookup: { resource: resources.materials, label: 'name', secondary: 'code' }, required: true, table: true },
      { name: 'quantity', label: f('quantity'), type: 'number', step: '0.0001', required: true, table: true }, { name: 'unit_price', label: f('unitPrice'), type: 'number', step: '0.01', required: true },
      { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true }, { name: 'exchange_rate', label: f('exchangeRate'), type: 'number', step: '0.0001', nullable: true },
      { name: 'purchase_date', label: f('purchaseDate'), type: 'date', required: true, table: true }, { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  warehouseLocations: {
    resource: resources.warehouseLocations, title: title('warehouseLocations'), description: description('warehouseLocations'),
    fields: [{ name: 'name', label: f('name'), required: true, table: true }, { name: 'code', label: f('code'), table: true }, { name: 'note', label: f('note'), type: 'textarea' }],
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
      { name: 'date', label: f('date'), type: 'date', required: true, table: true }, { name: 'source_transaction', label: f('sourceTransaction'), lookup: { resource: resources.materialTransactions, label: 'date', secondary: 'transaction_type' }, nullable: true },
      { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  finishedStocks: {
    resource: resources.finishedGoodsStocks, title: title('finishedStocks'), description: description('finishedStocks'), readOnly: true,
    fields: [{ name: 'product', label: f('product'), lookup: { resource: resources.products, label: 'name', secondary: 'code' }, table: true }, { name: 'size', label: f('size'), table: true }, { name: 'color', label: f('color'), table: true }, { name: 'quantity', label: f('quantity'), table: true }],
  },
  finishedTransactions: {
    resource: resources.finishedGoodsTransactions, title: title('finishedTransactions'), description: description('finishedTransactions'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'product', label: f('product'), lookup: { resource: resources.products, label: 'name' }, required: true, table: true }, { name: 'size', label: f('size') }, { name: 'color', label: f('color') },
      { name: 'transaction_type', label: f('type'), type: 'select', required: true, table: true, options: options([['in_production', 'admin.options.finishedTxType.in_production'], ['out_client', 'admin.options.finishedTxType.out_client'], ['out_defect', 'admin.options.finishedTxType.out_defect'], ['return_client', 'admin.options.finishedTxType.return_client']]) },
      { name: 'quantity', label: f('quantity'), type: 'number', required: true, table: true }, { name: 'date', label: f('date'), type: 'date', required: true, table: true },
      { name: 'related_batch', label: f('batch'), lookup: { resource: resources.productionBatches, label: 'batch_number' }, nullable: true },
      { name: 'related_client_delivery', label: f('delivered'), lookup: { resource: resources.clientDeliveries, label: 'delivery_date', secondary: 'quantity' }, nullable: true }, { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  batchItems: {
    resource: resources.productionBatchItems, title: title('batchItems'), description: description('batchItems'),
    fields: [{ name: 'batch', label: f('batch'), lookup: { resource: resources.productionBatches, label: 'batch_number' }, required: true, table: true }, { name: 'size', label: f('size'), table: true }, { name: 'color', label: f('color'), table: true }, { name: 'planned_quantity', label: f('planned'), type: 'number', required: true, table: true }, { name: 'delivered_quantity', label: f('delivered'), type: 'number', required: true, table: true }],
  },
  materialUsages: {
    resource: resources.productionMaterialUsages, title: title('materialUsages'), description: description('materialUsages'),
    fields: [
      { name: 'batch', label: f('batch'), lookup: { resource: resources.productionBatches, label: 'batch_number' }, required: true, table: true }, { name: 'material', label: f('material'), lookup: { resource: resources.materials, label: 'name' }, required: true, table: true },
      { name: 'norm_quantity', label: f('normQuantity'), type: 'number', step: '0.0001', required: true, table: true }, { name: 'defect_quantity', label: f('defect'), type: 'number', step: '0.0001' }, { name: 'actual_delivered', label: f('actualDelivered'), type: 'number', step: '0.0001', table: true },
      { name: 'delivered_date', label: f('deliveredDate'), type: 'date', nullable: true }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  departments: {
    resource: resources.departments, title: title('departments'), description: description('departments'),
    fields: [{ name: 'name', label: f('name'), required: true, table: true }, { name: 'note', label: f('note'), type: 'textarea' }],
  },
  employeeTerminations: {
    resource: resources.employeeTerminations, title: title('employeeTerminations'), description: description('employeeTerminations'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name', secondary: 'employee_code' }, required: true, table: true },
      { name: 'termination_date', label: f('terminationDate'), type: 'date', required: true, table: true }, { name: 'reason', label: f('reason'), type: 'textarea', required: true, table: true },
    ],
  },
  leaveRequests: {
    resource: resources.leaveRequests, title: title('leaveRequests'), description: description('leaveRequests'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name', secondary: 'employee_code' }, required: true, table: true },
      { name: 'start_date', label: f('startDate'), type: 'date', required: true, table: true }, { name: 'end_date', label: f('endDate'), type: 'date', required: true, table: true },
      { name: 'reason', label: f('reason'), type: 'textarea', required: true, table: true }, { ...statusField },
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
  devices: {
    resource: resources.attendanceDevices, title: title('devices'), description: description('devices'),
    fields: [{ name: 'name', label: f('name'), required: true, table: true }, { name: 'token', label: f('deviceToken'), required: true, table: true }, { name: 'is_active', label: f('active'), type: 'checkbox', table: true }, { name: 'last_seen_at', label: f('lastSeen'), readOnly: true, table: true }],
  },
  attendanceEvents: {
    resource: resources.attendanceEvents, title: title('attendanceEvents'), description: description('attendanceEvents'), readOnly: true,
    fields: [
      { name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name' }, table: true },
      { name: 'event_type', label: f('type'), table: true, options: options([['check_in', 'admin.options.eventType.check_in'], ['check_out', 'admin.options.eventType.check_out']]) },
      { name: 'event_at', label: f('time'), table: true }, { name: 'device', label: f('device'), lookup: { resource: resources.attendanceDevices, label: 'name' }, table: true }, { name: 'confidence', label: f('confidence'), table: true },
    ],
  },
  attendanceRecords: {
    resource: resources.attendanceRecords, title: title('attendanceRecords'), description: description('attendanceRecords'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name', secondary: 'employee_code' }, required: true, table: true }, { name: 'work_date', label: f('workDate'), type: 'date', required: true, table: true },
      { name: 'first_check_in_at', label: f('firstCheckIn'), type: 'datetime-local', nullable: true }, { name: 'last_check_out_at', label: f('lastCheckOut'), type: 'datetime-local', nullable: true }, { name: 'worked_minutes', label: f('workedMinutes'), readOnly: true, table: true },
      { name: 'status', label: f('status'), type: 'select', required: true, table: true, options: options([['present', 'admin.options.attendanceStatus.present'], ['late', 'admin.options.attendanceStatus.late'], ['absent_excused', 'admin.options.attendanceStatus.absent_excused'], ['absent_unexcused', 'admin.options.attendanceStatus.absent_unexcused']]) }, { name: 'is_manual', label: f('manual'), type: 'checkbox' }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  operationTypes: {
    resource: resources.operationTypes, title: title('operationTypes'), description: description('operationTypes'),
    fields: [
      { name: 'name', label: f('name'), required: true, table: true }, { name: 'sequence_order', label: f('sequence'), type: 'number', nullable: true }, { name: 'time_norm_minutes', label: f('timeNormMinutes'), type: 'number', step: '0.01', nullable: true },
      { name: 'hourly_norm', label: f('hourlyNorm'), type: 'number', step: '0.01', nullable: true }, { name: 'daily_norm', label: f('dailyNorm'), type: 'number', step: '0.01', nullable: true }, { name: 'monthly_norm', label: f('monthlyNorm'), type: 'number', step: '0.01', nullable: true },
      { name: 'price_per_unit', label: f('pricePerUnit'), type: 'number', step: '0.01', required: true, table: true },
    ],
  },
  workEntries: {
    resource: resources.dailyWorkEntries, title: title('workEntries'), description: description('workEntries'),
    fields: [
      { name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name' }, required: true, table: true }, { name: 'operation_type', label: f('operation'), lookup: { resource: resources.operationTypes, label: 'name' }, required: true, table: true },
      { name: 'date', label: f('date'), type: 'date', required: true, table: true }, { name: 'quantity_done', label: f('quantity'), type: 'number', required: true, table: true }, { name: 'amount', label: f('amount'), readOnly: true, table: true },
      { name: 'related_batch', label: f('batch'), lookup: { resource: resources.productionBatches, label: 'batch_number' }, nullable: true }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  workHourBreakdowns: {
    resource: resources.dailyWorkHourBreakdowns, title: title('workHourBreakdowns'), description: description('workHourBreakdowns'),
    fields: [
      { name: 'entry', label: f('workEntry'), lookup: { resource: resources.dailyWorkEntries, label: 'date', secondary: 'quantity_done' }, required: true, table: true },
      { name: 'hour_label', label: f('hourLabel'), required: true, table: true }, { name: 'quantity', label: f('quantity'), type: 'number', required: true, table: true },
    ],
  },
  adjustments: {
    resource: resources.salaryAdjustments, title: title('adjustments'), description: description('adjustments'),
    fields: [{ name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name' }, required: true, table: true }, { name: 'month', label: f('month'), type: 'date', required: true, table: true }, { name: 'adjustment_type', label: f('type'), type: 'select', required: true, table: true, options: options([['bonus', 'admin.options.adjustmentType.bonus'], ['penalty', 'admin.options.adjustmentType.penalty']]) }, { name: 'amount', label: f('amount'), type: 'number', step: '0.01', required: true, table: true }, { name: 'reason', label: f('reason'), type: 'textarea', required: true }],
  },
  payrolls: {
    resource: resources.monthlyPayrolls, title: title('payrolls'), description: description('payrolls'), readOnly: true,
    fields: [{ name: 'employee', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name' }, table: true }, { name: 'month', label: f('month'), table: true }, { name: 'salary_type', label: f('salaryType'), table: true }, { name: 'final_amount', label: f('finalAmount'), table: true }, { name: 'status', label: f('status'), table: true }],
  },
  cashAccounts: {
    resource: resources.cashAccounts, title: title('cashAccounts'), description: description('cashAccounts'),
    fields: [
      { name: 'name', label: f('name'), required: true, table: true }, { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true, table: true },
      { name: 'balance', label: f('balance'), readOnly: true, table: true }, { name: 'is_active', label: f('active'), type: 'checkbox', table: true },
    ],
  },
  cashTransactions: {
    resource: resources.cashTransactions, title: title('cashTransactions'), description: description('cashTransactions'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'account', label: f('cashAccount'), lookup: { resource: resources.cashAccounts, label: 'name' }, required: true, table: true },
      { name: 'transaction_type', label: f('type'), type: 'select', required: true, table: true, options: options([['in', 'admin.options.cashTxType.in'], ['out', 'admin.options.cashTxType.out']]) },
      { name: 'amount', label: f('amount'), type: 'number', step: '0.01', required: true, table: true }, { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true },
      { name: 'exchange_rate', label: f('exchangeRate'), type: 'number', step: '0.0001', nullable: true }, { name: 'date', label: f('date'), type: 'date', required: true, table: true },
      { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  expenses: {
    resource: resources.expenses, title: title('expenses'), description: description('expenses'), allowEdit: false, allowArchive: false,
    fields: [
      { name: 'category', label: f('category'), required: true, table: true }, { name: 'amount', label: f('amount'), type: 'number', step: '0.01', required: true, table: true },
      { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true }, { name: 'exchange_rate', label: f('exchangeRate'), type: 'number', step: '0.0001', nullable: true },
      { name: 'date', label: f('date'), type: 'date', required: true, table: true }, { ...statusField }, { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
  invoices: {
    resource: resources.invoices, title: title('invoices'), description: description('invoices'),
    fields: [
      { name: 'client', label: f('client'), lookup: { resource: resources.clients, label: 'full_name' }, nullable: true, table: true },
      { name: 'invoice_number', label: f('invoiceNumber'), required: true, table: true }, { name: 'date', label: f('date'), type: 'date', required: true, table: true },
      { name: 'due_date', label: f('dueDate'), type: 'date', nullable: true, table: true }, { name: 'total_amount', label: f('totalAmount'), type: 'number', step: '0.01', required: true, table: true },
      { name: 'currency', label: f('currency'), type: 'select', options: currency, required: true },
      { name: 'status', label: f('status'), type: 'select', required: true, table: true, options: options([['draft', 'admin.options.invoiceStatus.draft'], ['sent', 'admin.options.invoiceStatus.sent'], ['paid', 'admin.options.invoiceStatus.paid'], ['cancelled', 'admin.options.invoiceStatus.cancelled']]) },
      { name: 'note', label: f('note'), type: 'textarea' },
    ],
  },
};

export const systemConfigs: Record<string, ResourceConfig> = {
  users: {
    resource: resources.users, title: title('users'), description: description('users'),
    fields: [{ name: 'username', label: f('username'), required: true, table: true }, { name: 'full_name', label: f('fullName'), required: true, table: true }, { name: 'phone', label: f('phone') }, { name: 'email', label: f('email'), type: 'text', table: true }, { name: 'is_active', label: f('active'), type: 'checkbox', table: true }, { name: 'is_superadmin', label: f('superadmin'), type: 'checkbox', table: true }, { name: 'password', label: f('password'), type: 'password' }],
  },
  permissions: {
    resource: resources.permissions, title: title('permissions'), description: description('permissions'),
    fields: [
      { name: 'user', label: f('user'), lookup: { resource: resources.users, label: 'username', secondary: 'full_name' }, required: true, table: true },
      { name: 'page', label: f('page'), type: 'select', required: true, table: true, options: options(['dashboard', 'clients', 'products', 'materials', 'inventory', 'production', 'employees', 'attendance', 'payroll', 'finance', 'approvals', 'audit', 'security_logs', 'backups', 'settings', 'users'].map(value => [value, `admin.options.page.${value}`])) },
      { name: 'level', label: f('level'), type: 'select', required: true, table: true, options: options([['view', 'admin.options.permissionLevel.view'], ['manage', 'admin.options.permissionLevel.manage']]) }, { name: 'is_active', label: f('active'), type: 'checkbox', table: true },
    ],
  },
  settings: {
    resource: resources.settings, title: title('settings'), description: description('settings'),
    fields: [{ name: 'key', label: f('key'), required: true, table: true }, { name: 'value', label: f('valueJson'), type: 'json', required: true, table: true }, { name: 'description', label: f('description'), type: 'textarea', table: true }, { name: 'is_active', label: f('active'), type: 'checkbox', table: true }],
  },
  backups: {
    resource: resources.backups, title: title('backups'), description: description('backups'), readOnly: true,
    fields: [{ name: 'trigger', label: f('trigger'), table: true }, { name: 'status', label: f('status'), table: true }, { name: 'started_at', label: f('started'), table: true }, { name: 'finished_at', label: f('finished'), table: true }, { name: 'message', label: f('message'), table: true }],
  },
  audit: {
    resource: resources.auditLogs, title: title('audit'), description: description('audit'), readOnly: true,
    fields: [{ name: 'created_at', label: f('time'), table: true }, { name: 'user', label: f('user'), lookup: { resource: resources.users, label: 'username' }, table: true }, { name: 'page', label: f('page'), table: true }, { name: 'action', label: f('action'), table: true }, { name: 'object_type', label: f('object'), table: true }, { name: 'payload', label: 'admin.fields.metadata', type: 'json' }],
  },
  exports: {
    resource: resources.exportLogs, title: title('exports'), description: description('exports'), readOnly: true,
    fields: [{ name: 'created_at', label: f('time'), table: true }, { name: 'user', label: f('user'), lookup: { resource: resources.users, label: 'username' }, table: true }, { name: 'page', label: f('page'), table: true }, { name: 'row_count', label: f('rows'), table: true }],
  },
  security: {
    resource: resources.securityLogs, title: title('security'), description: description('security'), readOnly: true,
    fields: [{ name: 'created_at', label: f('time'), table: true }, { name: 'user', label: f('user'), lookup: { resource: resources.users, label: 'username' }, table: true }, { name: 'event', label: f('event'), table: true }, { name: 'method', label: f('method'), table: true }, { name: 'path', label: f('path'), table: true }, { name: 'status_code', label: f('status'), table: true }, { name: 'metadata', label: f('metadata'), type: 'json' }],
  },
  stockLogs: { resource: resources.stockLogs, title: title('stockLogs'), description: description('stockLogs'), readOnly: true, fields: [{ name: 'created_at', label: f('time'), table: true }, { name: 'event', label: f('event'), table: true }, { name: 'object_type', label: f('object'), table: true }, { name: 'object_id', label: f('id'), table: true }, { name: 'quantity', label: f('quantity'), table: true }] },
  payrollLogs: { resource: resources.payrollLogs, title: title('payrollLogs'), description: description('payrollLogs'), readOnly: true, fields: [{ name: 'created_at', label: f('time'), table: true }, { name: 'event', label: f('event'), table: true }, { name: 'employee_id', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name', secondary: 'employee_code' }, table: true }, { name: 'payroll_id', label: 'admin.resources.payrolls.title', lookup: { resource: resources.monthlyPayrolls, label: 'month' }, table: true }, { name: 'metadata', label: f('metadata'), type: 'json' }] },
  attendanceLogs: { resource: resources.attendanceLogs, title: title('attendanceLogs'), description: description('attendanceLogs'), readOnly: true, fields: [{ name: 'created_at', label: f('time'), table: true }, { name: 'event', label: f('event'), table: true }, { name: 'employee_id', label: f('employee'), lookup: { resource: resources.employees, label: 'full_name', secondary: 'employee_code' }, table: true }, { name: 'device_id', label: f('device'), lookup: { resource: resources.attendanceDevices, label: 'name' }, table: true }, { name: 'metadata', label: f('metadata'), type: 'json' }] },
  backupLogs: { resource: resources.backupLogs, title: title('backupLogs'), description: description('backupLogs'), readOnly: true, fields: [{ name: 'created_at', label: f('time'), table: true }, { name: 'event', label: f('event'), table: true }, { name: 'status', label: f('status'), table: true }, { name: 'message', label: f('message'), table: true }, { name: 'metadata', label: f('metadata'), type: 'json' }] },
};
