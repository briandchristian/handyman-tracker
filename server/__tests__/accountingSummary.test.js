import { buildAccountingSummary, materialCost, bidWorksheetTotal } from '../lib/accountingSummary.js';

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
          accountNumber: 'A-1042',
          jobNumber: 'J-208',
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
      jobNumber: 'J-208',
      accountNumber: 'A-1042',
      jobLabel: 'J-208 · Alarm',
      customerLabel: 'Jane · A-1042',
      materialCost: 40,
      profit: 160,
      tax: 20,
    });
    expect(summary.direct).toMatchObject({ materials: 40, labor: 0, expenses: 0, total: 40 });
    expect(summary.indirect.total).toBe(0);
    expect(summary.period.revenue).toBe(200);
  });

  test('classifies job expenses as direct and cost-center-only as indirect', () => {
    const summary = buildAccountingSummary({
      projects: [
        {
          _id: 'job1',
          customerId: 'c1',
          name: 'Alarm',
          customerName: 'Jane',
          status: 'Billed',
          billAmount: 500,
          materials: [{ quantity: 1, cost: 100 }],
        },
      ],
      expenses: [
        { amount: 25, costCenterCode: 'FUEL', projectId: 'job1', customerId: 'c1' },
        { amount: 200, costCenterCode: 'OFFICE' },
      ],
    });
    expect(summary.jobs[0]).toMatchObject({
      materialCost: 100,
      directExpenseCost: 25,
      laborCost: 0,
      jobCost: 125,
      profit: 400,
      contribution: 375,
    });
    expect(summary.direct).toMatchObject({ materials: 100, expenses: 25, total: 125 });
    expect(summary.indirect.total).toBe(200);
    expect(summary.indirect.byCostCenter).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'OFFICE', expenses: 200, total: 200 })])
    );
  });

  test('direct labor and bidding hours split contribution vs overhead', () => {
    const summary = buildAccountingSummary({
      projects: [
        {
          _id: 'job1',
          name: 'Alarm',
          status: 'Billed',
          billAmount: 400,
          workType: 'installation',
          materials: [{ quantity: 1, cost: 50 }],
        },
      ],
      laborEntries: [
        { workType: 'install', projectId: 'job1', hours: 2, hourlyCost: 40 },
        { workType: 'bidding', hours: 5, hourlyCost: 30 },
      ],
    });
    expect(summary.jobs[0]).toMatchObject({
      laborCost: 80,
      jobCost: 130,
      profit: 350,
      contribution: 270,
      workType: 'installation',
    });
    expect(summary.direct).toMatchObject({ materials: 50, labor: 80, total: 130, laborHours: 2 });
    expect(summary.indirect).toMatchObject({ labor: 150, total: 150, laborHours: 5 });
    expect(summary.period.overheadRatePerHour).toBe(75);
    expect(summary.period.overheadRateOnCost).toBe(1.15);
  });

  test('date range filters expenses, labor, and jobs without changing AR', () => {
    const summary = buildAccountingSummary({
      projects: [
        {
          _id: 'old',
          name: 'Old',
          status: 'Billed',
          billAmount: 900,
          createdAt: '2026-08-10T00:00:00.000Z',
          materials: [{ quantity: 1, cost: 10 }],
        },
        {
          _id: 'sep',
          name: 'September',
          status: 'Billed',
          billAmount: 300,
          createdAt: '2026-09-12T00:00:00.000Z',
          materials: [{ quantity: 1, cost: 20 }],
        },
      ],
      expenses: [
        { amount: 50, costCenterCode: 'OFFICE', date: '2026-09-05T00:00:00.000Z' },
        { amount: 9, costCenterCode: 'OFFICE', date: '2026-08-01T00:00:00.000Z' },
      ],
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(summary.jobs.map((job) => job.projectName)).toEqual(['September']);
    expect(summary.direct.materials).toBe(20);
    expect(summary.indirect.total).toBe(50);
    expect(summary.period.revenue).toBe(300);
    expect(summary.ar.billed).toBe(1200);
  });

  test('Job Profit uses billed amount, not the bid, for a labor-only job', () => {
    const summary = buildAccountingSummary({
      projects: [
        {
          _id: 'job1',
          name: 'Service call',
          customerName: 'Acme',
          status: 'Billed',
          bidAmount: 2500,
          billAmount: 7400,
          materials: [],
        },
      ],
      laborEntries: [
        { workType: 'service', projectId: 'job1', hours: 10, hourlyCost: 40 },
      ],
    });

    expect(summary.jobs[0]).toMatchObject({
      billed: 7400,
      quoted: 2500,
      materialCost: 0,
      laborCost: 400,
      profit: 7400,
      contribution: 7000,
    });
    expect(summary.period.revenue).toBe(7400);
    expect(summary.jobs[0].billed).not.toBe(summary.jobs[0].quoted);
  });

  test('materialCost never uses billed, bid, or marked-up sell totals', () => {
    expect(
      materialCost({
        billAmount: 7400,
        bidAmount: 2500,
        materials: [{ quantity: 1, cost: 0, markup: 100 }],
      })
    ).toBe(0);

    const summary = buildAccountingSummary({
      projects: [
        {
          name: '3 Cameras Installation bid',
          customerName: "Animal Rescue (Cash's Crew Rescue)",
          status: 'Billed',
          bidAmount: 2500,
          billAmount: 7400,
          materials: [{ quantity: 1, cost: 100, markup: 100 }],
        },
      ],
    });

    expect(summary.jobs[0]).toMatchObject({
      quoted: 2500,
      billed: 7400,
      materialCost: 100,
      profit: 7300,
    });
  });

  test('leftover material lines that match billed are still counted as cost', () => {
    const summary = buildAccountingSummary({
      projects: [
        {
          name: '3 Cameras Installation bid',
          status: 'Billed',
          bidAmount: 2500,
          billAmount: 7400,
          materials: [{ quantity: 1, cost: 7400 }],
        },
      ],
    });

    expect(summary.jobs[0]).toMatchObject({
      billed: 7400,
      materialCost: 7400,
      profit: 0,
      contribution: 0,
    });
  });

  test('unbilled quotes do not count as Job Profit revenue', () => {
    const summary = buildAccountingSummary({
      projects: [
        {
          name: 'Quote only',
          status: 'Bidded',
          bidAmount: 2500,
          billAmount: 0,
          materials: [{ quantity: 1, cost: 2500 }],
        },
      ],
    });

    expect(summary.jobs[0]).toMatchObject({
      billed: 0,
      quoted: 2500,
      materialCost: 2500,
      profit: -2500,
    });
    expect(summary.period.revenue).toBe(0);
  });

  test('bid worksheet estimates do not count as Job Profit material cost', () => {
    const project = {
      name: '3 Cameras Installation bid',
      status: 'Billed',
      bidAmount: 2500,
      billAmount: 7400,
      bidMaterials: [{ item: 'Cameras (quote)', quantity: 3, estimate: 800 }],
      materials: [{ item: 'Cable used', quantity: 1, cost: 40 }],
    };

    expect(bidWorksheetTotal(project)).toBe(2400);
    expect(materialCost(project)).toBe(40);

    const summary = buildAccountingSummary({ projects: [project] });
    expect(summary.jobs[0]).toMatchObject({
      quoted: 2500,
      billed: 7400,
      materialCost: 40,
      profit: 7360,
    });
  });
});
