/**
 * Customer account numbers and job numbers.
 * Staff language: a Project is a Job. Labels never fall back to the word "Job".
 */

import {
  ACCOUNT_PREFIX,
  JOB_PREFIX,
  backfillIdentity,
  collectAccountNumbers,
  collectJobNumbers,
  formatCustomerLabel,
  formatJobLabel,
  isUniqueNumber,
  jobLinesToDate,
  nextAccountNumber,
  nextJobNumber,
  normalizeNumber,
} from '../lib/jobIdentity.js';

describe('job identity numbers', () => {
  test('starts sequential account and job numbers at 1001', () => {
    expect(ACCOUNT_PREFIX).toBe('A-');
    expect(JOB_PREFIX).toBe('J-');
    expect(nextAccountNumber([])).toBe('A-1001');
    expect(nextJobNumber([])).toBe('J-1001');
  });

  test('increments past the highest sequential number and ignores custom CS numbers', () => {
    expect(nextAccountNumber(['A-1001', 'CS-8891', 'A-1042'])).toBe('A-1043');
    expect(nextJobNumber(['J-1001', 'WO-9', 'J-208'])).toBe('J-1002');
  });

  test('treats numbers as unique case-insensitively after trim', () => {
    expect(isUniqueNumber('A-1042', ['a-1042'])).toBe(false);
    expect(isUniqueNumber('A-1042', ['A-1042'], 'A-1042')).toBe(true);
    expect(isUniqueNumber('CS-8891', ['A-1001'])).toBe(true);
    expect(isUniqueNumber('', ['A-1001'])).toBe(false);
    expect(normalizeNumber('  cs-1  ')).toBe('cs-1');
  });

  test('backfills missing account and job numbers without changing custom values', () => {
    const filled = backfillIdentity([
      {
        name: 'Ada',
        accountNumber: '',
        projects: [{ name: 'Alarm', jobNumber: '' }, { name: 'Cameras', jobNumber: 'J-208' }],
      },
      {
        name: 'Bea',
        accountNumber: 'CS-12',
        projects: [{ name: 'Service' }],
      },
    ]);
    expect(filled[0].accountNumber).toBe('A-1001');
    expect(filled[0].projects[0].jobNumber).toBe('J-1001');
    expect(filled[0].projects[1].jobNumber).toBe('J-208');
    expect(filled[1].accountNumber).toBe('CS-12');
    expect(filled[1].projects[0].jobNumber).toBe('J-1002');
    expect(collectAccountNumbers(filled)).toEqual(['A-1001', 'CS-12']);
    expect(collectJobNumbers(filled)).toEqual(['J-1001', 'J-208', 'J-1002']);
  });
});

describe('job identity labels', () => {
  test('formats customer as name · account number', () => {
    expect(formatCustomerLabel({ name: 'Animal Rescue', accountNumber: 'A-1042' }))
      .toBe('Animal Rescue · A-1042');
    expect(formatCustomerLabel({ name: '', accountNumber: 'CS-12' })).toBe('CS-12');
    expect(formatCustomerLabel({ name: 'Ada' })).toBe('Ada');
    expect(formatCustomerLabel({})).toBe('Customer');
  });

  test('formats job as number · name and never returns the word Job', () => {
    expect(formatJobLabel({ name: 'Warehouse cameras', jobNumber: 'J-208' }))
      .toBe('J-208 · Warehouse cameras');
    expect(formatJobLabel({ jobNumber: 'J-208' })).toBe('J-208');
    expect(formatJobLabel({ name: 'Alarm' })).toBe('Alarm');
    expect(formatJobLabel({})).toBe('Untitled job');
    expect(formatJobLabel({})).not.toBe('Job');
    expect(formatJobLabel({ name: 'Job' })).toBe('Untitled job');
  });
});

describe('job lines to date', () => {
  test('adds materials used, job hours, and job expenses', () => {
    expect(jobLinesToDate({
      materials: [{ quantity: 2, cost: 10 }],
      laborEntries: [{ hours: 1.5, hourlyCost: 40 }],
      expenses: [{ amount: 15 }],
    })).toBe(95);
    expect(jobLinesToDate({})).toBe(0);
  });
});
