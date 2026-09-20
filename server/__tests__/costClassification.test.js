/**
 * Phase 1 light ledger: Direct vs Indirect classification.
 * Classification is derived — never stored on the source record.
 */

import {
  classifyExpense,
  classifyLabor,
  expenseAmount,
  laborAmount,
  indirectCostCenterForLabor,
} from '../lib/costClassification.js';
import { COST_CENTER_CODES } from '../lib/costCenters.js';
import { isInInclusiveDateRange, currentMonthRange } from '../lib/dateRange.js';
import { serviceHistoryTypeFromProjectWorkType } from '../lib/projectWorkTypes.js';

describe('costClassification', () => {
  test('seeded cost centers include office, bidding, fuel, and consumables', () => {
    expect(COST_CENTER_CODES).toEqual(
      expect.arrayContaining(['OFFICE', 'BIDDING', 'FUEL', 'CONSUMABLES', 'WARRANTY', 'MISC'])
    );
  });

  test('expense without a job is indirect', () => {
    expect(classifyExpense({ costCenterCode: 'OFFICE', amount: 100 })).toMatchObject({
      costClass: 'indirect',
      reason: 'cost-center-only',
    });
  });

  test('expense with a projectId is direct even for fuel or consumables', () => {
    expect(
      classifyExpense({ costCenterCode: 'FUEL', projectId: 'job1', amount: 40 })
    ).toMatchObject({ costClass: 'direct', reason: 'assigned-to-job' });
    expect(
      classifyExpense({ costCenterCode: 'CONSUMABLES', projectId: 'job1', amount: 8 })
    ).toMatchObject({ costClass: 'direct', reason: 'assigned-to-job' });
  });

  test('install/service/consult labor on a job is direct and billable', () => {
    expect(
      classifyLabor({ workType: 'install', projectId: 'job1', hours: 4, hourlyCost: 50 })
    ).toMatchObject({ costClass: 'direct', billable: true, reason: 'job-labor' });
    expect(
      classifyLabor({ workType: 'service', projectId: 'job1', hours: 1, hourlyCost: 50 })
    ).toMatchObject({ costClass: 'direct', billable: true });
    expect(
      classifyLabor({ workType: 'consult', projectId: 'job1', hours: 1, hourlyCost: 50 })
    ).toMatchObject({ costClass: 'direct', billable: true });
  });

  test('warranty labor on a job is direct and non-billable', () => {
    expect(
      classifyLabor({ workType: 'warranty', projectId: 'job1', hours: 2, hourlyCost: 50 })
    ).toMatchObject({
      costClass: 'direct',
      billable: false,
      reason: 'warranty-on-job',
    });
  });

  test('bidding and admin labor are indirect even if a job is attached', () => {
    expect(
      classifyLabor({ workType: 'bidding', projectId: 'job1', hours: 3, hourlyCost: 40 })
    ).toMatchObject({ costClass: 'indirect', reason: 'overhead-work-type' });
    expect(
      classifyLabor({ workType: 'admin', hours: 8, hourlyCost: 40 })
    ).toMatchObject({ costClass: 'indirect' });
  });

  test('Misc expense without a job is indirect', () => {
    expect(classifyExpense({ costCenterCode: 'MISC', amount: 18 })).toMatchObject({
      costClass: 'indirect',
      reason: 'cost-center-only',
    });
  });

  test('Misc overhead time is indirect even if a job is attached', () => {
    expect(
      classifyLabor({ workType: 'misc', hours: 1, hourlyCost: 40 })
    ).toMatchObject({ costClass: 'indirect', reason: 'overhead-work-type' });
    expect(
      classifyLabor({ workType: 'misc', projectId: 'job1', hours: 1, hourlyCost: 40 })
    ).toMatchObject({ costClass: 'indirect', reason: 'overhead-work-type' });
  });

  test('job labor without a projectId is indirect', () => {
    expect(
      classifyLabor({ workType: 'install', hours: 2, hourlyCost: 50 })
    ).toMatchObject({ costClass: 'indirect', reason: 'no-job' });
  });

  test('labor and expense amounts are hours × rate and amount', () => {
    expect(laborAmount({ hours: 2.5, hourlyCost: 40 })).toBe(100);
    expect(expenseAmount({ amount: 19.99 })).toBe(19.99);
    expect(laborAmount({})).toBe(0);
    expect(expenseAmount({})).toBe(0);
  });

  test('indirect labor maps onto a cost center for overhead grouping', () => {
    expect(indirectCostCenterForLabor({ workType: 'bidding' })).toBe('BIDDING');
    expect(indirectCostCenterForLabor({ workType: 'admin' })).toBe('OFFICE');
    expect(indirectCostCenterForLabor({ workType: 'warranty' })).toBe('WARRANTY');
    expect(indirectCostCenterForLabor({ workType: 'misc' })).toBe('MISC');
    expect(indirectCostCenterForLabor({ workType: 'install' })).toBe('OFFICE');
  });
});

describe('dateRange', () => {
  test('includes dates on the inclusive from/to calendar days', () => {
    expect(isInInclusiveDateRange('2026-09-01T12:00:00.000Z', '2026-09-01', '2026-09-30')).toBe(true);
    expect(isInInclusiveDateRange('2026-08-31T12:00:00.000Z', '2026-09-01', '2026-09-30')).toBe(false);
    expect(isInInclusiveDateRange('2026-10-01T00:00:00.000Z', '2026-09-01', '2026-09-30')).toBe(false);
  });

  test('current month range is UTC first through last day', () => {
    const range = currentMonthRange(new Date('2026-09-20T18:00:00.000Z'));
    expect(range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('project work type', () => {
  test('maps project workType onto service history type', () => {
    expect(serviceHistoryTypeFromProjectWorkType('installation')).toBe('installation');
    expect(serviceHistoryTypeFromProjectWorkType('service')).toBe('service');
    expect(serviceHistoryTypeFromProjectWorkType('consultation')).toBe('consultation');
    expect(serviceHistoryTypeFromProjectWorkType('')).toBe('installation');
  });
});
