/**
 * Purchase order list: status cards filter the list; counts stay on the full set.
 * Sent includes Confirmed so those orders are not hidden from the Sent card.
 * A job can start a draft order. Line cost is the supplier price. The customer price stays on the job.
 */

import { serviceJobLines } from '../../server/lib/customerWork.js';

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export const PO_FILTERS = {
  all: 'all',
  draft: 'Draft',
  sent: 'Sent',
  received: 'Received',
};

export const DEFAULT_PO_FILTER = PO_FILTERS.all;

export function poStatus(po) {
  return po?.status || '';
}

export function matchesPoStatusFilter(po, filter) {
  const status = poStatus(po);
  if (!filter || filter === PO_FILTERS.all) return true;
  if (filter === PO_FILTERS.sent) {
    return status === 'Sent' || status === 'Confirmed';
  }
  return status === filter;
}

export function countPurchaseOrdersByStatus(pos = []) {
  return {
    total: pos.length,
    draft: pos.filter((p) => matchesPoStatusFilter(p, PO_FILTERS.draft)).length,
    sent: pos.filter((p) => matchesPoStatusFilter(p, PO_FILTERS.sent)).length,
    received: pos.filter((p) => matchesPoStatusFilter(p, PO_FILTERS.received)).length,
    paid: pos.filter((p) => poStatus(p) === 'Paid').length,
    totalValue: pos.reduce((sum, p) => sum + (p.total || 0), 0),
  };
}

/** Lines with a description or SKU and a quantity. Blank cost stays zero until the supplier price is known. */
export function purchaseOrderDraftFromJob(job = {}, { supplierId, jobLabel = '', customerName = '' } = {}) {
  const items = serviceJobLines(job).flatMap((line) => {
    const description = String(line?.description || '').trim();
    const sku = String(line?.sku || '').trim();
    const quantity = Number(line?.quantity) || 0;
    if ((!description && !sku) || quantity <= 0) return [];
    const paid = line?.paid;
    const hasCost = !(paid === '' || paid == null) && Number.isFinite(Number(paid));
    const unitPrice = hasCost ? money(paid) : 0;
    return [{
      sku,
      description: description || sku,
      quantity,
      unit: 'each',
      unitPrice,
      total: money(quantity * unitPrice),
    }];
  });
  const subtotal = money(items.reduce((sum, item) => sum + item.total, 0));
  const who = [jobLabel, customerName].filter(Boolean).join(' · ');
  return {
    supplier: supplierId || '',
    status: 'Draft',
    items,
    subtotal,
    tax: 0,
    shipping: 0,
    total: subtotal,
    notes: who ? `From job ${who}` : 'From job',
  };
}

export function filterPurchaseOrders(pos = [], statusFilter = DEFAULT_PO_FILTER) {
  return pos.filter((p) => matchesPoStatusFilter(p, statusFilter));
}

/** Tap Total → all. Tap the active status again → all. Otherwise select that status. */
export function nextPoStatusFilter(current, clicked) {
  if (clicked === PO_FILTERS.all) return PO_FILTERS.all;
  if (current === clicked) return PO_FILTERS.all;
  return clicked;
}
