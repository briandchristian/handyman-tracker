/**
 * Purchase order list: status cards filter the list; counts stay on the full set.
 * Sent includes Confirmed so those orders are not hidden from the Sent card.
 */

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

export function filterPurchaseOrders(pos = [], statusFilter = DEFAULT_PO_FILTER) {
  return pos.filter((p) => matchesPoStatusFilter(p, statusFilter));
}

/** Tap Total → all. Tap the active status again → all. Otherwise select that status. */
export function nextPoStatusFilter(current, clicked) {
  if (clicked === PO_FILTERS.all) return PO_FILTERS.all;
  if (current === clicked) return PO_FILTERS.all;
  return clicked;
}
