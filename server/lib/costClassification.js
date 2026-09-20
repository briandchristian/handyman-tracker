/**
 * Derive Direct vs Indirect for light-ledger source records.
 * Does not persist a costClass flag — callers recompute from projectId and workType.
 */

import { normalizeCostCenterCode } from './costCenters.js';
import {
  DIRECT_LABOR_WORK_TYPES,
  INDIRECT_LABOR_WORK_TYPES,
  normalizeLaborWorkType,
} from './laborWorkTypes.js';

export function hasProject(record = {}) {
  const id = record.projectId;
  return id != null && String(id).trim() !== '';
}

export function expenseAmount(expense = {}) {
  return Number(expense.amount) || 0;
}

export function laborAmount(entry = {}) {
  return (Number(entry.hours) || 0) * (Number(entry.hourlyCost) || 0);
}

export function classifyExpense(expense = {}) {
  if (hasProject(expense)) {
    return {
      costClass: 'direct',
      billable: true,
      reason: 'assigned-to-job',
    };
  }
  return {
    costClass: 'indirect',
    billable: false,
    reason: 'cost-center-only',
  };
}

export function classifyLabor(entry = {}) {
  const workType = normalizeLaborWorkType(entry.workType);
  if (INDIRECT_LABOR_WORK_TYPES.includes(workType)) {
    return {
      costClass: 'indirect',
      billable: false,
      reason: 'overhead-work-type',
    };
  }
  if (!hasProject(entry)) {
    return {
      costClass: 'indirect',
      billable: false,
      reason: 'no-job',
    };
  }
  if (DIRECT_LABOR_WORK_TYPES.includes(workType)) {
    return {
      costClass: 'direct',
      billable: workType !== 'warranty',
      reason: workType === 'warranty' ? 'warranty-on-job' : 'job-labor',
    };
  }
  return {
    costClass: 'indirect',
    billable: false,
    reason: 'unknown-work-type',
  };
}

export function isDirectExpense(expense) {
  return classifyExpense(expense).costClass === 'direct';
}

export function isDirectLabor(entry) {
  return classifyLabor(entry).costClass === 'direct';
}

/**
 * Cost center used when rolling indirect labor into overhead by bucket.
 */
export function indirectCostCenterForLabor(entry = {}) {
  const workType = normalizeLaborWorkType(entry.workType);
  if (workType === 'bidding') return 'BIDDING';
  if (workType === 'warranty') return 'WARRANTY';
  if (workType === 'misc') return 'MISC';
  return 'OFFICE';
}

export function expenseCostCenterCode(expense = {}) {
  return normalizeCostCenterCode(expense.costCenterCode) || 'OFFICE';
}
