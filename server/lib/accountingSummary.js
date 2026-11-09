/**
 * Read-only accounting totals derived from jobs, POs, payments, expenses, labor, and categorized checking lines.
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
import { partPaidTotal } from './jobParts.js';
import { lineTracksInventory, serviceJobLines } from './customerWork.js';
import { checkingBooksEffect, checkingInventoryPosition } from './checkingCategories.js';

/** Qty × unit cost from job materials used only. Never billed, bid, markup, or bid worksheet. */
export function materialCost(project) {
  return (project?.materials || []).reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const cost = line.cost != null && line.cost !== '' ? Number(line.cost) : Number(line.paid) || 0;
    return sum + qty * (Number.isFinite(cost) ? cost : 0);
  }, 0);
}

/** Qty × sold price on material lines. Added to invoice revenue. Blank sold is not revenue. */
export function partsSold(project) {
  return roundMoney((project?.materials || []).reduce((sum, line) => {
    if (line?.sold === '' || line?.sold == null) return sum;
    return sum + (Number(line.quantity) || 0) * (Number(line.sold) || 0);
  }, 0));
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

/** Quoted dollars from the bid a service job was imported from. Charge lines are not the quote. */
function quotedAmountForServiceJob(job, customer) {
  const bidId = String(job?.bidId || '').trim();
  if (!bidId) return 0;
  const bid = (Array.isArray(customer?.bids) ? customer.bids : [])
    .find((item) => String(item?._id || '') === bidId);
  return jobQuotedAmount({ bidAmount: bid?.quotedAmount });
}

/**
 * A service-job ticket charges amountDue and collects paidAmount.
 * A scheduled ticket with no payment is not revenue yet.
 * When the job is linked to a bid, Quoted is that bid's quotedAmount.
 * Hours times the hourly rate on the ticket are Job Profit labor.
 * That labor is already inside amount due, so it does not change billed.
 * The quote stays off billed revenue and profit.
 * Returns null when there is nothing for accounting to post.
 */
export function serviceJobForAccounting(job = {}, customer = {}) {
  const due = roundMoney(job.amountDue);
  const inventoryLines = serviceJobLines(job).filter(lineTracksInventory);
  const partsPaid = partPaidTotal(inventoryLines);
  const partsRevenue = roundMoney(inventoryLines.reduce((sum, line) => {
    if (line?.price === '' || line?.price == null) return sum;
    return sum + (Number(line.quantity) || 0) * (Number(line.price) || 0);
  }, 0));
  const hasPaid = !(job.paidAmount === '' || job.paidAmount == null);
  const status = String(job.status || '').trim().toLowerCase();
  const recognized = status === 'completed' || status === 'invoiced' || status === 'paid' || hasPaid;
  if ((!recognized || due <= 0) && partsPaid <= 0 && partsRevenue <= 0) return null;
  const billedDue = recognized && due > 0 ? due : partsRevenue;
  const paid = hasPaid ? roundMoney(job.paidAmount) : (status === 'paid' ? billedDue : 0);
  const hours = Number(job.hoursWorked) || 0;
  const storedLabor = Number(job.laborPay);
  const ratedLabor = roundMoney(hours * (Number(job.hourlyRate) || 0));
  const laborPay = Number.isFinite(storedLabor) && storedLabor > 0 ? roundMoney(storedLabor) : ratedLabor;
  const activityAt = job.paidDate || job.completedDate || job.scheduledDate || job.createdAt || null;
  let accountingStatus = 'Pending';
  if (status === 'completed' && !hasPaid) accountingStatus = 'Completed';
  if (status === 'invoiced' || status === 'paid' || hasPaid) accountingStatus = 'Billed';
  return {
    _id: job._id,
    customerId: customer._id || customer.customerId || job.customerId || '',
    customerName: customer.name || customer.customerName || '',
    accountNumber: customer.accountNumber || '',
    name: job.name || '',
    jobNumber: job.jobNumber || '',
    workType: job.workType,
    status: accountingStatus,
    billAmount: billedDue,
    bidAmount: quotedAmountForServiceJob(job, customer),
    laborPay,
    laborHours: laborPay > 0 ? hours : 0,
    paidToDate: paid,
    taxRate: 0,
    partsIncludedInBill: true,
    materials: inventoryLines.map((line) => {
      const hasPrice = !(line?.price === '' || line?.price == null);
      return {
        quantity: Number(line.quantity) || 0,
        cost: Number(line.paid ?? line.cost) || 0,
        ...(hasPrice ? { sold: Number(line.price) || 0 } : {}),
      };
    }),
    createdAt: activityAt,
    completedAt: activityAt,
  };
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
    if (record.subcontractorWorkOrderId) return sameId(record.subcontractorWorkOrderId, pid);
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
  checkingLines = [],
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
  const rangedChecking = checkingLines.filter((line) =>
    isInInclusiveDateRange(line.postedDate || line.date, from, to)
  );

  let ticketLabor = 0;
  let ticketHours = 0;
  const jobs = rangedProjects.map((project) => {
    const sold = partsSold(project);
    const billed = project.partsIncludedInBill
      ? roundMoney(jobBilledAmount(project))
      : roundMoney(jobBilledAmount(project) + sold);
    const quoted = jobQuotedAmount(project);
    const paid = Number(project.paidToDate) || 0;
    const materials = materialCost(project);
    const jobLabor = recordsForJob(rangedLabor, project).filter(
      (entry) => classifyLabor(entry).costClass === 'direct'
    );
    const jobExpenses = recordsForJob(rangedExpenses, project).filter(
      (expense) => classifyExpense(expense).costClass === 'direct'
    );
    const onTicket = roundMoney(project.laborPay);
    const onTicketHours = onTicket > 0 ? (Number(project.laborHours) || 0) : 0;
    ticketLabor += onTicket;
    ticketHours += onTicketHours;
    const laborCost = jobLabor.reduce((sum, entry) => sum + laborAmount(entry), 0) + onTicket;
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
      partsSold: sold,
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
  direct.labor += ticketLabor;
  direct.laborHours += ticketHours;

  rangedExpenses.forEach((expense) => {
    const amount = expenseAmount(expense);
    if (classifyExpense(expense).costClass === 'direct') {
      direct.expenses += amount;
    } else {
      addIndirectBucket(expenseCostCenterCode(expense), 'expenses', amount);
    }
  });

  let otherIncome = 0;
  let subcontractorIncome = 0;
  rangedChecking.forEach((line) => {
    const effect = checkingBooksEffect(line);
    otherIncome += effect.income;
    subcontractorIncome += effect.subcontractorIncome || 0;
    if (!effect.expense) return;
    if (effect.projectId) direct.expenses += effect.expense;
    else addIndirectBucket(effect.costCenterCode, 'expenses', effect.expense);
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

  const otherIncomeTotal = roundMoney(otherIncome);
  const subcontractorIncomeTotal = roundMoney(subcontractorIncome);
  const inventory = checkingInventoryPosition(checkingLines, { from, to });
  const revenue = roundMoney(
    jobs.reduce((sum, job) => sum + job.billed, 0) + otherIncomeTotal + subcontractorIncomeTotal + inventory.sales
  );
  const contribution = roundMoney(revenue - direct.total - inventory.cogs);

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
    checking: {
      uncategorized: rangedChecking.filter((line) => line.status === 'uncategorized').length,
      suggested: rangedChecking.filter((line) => line.status === 'suggested').length,
    },
    inventory: {
      onHand: inventory.onHand,
    },
    period: {
      from: from || null,
      to: to || null,
      revenue,
      otherIncome: otherIncomeTotal,
      subcontractorIncome: subcontractorIncomeTotal,
      sales: inventory.sales,
      cogs: inventory.cogs,
      contribution,
      overheadRatePerHour: rateOrNull(indirect.total, direct.laborHours),
      overheadRateOnCost: rateOrNull(indirect.total, direct.total),
    },
  };
}
