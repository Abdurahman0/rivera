import { resources } from '../api/client';
import type { ApiRecord } from '../api/types';
import { formatDisplayDate } from '../utils/crm';

type Translator = (key: string, options?: Record<string, unknown>) => string;

/** Maps an ApprovalRequest's `action` to the backend resource it targets and which fields
 *  best identify that row for display, since the approval itself only stores a raw object_id. */
export const APPROVAL_ACTION_TARGETS: Record<string, {
  resource: string;
  materialField?: string;
  productField?: string;
  textFields?: string[];
  quantityField?: string;
  dateField?: string;
}> = {
  client_delivery: { resource: resources.clientDeliveries, productField: 'product', quantityField: 'quantity', dateField: 'delivery_date' },
  client_return: { resource: resources.clientReturns, productField: 'product', quantityField: 'quantity', dateField: 'return_date' },
  client_debt_adjustment: { resource: resources.clientDebtAdjustments, textFields: ['reason'], dateField: 'date' },
  leave_request: { resource: resources.leaveRequests, textFields: ['reason'], dateField: 'start_date' },
  cash_transaction: { resource: resources.cashTransactions, textFields: ['note'], dateField: 'date' },
  expense: { resource: resources.expenses, textFields: ['category', 'note'], dateField: 'date' },
  material_purchase: { resource: resources.materialPurchases, materialField: 'material', quantityField: 'quantity', dateField: 'purchase_date' },
  production_material_issue: { resource: resources.productionMaterialUsages, materialField: 'material', quantityField: 'norm_quantity', dateField: 'delivered_date' },
  production_warehouse_delivery: { resource: resources.finishedGoodsTransactions, productField: 'product', quantityField: 'quantity', dateField: 'date' },
  material_transaction: { resource: resources.materialTransactions, materialField: 'material', quantityField: 'quantity', dateField: 'date' },
  defective_material_transaction: { resource: resources.defectiveMaterialTransactions, materialField: 'material', quantityField: 'quantity', dateField: 'date' },
  finished_goods_transaction: { resource: resources.finishedGoodsTransactions, productField: 'product', quantityField: 'quantity', dateField: 'date' },
};

export function buildApprovalObjectLabel(
  action: string,
  row: ApiRecord | undefined,
  materialsById: Map<string, string>,
  productsById: Map<string, string>,
  t: Translator,
): string | null {
  const config = APPROVAL_ACTION_TARGETS[action];
  if (!config || !row) return null;
  const parts: string[] = [];

  if (config.materialField) {
    const name = materialsById.get(String(row[config.materialField] ?? ''));
    if (name) parts.push(name);
  }
  if (config.productField) {
    const name = productsById.get(String(row[config.productField] ?? ''));
    if (name) parts.push(name);
  }
  for (const field of config.textFields ?? []) {
    const value = row[field];
    if (typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
      break;
    }
  }
  if (config.quantityField && row[config.quantityField] != null && row[config.quantityField] !== '') {
    parts.push(String(row[config.quantityField]));
  }
  if (config.dateField && row[config.dateField]) {
    parts.push(formatDisplayDate(String(row[config.dateField]), t));
  }

  return parts.length ? parts.join(' · ') : null;
}
