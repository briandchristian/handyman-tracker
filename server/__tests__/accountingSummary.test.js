import { buildAccountingSummary, materialCost, bidWorksheetTotal, serviceJobForAccounting, partsSold } from '../lib/accountingSummary.js';
import { subcontractorPartsJob } from '../lib/jobParts.js';

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

  test('a paid service-job ticket is revenue and cash, and an open quote is not', () => {
    const ticket = serviceJobForAccounting(
      {
        _id: 'job-ticket',
        name: 'Replace keypad',
        jobNumber: 'A-1044-J0001',
        workType: 'service',
        status: 'scheduled',
        amountDue: 160,
        paidAmount: 160,
        paidDate: '2026-10-23',
        chargeLines: [{ description: 'Keypad', quantity: 1, price: 85 }],
      },
      { _id: 'cust', name: 'Fashion Exchange', accountNumber: 'A-1044' }
    );
    const summary = buildAccountingSummary({
      projects: [
        ticket,
        {
          name: 'Cameras',
          jobNumber: 'A-1044-B0001',
          status: 'Pending',
          bidAmount: 9100,
          billAmount: 0,
        },
      ],
    });

    expect(ticket).toMatchObject({
      billAmount: 160,
      paidToDate: 160,
      status: 'Billed',
      customerName: 'Fashion Exchange',
    });
    expect(summary.jobs.find((job) => job.jobNumber === 'A-1044-J0001')).toMatchObject({
      billed: 160,
      paid: 160,
      balance: 0,
      quoted: 0,
    });
    expect(summary.period.revenue).toBe(160);
    expect(summary.ar).toEqual({ billed: 160, paid: 160, balance: 0 });
    expect(summary.jobs.find((job) => job.jobNumber === 'A-1044-B0001')).toMatchObject({
      billed: 0,
      quoted: 9100,
    });
  });

  test('a service job imported from a bid reports that bid quoted amount', () => {
    const customer = {
      _id: 'cust',
      name: 'Mike Dibble',
      accountNumber: 'A-1006',
      bids: [{
        _id: 'bid-1',
        quoteNumber: 'A-1006-B0001',
        quotedAmount: 500,
        linesTotal: 700,
      }],
    };
    const ticket = serviceJobForAccounting(
      {
        _id: 'job-ticket',
        name: 'IP Cameras for property',
        jobNumber: 'A-1006-J0001',
        status: 'scheduled',
        amountDue: 1124,
        paidAmount: 1124,
        bidId: 'bid-1',
        chargeLines: [
          { description: 'switch', quantity: 1, price: 500 },
          { description: 'wire', quantity: 1, price: 200 },
        ],
      },
      customer
    );
    const summary = buildAccountingSummary({ projects: [ticket] });

    expect(ticket.bidAmount).toBe(500);
    expect(summary.jobs[0]).toMatchObject({
      quoted: 500,
      billed: 1124,
      profit: 1124,
    });
    expect(serviceJobForAccounting(
      { name: 'No bid', status: 'paid', amountDue: 40, bidId: 'missing' },
      customer
    ).bidAmount).toBe(0);
  });

  test('part paid is material cost and part sold is revenue for jobs and subcontractor parts', () => {
    const project = {
      name: 'Alarm',
      customerName: 'Jane',
      status: 'Pending',
      billAmount: 0,
      materials: [{ quantity: 2, cost: 10, sold: 25 }],
      createdAt: '2026-06-01',
    };
    expect(partsSold(project)).toBe(50);
    expect(materialCost(project)).toBe(20);
    const summary = buildAccountingSummary({
      projects: [
        project,
        subcontractorPartsJob({
          principal: 'Brinks',
          workOrderNumber: 'BRK-9',
          siteName: 'Lobby',
          laborPay: 100,
          equipmentLines: [{ description: 'Contact', quantity: 1, cost: 8, sold: 15 }],
          createdAt: '2026-06-02',
        }),
      ],
    });
    expect(summary.jobs.find((job) => job.projectName === 'Alarm')).toMatchObject({
      billed: 50,
      materialCost: 20,
      partsSold: 50,
      profit: 30,
    });
    expect(summary.jobs.find((job) => job.jobNumber === 'BRK-9')).toMatchObject({
      billed: 15,
      materialCost: 8,
      partsSold: 15,
      profit: 7,
    });
    expect(summary.direct.materials).toBe(28);
    expect(summary.period.revenue).toBe(65);
  });

  test('a service job line with a cost is material cost and a price-only line is only billed', () => {
    const ticket = serviceJobForAccounting({
      name: 'Cameras',
      jobNumber: 'A-1006-J0001',
      status: 'paid',
      amountDue: 1060,
      paidAmount: 1060,
      chargeLines: [
        { description: 'Switch', quantity: 1, price: 500 },
        { description: 'Hub', quantity: 1, price: 328, paid: 265 },
      ],
      parts: [{ description: 'Contact', quantity: 3, paid: 13.92, sold: 32 }],
    }, { name: 'Mike Dibble' });
    const summary = buildAccountingSummary({ projects: [ticket] });
    expect(summary.jobs[0]).toMatchObject({
      billed: 1060,
      materialCost: 306.76,
      partsSold: 424,
      profit: 753.24,
    });
  });

  test('a scheduled service job still posts its parts', () => {
    const ticket = serviceJobForAccounting({
      name: 'Panel',
      jobNumber: 'A-1-J0001',
      status: 'scheduled',
      amountDue: 40,
      paidAmount: null,
      parts: [{ description: 'Contact', quantity: 2, paid: 8, sold: 20 }],
    }, { name: 'Ada' });
    expect(ticket).toMatchObject({
      billAmount: 40,
      materials: [{ quantity: 2, cost: 8 }],
    });
    const summary = buildAccountingSummary({ projects: [ticket] });
    expect(summary.jobs[0]).toMatchObject({ materialCost: 16, billed: 40, partsSold: 40, profit: 24 });
  });

  test('hours and rate on a service job show as Job Profit labor', () => {
    const ticket = serviceJobForAccounting({
      _id: 'job1',
      name: 'IP Cameras for property',
      jobNumber: 'A-1006-J0001',
      status: 'scheduled',
      amountDue: 1344,
      paidAmount: 1124,
      hoursWorked: 2,
      hourlyRate: 85,
      laborPay: 170,
      travelPay: 50,
      parts: [{ description: 'Hub', quantity: 1, paid: 265, sold: 328 }],
    }, { _id: 'c1', name: 'Mike Dibble', accountNumber: 'A-1006' });
    const summary = buildAccountingSummary({ projects: [ticket] });
    expect(summary.jobs[0]).toMatchObject({
      laborCost: 170,
      billed: 1344,
      materialCost: 265,
      profit: 1079,
      contribution: 909,
    });
    expect(summary.direct.labor).toBe(170);
    expect(summary.direct.laborHours).toBe(2);
  });

  test('an expense follows a service job or a subcontractor work order', () => {
    const summary = buildAccountingSummary({
      projects: [
        {
          _id: 'svc1',
          name: 'Cameras',
          customerId: 'c1',
          status: 'Billed',
          billAmount: 100,
        },
        subcontractorPartsJob({
          _id: 'wo1',
          workOrderNumber: 'BRK-1',
          siteName: 'Lobby',
          principal: 'Brinks',
          equipmentLines: [{ description: 'Contact', quantity: 1, cost: 8, sold: 15 }],
        }),
      ],
      expenses: [
        { amount: 12, costCenterCode: 'FUEL', customerId: 'c1', projectId: 'svc1' },
        { amount: 9, costCenterCode: 'FUEL', subcontractorWorkOrderId: 'wo1' },
      ],
    });
    expect(summary.jobs.find((job) => job.projectName === 'Cameras')).toMatchObject({
      directExpenseCost: 12,
    });
    expect(summary.jobs.find((job) => job.jobNumber === 'BRK-1')).toMatchObject({
      directExpenseCost: 9,
      laborCost: 0,
    });
    expect(summary.direct.expenses).toBe(21);
  });

  test('a scheduled ticket with no payment stays off the books', () => {
    expect(serviceJobForAccounting({
      name: 'Future visit',
      status: 'scheduled',
      amountDue: 80,
      paidAmount: null,
    })).toBeNull();
  });

  test('a purchase filed as inventory stays an asset until the sale recognizes cost of goods sold', () => {
    const purchase = {
      _id: 'buy',
      postedDate: '2026-05-02',
      amount: -10,
      status: 'categorized',
      categoryCode: 'INVENTORY',
      description: 'LOCK',
    };
    const sale = {
      _id: 'sell',
      postedDate: '2026-06-15',
      amount: 25,
      status: 'categorized',
      categoryCode: 'SALES',
      inventoryLineIds: ['buy'],
    };
    const may = buildAccountingSummary({
      checkingLines: [purchase, sale],
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(may.period.sales).toBe(0);
    expect(may.period.cogs).toBe(0);
    expect(may.period.revenue).toBe(0);
    expect(may.direct.expenses).toBe(0);
    expect(may.indirect.byCostCenter).toEqual([]);
    expect(may.inventory.onHand).toBe(10);

    const june = buildAccountingSummary({
      checkingLines: [purchase, sale],
      from: '2026-06-01',
      to: '2026-06-30',
    });
    expect(june.period.sales).toBe(25);
    expect(june.period.cogs).toBe(10);
    expect(june.period.revenue).toBe(25);
    expect(june.period.otherIncome).toBe(0);
    expect(june.period.contribution).toBe(15);
    expect(june.inventory.onHand).toBe(0);
    expect(june.indirect.byCostCenter).toEqual([]);
  });

  test('a deposit filed to a subcontractor work order is income and not an expense', () => {
    const summary = buildAccountingSummary({
      checkingLines: [{
        postedDate: '2026-06-03',
        amount: 640,
        status: 'categorized',
        categoryCode: 'OFFICE',
        subcontractorWorkOrderId: 'wo1',
      }],
    });
    expect(summary.period.subcontractorIncome).toBe(640);
    expect(summary.period.revenue).toBe(640);
    expect(summary.period.otherIncome).toBe(0);
    expect(summary.indirect.byCostCenter).toEqual([]);
    expect(summary.direct.expenses).toBe(0);
  });

  test('a categorized checking withdrawal hits the P&L and a reconciled one does not', () => {
    const summary = buildAccountingSummary({
      projects: [],
      checkingLines: [
        {
          postedDate: '2026-06-03',
          amount: -45.2,
          status: 'categorized',
          categoryCode: 'FUEL',
        },
        {
          postedDate: '2026-06-04',
          amount: -45.2,
          status: 'matched',
          categoryCode: '',
          match: { kind: 'expense', id: 'e1' },
        },
        {
          postedDate: '2026-06-05',
          amount: -12,
          status: 'uncategorized',
        },
        {
          postedDate: '2026-06-06',
          amount: 500,
          status: 'categorized',
          categoryCode: 'INCOME',
        },
        {
          postedDate: '2026-06-07',
          amount: -200,
          status: 'excluded',
          categoryCode: 'TRANSFER',
        },
        {
          postedDate: '2026-06-08',
          amount: -30,
          status: 'categorized',
          categoryCode: 'TOOLS',
          projectId: 'job1',
        },
      ],
    });
    expect(summary.indirect.byCostCenter).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'FUEL', expenses: 45.2 })])
    );
    expect(summary.direct.expenses).toBe(30);
    expect(summary.period.otherIncome).toBe(500);
    expect(summary.period.revenue).toBe(500);
    expect(summary.checking).toMatchObject({ uncategorized: 1, suggested: 0 });
  });

  test('status paid with no amount entered counts the ticket total as collected', () => {
    const summary = buildAccountingSummary({
      projects: [
        serviceJobForAccounting({
          name: 'Panel',
          jobNumber: 'A-1044-J0002',
          status: 'paid',
          amountDue: 80,
          paidAmount: null,
        }),
      ],
    });
    expect(summary.jobs[0]).toMatchObject({ billed: 80, paid: 80, balance: 0 });
    expect(summary.ar.balance).toBe(0);
  });
});
