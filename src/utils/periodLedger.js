/**
 * Flatten expenses and labor into dated source-document rows for the
 * accounting sub-ledger. Totals stay on the summary; this is the drill-down.
 */

import { costCenterName } from '../../server/lib/costCenters.js';
import { LABOR_WORK_TYPES } from '../../server/lib/laborWorkTypes.js';
import {
  classifyExpense,
  classifyLabor,
  expenseAmount,
  laborAmount,
} from '../../server/lib/costClassification.js';
import { formatJobLabel } from '../../server/lib/jobIdentity.js';

function isoDay(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function jobLabel(record, jobs = []) {
  if (!record?.projectId) return '';
  const match = jobs.find((job) =>
    String(job.projectId) === String(record.projectId)
    && (!record.customerId || String(job.customerId) === String(record.customerId))
  );
  if (!match) return formatJobLabel({});
  return formatJobLabel({ name: match.projectName || match.name, jobNumber: match.jobNumber });
}

function laborTypeLabel(workType) {
  return LABOR_WORK_TYPES.find((type) => type.value === workType)?.label || workType || '';
}

export function buildPeriodLedgerRows({ expenses = [], laborEntries = [], jobs = [] } = {}) {
  const expenseRows = (expenses || []).map((expense) => {
    const classified = classifyExpense(expense);
    return {
      id: String(expense._id || ''),
      source: 'expense',
      sourceId: expense._id,
      date: isoDay(expense.date || expense.createdAt),
      sortAt: new Date(expense.date || expense.createdAt || 0).getTime(),
      costClass: classified.costClass,
      category: costCenterName(expense.costCenterCode),
      workType: '',
      hours: null,
      amount: expenseAmount(expense),
      payee: expense.payee || '',
      notes: expense.description || '',
      job: jobLabel(expense, jobs),
    };
  });

  const laborRows = (laborEntries || []).map((entry) => {
    const classified = classifyLabor(entry);
    return {
      id: String(entry._id || ''),
      source: 'time',
      sourceId: entry._id,
      date: isoDay(entry.date || entry.createdAt),
      sortAt: new Date(entry.date || entry.createdAt || 0).getTime(),
      costClass: classified.costClass,
      category: laborTypeLabel(entry.workType),
      workType: entry.workType || '',
      hours: Number(entry.hours) || 0,
      amount: laborAmount(entry),
      payee: '',
      notes: entry.notes || '',
      job: jobLabel(entry, jobs),
    };
  });

  return [...expenseRows, ...laborRows].sort((a, b) => (b.sortAt || 0) - (a.sortAt || 0) || a.id.localeCompare(b.id));
}

export function filterPeriodLedgerRows(rows = [], costClass = '') {
  if (!costClass) return rows;
  return rows.filter((row) => row.costClass === costClass);
}
