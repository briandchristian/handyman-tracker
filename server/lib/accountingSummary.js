/**
 * Read-only accounting totals derived from jobs, POs, payments, expenses, and labor.
 * Does not post new ledger rows — it summarizes source records.
 * Direct vs Indirect is derived; remaining overhead is not allocated onto jobs.
 */

import {
  classifyExpense,
  classifyLabor,
  expenseAmount,
  laborAmount,
  expenseCostCenterCode,
  indirectCostCenterForLabor,
} from './costClassification.js';
import { COST_CENTERS, costCenterName } from './costCenters.js';
import { isInInclusiveDateRange, projectActivityDate } from './dateRange.js';
import { normalizeProjectWorkType } from './projectWorkTypes.js';
import { formatCustomerLabel, formatJobLabel } from './jobIdentity.js';

/** Qty × unit cost from job materials used only. Never billed, bid, markup, or bid worksheet. */
export function materialCost(project) {
  return (project?.materials || []).reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const cost = Number(line.cost) || 0;
    return sum + qty * cost;
  }, 0);
}

/** Qty × estimate on the bid worksheet. Quote only — not Job Profit material cost. */
export function bidWorksheetTotal(project) {
  return (project?.bidMaterials || []).reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const estimate = Number(line.estimate) || 0;
    return sum + qty * estimate;
  }, 0);
}

/** Invoice / Job Profit revenue. Never the bid — a quote is not billed. */
export function jobBilledAmount(project) {
  const billed = Number(project?.billAmount);
  return Number.isFinite(billed) && billed > 0 ? billed : 0;
}

/** Bid / quote only. Not used as cost or as Job Profit revenue. */
export function jobQuotedAmount(project) {
  const quoted = Number(project?.bidAmount);
  return Number.isFinite(quoted) && quoted > 0 ? quoted : 0;
}

export function isOpenReceivable(project) {
  const billed = jobBilledAmount(project);
  if (billed <= 0) return false;
  const status = project?.status || '';
  return status === 'Billed' || status === 'Completed';
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sameId(a, b) {
  return String(a ?? '') === String(b ?? '');
}

function projectIdOf(project) {
  return project?._id || project?.projectId || project?.id || '';
}

function recordsForJob(records, project) {
  const pid = projectIdOf(project);
  const cid = project?.customerId;
  return (records || []).filter((record) => {
    if (!sameId(record.projectId, pid)) return false;
    if (record.customerId && cid && !sameId(record.customerId, cid)) return false;
    return true;
  });
}

function emptyDirect() {
  return { materials: 0, labor: 0, expenses: 0, total: 0, laborHours: 0 };
}

function emptyIndirect() {
  return { labor: 0, expenses: 0, total: 0, laborHours: 0, byCostCenter: [] };
}

function rateOrNull(numerator, denominator) {
  if (!denominator) return null;
  return roundMoney(numerator / denominator);
}

export function buildAccountingSummary({
  projects = [],
  purchaseOrders = [],
  supplierPayments = [],
  expenses = [],
  laborEntries = [],
  from = null,
  to = null,
} = {}) {
  const rangedExpenses = expenses.filter((expense) =>
    isInInclusiveDateRange(expense.date || expense.createdAt, from, to)
  );
  const rangedLabor = laborEntries.filter((entry) =>
    isInInclusiveDateRange(entry.date || entry.createdAt, from, to)
  );
  const rangedProjects = projects.filter((project) =>
    isInInclusiveDateRange(projectActivityDate(project), from, to)
  );

  const jobs = rangedProjects.map((project) => {
    const billed = jobBilledAmount(project);
    const quoted = jobQuotedAmount(project);
    const paid = Number(project.paidToDate) || 0;
    const materials = materialCost(project);
    const jobLabor = recordsForJob(rangedLabor, project).filter(
      (entry) => classifyLabor(entry).costClass === 'direct'
    );
    const jobExpenses = recordsForJob(rangedExpenses, project).filter(
      (expense) => classifyExpense(expense).costClass === 'direct'
    );
    const laborCost = jobLabor.reduce((sum, entry) => sum + laborAmount(entry), 0);
    const directExpenseCost = jobExpenses.reduce((sum, expense) => sum + expenseAmount(expense), 0);
    const jobCost = materials + laborCost + directExpenseCost;
    const taxRate = Number(project.taxRate) || 0;
    const tax = roundMoney(billed * (taxRate / 100));
    return {
      customerId: project.customerId ? String(project.customerId) : '',
      projectId: projectIdOf(project) ? String(projectIdOf(project)) : '',
      customerName: project.customerName || '',
      accountNumber: project.accountNumber || '',
      customerLabel: formatCustomerLabel({
        name: project.customerName,
        accountNumber: project.accountNumber,
      }),
      projectName: project.name || '',
      jobNumber: project.jobNumber || '',
      jobLabel: formatJobLabel({ name: project.name, jobNumber: project.jobNumber }),
      status: project.status || '',
      workType: normalizeProjectWorkType(project.workType),
      quoted: roundMoney(quoted),
      billed: roundMoney(billed),
      paid: roundMoney(paid),
      balance: roundMoney(billed - paid),
      materialCost: roundMoney(materials),
      laborCost: roundMoney(laborCost),
      directExpenseCost: roundMoney(directExpenseCost),
      jobCost: roundMoney(jobCost),
      profit: roundMoney(billed - materials),
      contribution: roundMoney(billed - jobCost),
      tax,
    };
  });

  // AR is a point-in-time balance: always from all projects, not the P&L range.
  const allJobsForAr = projects.map((project) => {
    const billed = jobBilledAmount(project);
    const paid = Number(project.paidToDate) || 0;
    const taxRate = Number(project.taxRate) || 0;
    return {
      billed: roundMoney(billed),
      paid: roundMoney(paid),
      tax: roundMoney(billed * (taxRate / 100)),
      open: isOpenReceivable(project),
    };
  });
  const openAr = allJobsForAr.filter((job) => job.open);
  const arBilled = roundMoney(openAr.reduce((sum, job) => sum + job.billed, 0));
  const arPaid = roundMoney(openAr.reduce((sum, job) => sum + job.paid, 0));

  const apPaid = roundMoney(
    supplierPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  );
  const apOpen = roundMoney(
    purchaseOrders
      .filter((po) => po.status === 'Received')
      .reduce((sum, po) => sum + (Number(po.total) || 0), 0)
  );

  const direct = emptyDirect();
  direct.materials = roundMoney(jobs.reduce((sum, job) => sum + job.materialCost, 0));

  const indirectBuckets = new Map(
    COST_CENTERS.map((center) => [center.code, { code: center.code, name: center.name, expenses: 0, labor: 0, total: 0 }])
  );

  function addIndirectBucket(code, field, amount) {
    const key = code || 'OFFICE';
    if (!indirectBuckets.has(key)) {
      indirectBuckets.set(key, { code: key, name: costCenterName(key), expenses: 0, labor: 0, total: 0 });
    }
    const bucket = indirectBuckets.get(key);
    bucket[field] += amount;
    bucket.total += amount;
  }

  rangedLabor.forEach((entry) => {
    const amount = laborAmount(entry);
    const hours = Number(entry.hours) || 0;
    if (classifyLabor(entry).costClass === 'direct') {
      direct.labor += amount;
      direct.laborHours += hours;
    } else {
      addIndirectBucket(indirectCostCenterForLabor(entry), 'labor', amount);
    }
  });

  rangedExpenses.forEach((expense) => {
    const amount = expenseAmount(expense);
    if (classifyExpense(expense).costClass === 'direct') {
      direct.expenses += amount;
    } else {
      addIndirectBucket(expenseCostCenterCode(expense), 'expenses', amount);
    }
  });

  direct.labor = roundMoney(direct.labor);
  direct.expenses = roundMoney(direct.expenses);
  direct.laborHours = roundMoney(direct.laborHours);
  direct.total = roundMoney(direct.materials + direct.labor + direct.expenses);

  const byCostCenter = [...indirectBuckets.values()]
    .map((bucket) => ({
      ...bucket,
      expenses: roundMoney(bucket.expenses),
      labor: roundMoney(bucket.labor),
      total: roundMoney(bucket.total),
    }))
    .filter((bucket) => bucket.total !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));

  const indirectLabor = roundMoney(byCostCenter.reduce((sum, bucket) => sum + bucket.labor, 0));
  const indirectExpenses = roundMoney(byCostCenter.reduce((sum, bucket) => sum + bucket.expenses, 0));
  const indirectHours = roundMoney(
    rangedLabor
      .filter((entry) => classifyLabor(entry).costClass === 'indirect')
      .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0)
  );

  const indirect = {
    labor: indirectLabor,
    expenses: indirectExpenses,
    total: roundMoney(indirectLabor + indirectExpenses),
    laborHours: indirectHours,
    byCostCenter,
  };

  const revenue = roundMoney(jobs.reduce((sum, job) => sum + job.billed, 0));
  const contribution = roundMoney(revenue - direct.total);

  return {
    ar: {
      billed: arBilled,
      paid: arPaid,
      balance: roundMoney(arBilled - arPaid),
    },
    ap: {
      receivedUnpaid: apOpen,
      paid: apPaid,
      balance: apOpen,
    },
    taxCollected: roundMoney(openAr.reduce((sum, job) => sum + job.tax, 0)),
    jobs,
    direct,
    indirect,
    period: {
      from: from || null,
      to: to || null,
      revenue,
      contribution,
      overheadRatePerHour: rateOrNull(indirect.total, direct.laborHours),
      overheadRateOnCost: rateOrNull(indirect.total, direct.total),
    },
  };
}
