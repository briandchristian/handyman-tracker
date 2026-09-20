import { buildPeriodLedgerRows, filterPeriodLedgerRows } from '../periodLedger';

describe('periodLedger', () => {
  test('builds dated expense and time rows instead of lumping totals', () => {
    const rows = buildPeriodLedgerRows({
      expenses: [
        {
          _id: 'e1',
          date: '2026-09-08T00:00:00.000Z',
          amount: 45.5,
          costCenterCode: 'FUEL',
          payee: 'Shell',
          description: 'Trip to Murfreesboro',
        },
      ],
      laborEntries: [
        {
          _id: 't1',
          date: '2026-09-09T00:00:00.000Z',
          hours: 2,
          hourlyCost: 40,
          workType: 'bidding',
          notes: 'Site survey',
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      source: 'time',
      date: '2026-09-09',
      costClass: 'indirect',
      category: 'Bidding',
      hours: 2,
      amount: 80,
      notes: 'Site survey',
    });
    expect(rows[1]).toMatchObject({
      source: 'expense',
      date: '2026-09-08',
      costClass: 'indirect',
      category: 'Fuel',
      amount: 45.5,
      payee: 'Shell',
      notes: 'Trip to Murfreesboro',
    });
  });

  test('can filter the sub-ledger to indirect rows only', () => {
    const rows = buildPeriodLedgerRows({
      expenses: [
        { _id: 'e1', amount: 10, costCenterCode: 'OFFICE', date: '2026-09-01' },
        { _id: 'e2', amount: 5, costCenterCode: 'FUEL', projectId: 'job1', date: '2026-09-02' },
      ],
    });
    expect(filterPeriodLedgerRows(rows, 'indirect').map((row) => row.id)).toEqual(['e1']);
    expect(filterPeriodLedgerRows(rows, 'direct').map((row) => row.id)).toEqual(['e2']);
  });

  test('labels a job by number and name instead of Customer — Project', () => {
    const rows = buildPeriodLedgerRows({
      expenses: [
        { _id: 'e2', amount: 5, costCenterCode: 'FUEL', projectId: 'job1', date: '2026-09-02' },
      ],
      jobs: [{ projectId: 'job1', projectName: 'Warehouse cameras', jobNumber: 'J-208' }],
    });
    expect(rows[0].job).toBe('J-208 · Warehouse cameras');
    expect(rows[0].job).not.toMatch(/Customer —/);
  });
});
