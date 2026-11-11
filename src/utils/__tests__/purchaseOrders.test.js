import {
  PO_FILTERS,
  countPurchaseOrdersByStatus,
  filterPurchaseOrders,
  matchesPoStatusFilter,
  nextPoStatusFilter,
  purchaseOrderDraftFromJob,
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

describe('purchase order from a job', () => {
  test('copies job lines onto a draft and uses the cost, not the customer price', () => {
    const draft = purchaseOrderDraftFromJob({
      jobNumber: 'J-2001',
      name: 'Replace keypad',
      chargeLines: [
        { description: 'Switch', sku: 'SW-1', quantity: 1, price: 500, paid: 180 },
        { description: 'Labor trip', quantity: 1, price: 85 },
        { description: '', quantity: 1, price: 10 },
      ],
      parts: [{ description: 'Contact', sku: 'DC-1', quantity: 3, paid: 13.92, sold: 32 }],
    }, {
      supplierId: 's1',
      jobLabel: 'J-2001 · Replace keypad',
      customerName: 'John Doe',
    });

    expect(draft).toMatchObject({
      supplier: 's1',
      status: 'Draft',
      tax: 0,
      shipping: 0,
      subtotal: 221.76,
      total: 221.76,
      notes: 'From job J-2001 · Replace keypad · John Doe',
    });
    expect(draft.items).toEqual([
      { sku: 'SW-1', description: 'Switch', quantity: 1, unit: 'each', unitPrice: 180, total: 180 },
      { sku: '', description: 'Labor trip', quantity: 1, unit: 'each', unitPrice: 0, total: 0 },
      { sku: 'DC-1', description: 'Contact', quantity: 3, unit: 'each', unitPrice: 13.92, total: 41.76 },
    ]);
  });
});
