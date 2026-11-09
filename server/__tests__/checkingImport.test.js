/**
 * Checking-account CSV import.
 * A full history can be imported, and a later export of the same account
 * skips lines already stored. Withdrawals that match an expense or supplier
 * payment already entered are suggestions to reconcile, not new costs.
 * Cost centers cover expenses. Deposits, transfers, owner draws, and
 * payments already on a job have their own categories so every line can be filed.
 * Nothing hits the P&L until it is categorized, and a reconciled line stays off.
 */

import {
  categorizeCheckingLine,
  inventoryReleaseError,
  noteOnCheckingLine,
  parseCheckingCsv,
  planCheckingImport,
} from '../lib/checkingImport.js';

const SIGNED = [
  'Date,Description,Amount',
  '01/15/2024,SHELL OIL,-45.20',
  '01/16/2024,"CUSTOMER, DEPOSIT",800.00',
].join('\n');

const DEBIT_CREDIT = [
  'Posted Date,Memo,Debit,Credit',
  '01/15/2024,SHELL OIL,45.20,',
  '01/16/2024,CUSTOMER DEPOSIT,,800.00',
].join('\n');

describe('parseCheckingCsv', () => {
  test('reads a signed amount column, including a quoted description', () => {
    const parsed = parseCheckingCsv(SIGNED);
    expect(parsed.error).toBeUndefined();
    expect(parsed.rows).toEqual([
      { postedDate: '2024-01-15', description: 'SHELL OIL', amount: -45.2, checkNumber: '' },
      { postedDate: '2024-01-16', description: 'CUSTOMER, DEPOSIT', amount: 800, checkNumber: '' },
    ]);
  });

  test('reads separate debit and credit columns as money out and money in', () => {
    const parsed = parseCheckingCsv(DEBIT_CREDIT);
    expect(parsed.rows.map((row) => row.amount)).toEqual([-45.2, 800]);
    expect(parsed.rows[0]).toMatchObject({ postedDate: '2024-01-15', description: 'SHELL OIL' });
  });

  test('reads a Debit/Credit column and leaves the running balance out of the amount', () => {
    const parsed = parseCheckingCsv([
      'Date,Description,Debit/Credit,Balance,Name,Additional IMAD/trace ID,Bill due date,Bill number,Bill notes',
      '11/6/2026,"FACEBK *RSGRQBSB24, Wilmington, DE",-2,7290.06,,,,,',
      '11/6/2026,"CURSOR, AI POWERED IDE, SAN FRANCISCO, CA",-21.95,,,,,',
      '11/4/2026,"SHELL, LEOMA, TN",-59.66,7324.01,,,,,',
      '11/7/2026,CUSTOMER PAYMENT,1500,8824.01,,,,,',
    ].join('\n'));
    expect(parsed.error).toBeUndefined();
    expect(parsed.rows).toEqual([
      { postedDate: '2026-11-06', description: 'FACEBK *RSGRQBSB24, Wilmington, DE', amount: -2, checkNumber: '' },
      { postedDate: '2026-11-06', description: 'CURSOR, AI POWERED IDE, SAN FRANCISCO, CA', amount: -21.95, checkNumber: '' },
      { postedDate: '2026-11-04', description: 'SHELL, LEOMA, TN', amount: -59.66, checkNumber: '' },
      { postedDate: '2026-11-07', description: 'CUSTOMER PAYMENT', amount: 1500, checkNumber: '' },
    ]);
  });

  test('rejects a file that has no date and amount columns', () => {
    const parsed = parseCheckingCsv('Note,Balance\nhello,10\n');
    expect(parsed.error).toMatch(/date/i);
    expect(parsed.error).toMatch(/amount|debit/i);
    expect(parsed.rows).toBeUndefined();
  });
});

describe('planCheckingImport', () => {
  test('skips rows already stored when the same export is imported again', () => {
    const first = planCheckingImport({ rows: parseCheckingCsv(SIGNED).rows });
    const second = planCheckingImport({
      rows: parseCheckingCsv(SIGNED).rows,
      storedLines: first.filter((row) => row.disposition !== 'duplicate'),
    });
    expect(first.map((row) => row.disposition)).toEqual(['new', 'new']);
    expect(second.every((row) => row.disposition === 'duplicate')).toBe(true);
  });

  test('keeps two identical charges on the same day and still skips them later', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2024,ATM FEE,-3.00',
      '01/15/2024,ATM FEE,-3.00',
    ].join('\n');
    const rows = parseCheckingCsv(csv).rows;
    const first = planCheckingImport({ rows });
    expect(first).toHaveLength(2);
    expect(first[0].fingerprint).not.toBe(first[1].fingerprint);
    const second = planCheckingImport({ rows, storedLines: first });
    expect(second.every((row) => row.disposition === 'duplicate')).toBe(true);
  });

  test('adds only the new lines when a later export overlaps the history', () => {
    const history = parseCheckingCsv(SIGNED).rows;
    const stored = planCheckingImport({ rows: history });
    const next = parseCheckingCsv([
      'Date,Description,Amount',
      '01/16/2024,"CUSTOMER, DEPOSIT",800.00',
      '02/01/2024,HOME DEPOT,-62.10',
    ].join('\n')).rows;
    const planned = planCheckingImport({ rows: next, storedLines: stored });
    expect(planned.map((row) => row.disposition)).toEqual(['duplicate', 'new']);
    expect(planned[1]).toMatchObject({ description: 'HOME DEPOT', amount: -62.1 });
  });

  test('suggests one existing expense and does not reuse it for a second line', () => {
    const rows = parseCheckingCsv([
      'Date,Description,Amount',
      '01/17/2024,SHELL OIL,-45.20',
      '01/18/2024,SHELL STATION,-45.20',
    ].join('\n')).rows;
    const planned = planCheckingImport({
      rows,
      expenses: [
        { _id: 'e1', date: '2024-01-15', amount: 45.2, payee: 'Shell', description: 'fuel' },
      ],
    });
    expect(planned[0].disposition).toBe('suggested');
    expect(planned[0].suggestion).toMatchObject({ kind: 'expense', id: 'e1' });
    expect(planned[1].disposition).toBe('new');
    expect(planned[1].suggestion).toBeNull();
  });

  test('prefers the expense whose payee appears in the bank description', () => {
    const rows = parseCheckingCsv('Date,Description,Amount\n01/15/2024,SHELL OIL,-45.20\n').rows;
    const planned = planCheckingImport({
      rows,
      expenses: [
        { _id: 'lumber', date: '2024-01-15', amount: 45.2, payee: 'Home Depot', description: 'lumber' },
        { _id: 'fuel', date: '2024-01-16', amount: 45.2, payee: 'Shell', description: 'fuel' },
      ],
    });
    expect(planned[0].suggestion.id).toBe('fuel');
  });

  test('suggests a supplier payment for a withdrawal and ignores a deposit', () => {
    const rows = parseCheckingCsv([
      'Date,Description,Amount',
      '02/02/2024,ADI,-100.00',
      '02/02/2024,ADI REFUND,100.00',
    ].join('\n')).rows;
    const planned = planCheckingImport({
      rows,
      supplierPayments: [
        { _id: 'p1', paidAt: '2024-02-01', amount: 100, note: 'ADI invoice' },
      ],
      expenses: [
        { _id: 'e1', date: '2024-02-02', amount: 80, payee: 'ADI', description: 'parts' },
      ],
    });
    expect(planned[0].suggestion).toMatchObject({ kind: 'supplierPayment', id: 'p1' });
    expect(planned[1].suggestion).toBeNull();
  });

  test('does not suggest an expense outside the three-day window', () => {
    const rows = parseCheckingCsv('Date,Description,Amount\n01/20/2024,SHELL OIL,-45.20\n').rows;
    const planned = planCheckingImport({
      rows,
      expenses: [{ _id: 'e1', date: '2024-01-15', amount: 45.2, payee: 'Shell' }],
    });
    expect(planned[0].disposition).toBe('new');
  });
});

describe('categorizeCheckingLine', () => {
  const withdrawal = {
    description: 'SHELL OIL',
    amount: -45.2,
    status: 'suggested',
    suggestion: { kind: 'expense', id: 'e1', label: 'Expense Shell $45.20 on 2024-01-15' },
  };

  test('confirming a match reconciles the line and keeps it off the books', () => {
    const result = categorizeCheckingLine(withdrawal, { confirmMatch: true });
    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      status: 'matched',
      categoryCode: '',
      match: { kind: 'expense', id: 'e1' },
      suggestion: null,
    });
  });

  test('a cost center files a withdrawal, and a transfer stays off the P&L', () => {
    expect(categorizeCheckingLine(withdrawal, { categoryCode: 'FUEL' }).value).toMatchObject({
      status: 'categorized',
      categoryCode: 'FUEL',
      match: null,
    });
    expect(categorizeCheckingLine(withdrawal, { categoryCode: 'TRANSFER' }).value.status).toBe('excluded');
  });

  test('other income is only for money coming in', () => {
    expect(categorizeCheckingLine(withdrawal, { categoryCode: 'INCOME' }).error).toMatch(/coming in/i);
    expect(categorizeCheckingLine(
      { amount: 800, description: 'DEPOSIT', status: 'uncategorized' },
      { categoryCode: 'INCOME' }
    ).value).toMatchObject({ status: 'categorized', categoryCode: 'INCOME' });
  });

  test('stores a trimmed note on the line without changing its status', () => {
    expect(noteOnCheckingLine(
      { amount: -45.2, status: 'uncategorized', note: '' },
      '  Truck fuel  '
    )).toMatchObject({ status: 'uncategorized', note: 'Truck fuel' });
  });

  test('keeps a note when the line is categorized', () => {
    expect(categorizeCheckingLine(withdrawal, { categoryCode: 'FUEL', note: 'Truck fuel' }).value.note).toBe('Truck fuel');
    expect(categorizeCheckingLine({ ...withdrawal, note: 'Already noted' }, { categoryCode: 'FUEL' }).value.note).toBe('Already noted');
  });

  test('files a deposit on a subcontractor work order and clears any customer job', () => {
    const result = categorizeCheckingLine(
      { amount: 640, description: 'BRINKS PAYMENT', status: 'uncategorized' },
      { categoryCode: 'INCOME', subcontractorWorkOrderId: 'wo1', customerId: 'c1', projectId: 'p1' }
    );
    expect(result.value).toMatchObject({
      status: 'categorized',
      subcontractorWorkOrderId: 'wo1',
      customerId: '',
      projectId: '',
    });
  });

  test('files a purchase as inventory and recognizes that cost when the item is sold', () => {
    const purchase = categorizeCheckingLine(
      { _id: 'buy', amount: -10, description: 'LOCK', status: 'uncategorized' },
      { categoryCode: 'INVENTORY' }
    );
    expect(purchase.value).toMatchObject({
      status: 'categorized',
      categoryCode: 'INVENTORY',
      inventoryLineIds: [],
    });
    expect(categorizeCheckingLine(
      { amount: 25, description: 'CUSTOMER', status: 'uncategorized' },
      { categoryCode: 'INVENTORY' }
    ).error).toMatch(/purchase/i);

    const lots = [{ _id: 'buy', amount: -10, status: 'categorized', categoryCode: 'INVENTORY' }];
    const sale = categorizeCheckingLine(
      { amount: 25, description: 'CUSTOMER', status: 'uncategorized', customerId: 'c1', projectId: 'p1' },
      { categoryCode: 'SALES', inventoryLineIds: ['buy'], subcontractorWorkOrderId: 'wo1' },
      { inventoryLines: lots }
    );
    expect(sale.value).toMatchObject({
      status: 'categorized',
      categoryCode: 'SALES',
      inventoryLineIds: ['buy'],
      customerId: '',
      projectId: '',
      subcontractorWorkOrderId: '',
    });
    expect(categorizeCheckingLine(
      { amount: -10, status: 'uncategorized' },
      { categoryCode: 'SALES' }
    ).error).toMatch(/coming in/i);
    expect(categorizeCheckingLine(
      { amount: 25, status: 'uncategorized' },
      { categoryCode: 'SALES', inventoryLineIds: ['missing'] },
      { inventoryLines: lots }
    ).error).toMatch(/inventory/i);
    expect(categorizeCheckingLine(
      { amount: 25, status: 'uncategorized' },
      { categoryCode: 'SALES', inventoryLineIds: ['buy'] },
      { inventoryLines: lots, soldInventoryIds: ['buy'] }
    ).error).toMatch(/already sold/i);
  });

  test('refuses to clear an inventory purchase that a sale already used', () => {
    expect(inventoryReleaseError(
      { _id: 'buy', categoryCode: 'INVENTORY' },
      'FUEL',
      [{ inventoryLineIds: ['buy'] }]
    )).toMatch(/already sold/i);
    expect(inventoryReleaseError(
      { _id: 'buy', categoryCode: 'INVENTORY' },
      'INVENTORY',
      [{ inventoryLineIds: ['buy'] }]
    )).toBe('');
  });

  test('refuses a match when nothing was suggested', () => {
    expect(categorizeCheckingLine(
      { amount: -10, status: 'uncategorized' },
      { confirmMatch: true }
    ).error).toMatch(/no existing/i);
  });
});
