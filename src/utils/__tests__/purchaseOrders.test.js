import {
  PO_FILTERS,
  countPurchaseOrdersByStatus,
  filterPurchaseOrders,
  matchesPoStatusFilter,
  nextPoStatusFilter,
} from '../purchaseOrders';

const pos = [
  { poNumber: 'PO-1', status: 'Draft', total: 10 },
  { poNumber: 'PO-2', status: 'Sent', total: 20 },
  { poNumber: 'PO-3', status: 'Confirmed', total: 30 },
  { poNumber: 'PO-4', status: 'Received', total: 40 },
  { poNumber: 'PO-5', status: 'Paid', total: 50 },
];

describe('purchaseOrders filters', () => {
  test('Sent filter includes Confirmed; counts stay on the full set', () => {
    expect(matchesPoStatusFilter(pos[1], PO_FILTERS.sent)).toBe(true);
    expect(matchesPoStatusFilter(pos[2], PO_FILTERS.sent)).toBe(true);
    expect(matchesPoStatusFilter(pos[0], PO_FILTERS.sent)).toBe(false);
    expect(countPurchaseOrdersByStatus(pos)).toEqual({
      total: 5,
      draft: 1,
      sent: 2,
      received: 1,
      paid: 1,
      totalValue: 150,
    });
  });

  test('defaults to all purchase orders', () => {
    expect(filterPurchaseOrders(pos).map((p) => p.poNumber)).toEqual([
      'PO-1',
      'PO-2',
      'PO-3',
      'PO-4',
      'PO-5',
    ]);
  });

  test('Draft and Received cards filter to those statuses', () => {
    expect(filterPurchaseOrders(pos, PO_FILTERS.draft).map((p) => p.poNumber)).toEqual(['PO-1']);
    expect(filterPurchaseOrders(pos, PO_FILTERS.received).map((p) => p.poNumber)).toEqual([
      'PO-4',
    ]);
  });

  test('dropdown exact statuses still work (Paid, Confirmed)', () => {
    expect(filterPurchaseOrders(pos, 'Paid').map((p) => p.poNumber)).toEqual(['PO-5']);
    expect(filterPurchaseOrders(pos, 'Confirmed').map((p) => p.poNumber)).toEqual(['PO-3']);
  });

  test('tapping the active card clears the filter to all', () => {
    expect(nextPoStatusFilter(PO_FILTERS.draft, PO_FILTERS.draft)).toBe(PO_FILTERS.all);
    expect(nextPoStatusFilter(PO_FILTERS.draft, PO_FILTERS.sent)).toBe(PO_FILTERS.sent);
    expect(nextPoStatusFilter(PO_FILTERS.draft, PO_FILTERS.all)).toBe(PO_FILTERS.all);
  });
});
