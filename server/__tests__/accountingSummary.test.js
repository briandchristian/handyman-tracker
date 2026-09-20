import { buildAccountingSummary, materialCost } from '../lib/accountingSummary.js';

describe('accountingSummary', () => {
  test('computes material cost as qty × unit cost', () => {
    expect(
      materialCost({
        materials: [
          { quantity: 2, cost: 10 },
          { quantity: 1, cost: 5.5 },
        ],
      })
    ).toBe(25.5);
  });

  test('builds AR, AP, tax, and job profit from source records', () => {
    const summary = buildAccountingSummary({
      projects: [
        {
          name: 'Alarm',
          customerName: 'Jane',
          status: 'Billed',
          billAmount: 200,
          paidToDate: 50,
          taxRate: 10,
          materials: [{ quantity: 2, cost: 20 }],
        },
        {
          name: 'Quote only',
          customerName: 'Bob',
          status: 'Pending',
          billAmount: 0,
          materials: [],
        },
      ],
      purchaseOrders: [
        { status: 'Received', total: 80 },
        { status: 'Paid', total: 40 },
      ],
      supplierPayments: [{ amount: 40 }],
    });

    expect(summary.ar).toEqual({ billed: 200, paid: 50, balance: 150 });
    expect(summary.ap).toEqual({ receivedUnpaid: 80, paid: 40, balance: 80 });
    expect(summary.taxCollected).toBe(20);
    expect(summary.jobs[0]).toMatchObject({
      projectName: 'Alarm',
      materialCost: 40,
      profit: 160,
      tax: 20,
    });
  });
});
