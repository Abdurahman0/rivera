export type PageId = 'dashboard' | 'clients' | 'orders' | 'production' | 'materials' | 'products' | 'warehouse' | 'staff' | 'finance' | 'approvals' | 'system';
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type ModalMode = 'view' | 'create' | 'edit';
export type EntityKind = 'client' | 'staff' | 'product' | 'category' | 'order' | 'material' | 'batch' | 'payment' | 'stockMovement';
export type EntityId = number | string;

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export interface AttendanceLogEntry {
  id: EntityId;
  employeeId: EntityId;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
}

export interface Material {
  id: EntityId;
  name: string;
  sku: string;
  unit: 'm' | 'kg' | 'pcs';
  price: number;
  stock: number;
  minStock: number;
  status: string;
  statusKey: string;
  api?: Record<string, unknown>;
}

export interface Client {
  id: EntityId;
  name: string;
  phone: string;
  source: string;
  status: string;
  statusKey: string;
  manager: string;
  value: number;
  lastContact: string;
  fabric: string;
  api?: Record<string, unknown>;
}

export interface StaffMember {
  id: EntityId;
  name: string;
  role: string;
  phone: string;
  salary: number;
  hireDate: string;
  shift: string;
  arrival: string;
  leaving: string;
  status: string;
  statusKey: string;
  attendance: number;
  api?: Record<string, unknown>;
}

export interface Product {
  id: EntityId;
  name: string;
  description: string;
  category: string;
  categoryId: string;
  sku: string;
  supplier: string;
  warehouse: string;
  color: string;
  composition: string;
  gsm: number;
  width: string;
  price: number;
  currency: string;
  imageUrl: string;
  gallery: string[];
  status: string;
  isActive: boolean;
  isRecommended: boolean;
  subsidyEnabled: boolean;
  stock: number;
  minStock: number;
  unit: 'm' | 'kg' | 'pcs';
  sold: number;
  revenue: number;
  trend: number;
  materialsUsed?: string[];
  recipe?: Array<{ id: string; materialId: string; materialName: string; qtyPerUnit: number; unit: 'm' | 'kg' | 'pcs' }>;
  api?: Record<string, unknown>;
}

export interface CategoryDatum {
  name: string;
  value: number;
  color: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  sortOrder: number;
  /** Display color — backend-stored hex, with palette fallback resolved in the adapter. */
  color: string;
  api?: Record<string, unknown>;
}

export interface Order {
  id: EntityId;
  orderId: string;
  client: string;
  orderDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  statusKey: string;
  notes: string;
  clientId?: string;
  /** Total pieces across this order's items. */
  orderedQty: number;
  /** Pieces delivered against this order (approved deliveries linked to it). */
  deliveredQty: number;
  /** Per-product breakdown of ordered vs delivered pieces for this order. */
  items: Array<{ productId: string; productName: string; ordered: number; delivered: number }>;
  /** UZS the client has paid against this order (payments linked to it). */
  paidTotal: number;
  api?: Record<string, unknown>;
}

export interface StockMovement {
  id: number;
  date: string;
  product: string;
  quantity: string;
  supplier?: string;
  client?: string;
  employee: string;
  type: 'in' | 'out';
  note: string;
  /** Whether this row came from material or finished-goods transactions — picks the tx-type label domain. */
  sourceKind: 'material' | 'finished';
  /** Raw backend transaction_type (e.g. 'in', 'out_production', 'out_client', 'out_defect'). */
  txType: string;
  /** Raw backend approval status ('pending_approval' | 'approved' | 'rejected' | 'draft'). */
  status: string;
}

/** One finished-goods stock record (product broken down by size/color variant). */
export interface FinishedVariant {
  productId: EntityId;
  size: string;
  color: string;
  quantity: number;
}

export interface FinanceEntry {
  id: number;
  date: string;
  client?: string;
  order?: string;
  category?: string;
  description?: string;
  amount: number;
}

export interface ProductionBatch {
  id: EntityId;
  dateLabel: string;
  product: string;
  productId: EntityId;
  plannedQty: number;
  producedQty: number;
  unit: 'm' | 'kg' | 'pcs';
  shift: string;
  orderId: string | null;
  notes: string;
  /** Actual material consumed for this batch (approved out_production transactions), per material. */
  materialIssues: Array<{
    materialId: EntityId;
    materialName: string;
    unit: 'm' | 'kg' | 'pcs';
    quantity: number;
  }>;
  api?: Record<string, unknown>;
}

export interface PieceworkRecord {
  id: number;
  employeeName: string;
  operationName: string;
  quantity: number;
  ratePerPiece: number;
  unit: 'm' | 'kg' | 'pcs';
  /** ISO work date of the entry (kept as `week` for historical naming). */
  week: string;
}

export interface ModalState {
  mode: ModalMode;
  kind: EntityKind;
  item?: Client | StaffMember | Product | ProductCategory | Order | Material | ProductionBatch;
}
