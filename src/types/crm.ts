export type PageId = 'dashboard' | 'clients' | 'orders' | 'production' | 'materials' | 'products' | 'warehouse' | 'staff' | 'finance';
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type ModalMode = 'view' | 'create' | 'edit';
export type EntityKind = 'client' | 'staff' | 'product' | 'category' | 'order';
export type EntityId = number | string;

export interface Material {
  id: number;
  name: string;
  category: string;
  categoryKey: string;
  sku: string;
  supplier: string;
  color: string;
  unit: 'm' | 'kg' | 'pcs';
  price: number;
  stock: number;
  minStock: number;
  status: string;
  statusKey: string;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  source: string;
  status: string;
  statusKey: string;
  manager: string;
  value: number;
  lastContact: string;
  fabric: string;
}

export interface StaffMember {
  id: number;
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
}

export interface Product {
  id: number;
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
  recipe?: Array<{ materialName: string; qtyPerUnit: number; unit: 'm' | 'kg' | 'pcs' }>;
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
}

export interface Order {
  id: number;
  orderId: string;
  client: string;
  product: string;
  quantity: string;
  unitPrice: number;
  totalAmount: number;
  manager: string;
  deliveryDate: string;
  status: string;
  statusKey: string;
  notes: string;
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

export interface ProductionRecord {
  id: number;
  date: string;
  employee: string;
  role: string;
  product: string;
  quantity: string;
  orderId: string | null;
  shift: string;
  notes: string;
}

export interface ProductionBatch {
  id: number;
  dateLabel: string;
  product: string;
  productId: number;
  producedQty: number;
  unit: 'm' | 'kg' | 'pcs';
  employees: string[];
  shift: string;
  orderId: string | null;
  notes: string;
}

export interface PieceworkRecord {
  id: number;
  employeeName: string;
  operationName: string;
  product: string;
  quantity: number;
  ratePerPiece: number;
  unit: 'm' | 'kg' | 'pcs';
  week: string;
}

export interface ModalState {
  mode: ModalMode;
  kind: EntityKind;
  item?: Client | StaffMember | Product | ProductCategory | Order;
}
