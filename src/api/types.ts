export type ApiId = string;

export interface ApiList<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiBaseModel {
  id: ApiId;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: number | null;
}

export interface ApiUser {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_superadmin: boolean;
  date_joined: string;
  last_login: string | null;
}

export type ApiClientStatus = 'active' | 'new' | 'vip' | 'blocked' | 'inactive';

export interface ApiClient extends ApiBaseModel {
  full_name: string;
  phone: string;
  address: string;
  note: string;
  balance: string;
  status: ApiClientStatus;
}

export interface ApiClientOrder extends ApiBaseModel {
  client: ApiId;
  order_number: string;
  order_date: string;
  due_date: string | null;
  status: string;
  total_amount: string;
  total_amount_uzs: string;
  currency: 'UZS' | 'USD';
  exchange_rate: string | null;
  note: string;
}

export interface ApiClientOrderItem extends ApiBaseModel {
  order: ApiId;
  product: ApiId;
  size: string;
  color: string;
  quantity: number;
  unit_price: string;
  total_amount: string;
  note: string;
}

export interface ApiClientDelivery extends ApiBaseModel {
  client: ApiId;
  order: ApiId | null;
  product: ApiId;
  size: string;
  color: string;
  quantity: number;
  unit_price: string;
  total_amount: string;
  total_amount_uzs: string;
  currency: 'UZS' | 'USD';
  exchange_rate: string | null;
  delivery_date: string;
  note: string;
  status: string;
}

export interface ApiClientPayment extends ApiBaseModel {
  client: ApiId;
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'usd_cash';
  amount: string;
  amount_uzs: string;
  currency: 'UZS' | 'USD';
  exchange_rate: string | null;
  payment_date: string;
  note: string;
}

export interface ApiMaterial extends ApiBaseModel {
  name: string;
  code: string;
  barcode: string;
  supplier: ApiId | null;
  unit: 'm' | 'piece' | 'kg' | 'linear_meter';
  unit_price: string;
  min_stock_level: string;
}

export interface ApiSupplier extends ApiBaseModel {
  name: string;
  phone: string;
  address: string;
  note: string;
}

export interface ApiProductCategory extends ApiBaseModel {
  name: string;
  color: string;
}

export interface ApiProduct extends ApiBaseModel {
  category: ApiId | null;
  name: string;
  code: string;
  size_range: string;
  material_type: string;
  color: string;
  unit_price_with_tax_uzs: string;
  unit_price_without_tax_uzs: string;
  unit_price_with_tax_usd: string;
  unit_price_without_tax_usd: string;
  vat_percent: string;
}

export interface ApiProductMaterialNorm extends ApiBaseModel {
  product: ApiId;
  material: ApiId;
  norm_per_unit: string;
}

export interface ApiMaterialStock extends ApiBaseModel {
  material: ApiId;
  quantity: string;
  total_value: string;
}

export interface ApiMaterialTransaction extends ApiBaseModel {
  material: ApiId;
  transaction_type: 'in' | 'out_production' | 'out_writeoff' | 'defect';
  quantity: string;
  unit_price: string;
  total_price: string;
  date: string;
  related_production_batch: ApiId | null;
  note: string;
  status: string;
  applied_at: string | null;
}

export interface ApiExpense extends ApiBaseModel {
  category: string;
  amount: string;
  amount_uzs: string;
  currency: string;
  date: string;
  note: string;
  status: string;
}

export interface ApiFinishedGoodsStock extends ApiBaseModel {
  product: ApiId;
  size: string;
  color: string;
  quantity: number;
}

export interface ApiFinishedGoodsTransaction extends ApiBaseModel {
  product: ApiId;
  size: string;
  color: string;
  transaction_type: 'in_production' | 'out_client' | 'out_defect' | 'return_client';
  quantity: number;
  date: string;
  related_batch: ApiId | null;
  related_client_delivery: ApiId | null;
  note: string;
  status: string;
}

export interface ApiProductionBatch extends ApiBaseModel {
  product: ApiId;
  batch_number: string;
  started_date: string;
  planned_quantity: number;
  delivered_to_warehouse: number;
  remaining_quantity: number;
  status: string;
  note: string;
}

export interface ApiEmployee extends ApiBaseModel {
  full_name: string;
  employee_code: string;
  phone: string;
  address: string;
  position: 'seamstress' | 'driver' | 'guard' | 'other';
  salary_type: 'piece_rate' | 'fixed_daily';
  daily_rate: string | null;
  hire_date: string;
  status: 'active' | 'inactive';
  photo: string | null;
  note: string;
}

export interface ApiAttendanceRecord extends ApiBaseModel {
  employee: ApiId;
  work_date: string;
  first_check_in_at: string | null;
  last_check_out_at: string | null;
  worked_minutes: number;
  status: string;
  is_manual: boolean;
  note: string;
}

export interface ApiOperationType extends ApiBaseModel {
  name: string;
  sequence_order: number | null;
  time_norm_minutes: string | null;
  hourly_norm: string | null;
  daily_norm: string | null;
  monthly_norm: string | null;
  price_per_unit: string;
}

export interface ApiDailyWorkEntry extends ApiBaseModel {
  employee: ApiId;
  operation_type: ApiId;
  date: string;
  quantity_done: number;
  amount: string;
  related_batch: ApiId | null;
  note: string;
}

export interface ApiMonthlyPayroll extends ApiBaseModel {
  employee: ApiId;
  month: string;
  salary_type: string;
  piece_rate_total: string;
  worked_days: string;
  fixed_rate_total: string;
  bonus_total: string;
  penalty_total: string;
  final_amount: string;
  status: string;
}

export interface ApiDashboardSummary {
  clients: { total_count: number; new_this_month: number; delivered_total_this_month?: number | string; paid_total_this_month?: number | string; estimated_debt_this_month?: number | string };
  warehouse: { finished_goods_total_units: number; low_stock_materials_count: number; materials_value_total: number | string };
  employees: { total_active: number };
  production: { batches_in_progress: number; produced_this_month: number };
  finance?: { expenses_this_month: number | string; payroll_this_month: number | string; estimated_profit_this_month: number | string };
  // Present when the request included date_from/date_to (backend computes these server-side for the exact range).
  filters?: { date_from: string; date_to: string };
  new_in_period?: number;
  delivered_total_in_period?: number | string;
  paid_total_in_period?: number | string;
  estimated_debt_in_period?: number | string;
  produced_in_period?: number;
  expenses_in_period?: number | string;
  payroll_in_period?: number | string;
  estimated_profit_in_period?: number | string;
}

export interface ApiApproval extends ApiBaseModel {
  content_type: number;
  object_id: string;
  page: string;
  action: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  reject_reason: string;
  payload: Record<string, unknown>;
}

export type ApiRecord = Record<string, unknown> & { id: string | number };
export type ApiPayload = Record<string, unknown> | FormData;

export interface ApiCurrentUser {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_superadmin: boolean;
  permissions: Record<string, 'view' | 'manage'> | { all: 'manage' };
}
