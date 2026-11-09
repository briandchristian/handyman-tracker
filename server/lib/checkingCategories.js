/**
 * Categories for a checking-account line.
 * Cost centers file expenses the way the ledger already does.
 * The other categories cover deposits, transfers, owner activity,
 * and customer payments that are already on a job.
 * Those are not expenses, so a cost center alone cannot file every bank line.
 * A purchase filed as Inventory is an asset. It stays off the P&L until a
 * sale names it, and that sale records the income and the cost of goods sold.
 */

import { COST_CENTERS, normalizeCostCenterCode } from './costCenters.js';
import { isInInclusiveDateRange } from './dateRange.js';

export const CHECKING_SPECIAL_CATEGORIES = [
  { code: 'INVENTORY', name: 'Inventory', effect: 'asset' },
  { code: 'SALES', name: 'Sales', effect: 'sale' },
  { code: 'INCOME', name: 'Other income', effect: 'income' },
  { code: 'JOB_PAYMENT', name: 'Customer payment already on a job', effect: 'exclude' },
  { code: 'TRANSFER', name: 'Transfer', effect: 'exclude' },
  { code: 'OWNER', name: 'Owner draw or contribution', effect: 'exclude' },
];

export function checkingCategoryChoices() {
  return [
    ...COST_CENTERS.map((center) => ({
      code: center.code,
      name: center.name,
      effect: 'expense',
    })),
    ...CHECKING_SPECIAL_CATEGORIES,
  ];
}

export function checkingCategory(code) {
  const normalized = normalizeCostCenterCode(code);
  return checkingCategoryChoices().find((item) => item.code === normalized) || null;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** What a stored checking line contributes. Uncategorized, suggested, matched, and excluded lines contribute nothing. Inventory and sales are totaled separately so a purchase is not an expense. */
export function checkingBooksEffect(line = {}) {
  const none = {
    expense: 0,
    income: 0,
    subcontractorIncome: 0,
    costCenterCode: '',
    projectId: '',
    subcontractorWorkOrderId: '',
  };
  if (line.status !== 'categorized') return none;
  const amount = roundMoney(line.amount);
  const workOrderId = line.subcontractorWorkOrderId ? String(line.subcontractorWorkOrderId) : '';
  if (workOrderId && amount > 0) {
    return { ...none, subcontractorIncome: amount, subcontractorWorkOrderId: workOrderId };
  }
  const choice = checkingCategory(line.categoryCode);
  if (!choice || choice.effect === 'exclude' || choice.effect === 'asset' || choice.effect === 'sale') return none;
  if (choice.effect === 'income') {
    return amount > 0 ? { ...none, income: amount } : none;
  }
  const expense = roundMoney(-amount);
  if (!expense) return none;
  return {
    expense,
    income: 0,
    costCenterCode: choice.code,
    projectId: line.projectId ? String(line.projectId) : '',
  };
}

function inventoryPurchaseCost(line = {}) {
  if (line.status !== 'categorized') return 0;
  const choice = checkingCategory(line.categoryCode);
  if (!choice || choice.effect !== 'asset') return 0;
  const amount = roundMoney(line.amount);
  if (!(amount < 0)) return 0;
  return roundMoney(-amount);
}

/**
 * Inventory still on the shelf, plus sales and cost of goods sold in the period.
 * The cost is recognized on the sale date, even when the purchase was earlier.
 */
export function checkingInventoryPosition(lines = [], { from = null, to = null } = {}) {
  const list = Array.isArray(lines) ? lines : [];
  const byId = new Map();
  list.forEach((line) => {
    const id = String(line._id || line.id || '');
    if (id) byId.set(id, line);
  });

  const consumed = new Set();
  const soldThrough = new Set();
  let sales = 0;
  let cogs = 0;

  list.forEach((line) => {
    if (line.status !== 'categorized') return;
    const choice = checkingCategory(line.categoryCode);
    if (!choice || choice.effect !== 'sale') return;
    const posted = line.postedDate || line.date;
    const amount = roundMoney(line.amount);
    const inPeriod = isInInclusiveDateRange(posted, from, to);
    if (inPeriod && amount > 0) sales += amount;
    const soldByPeriodEnd = isInInclusiveDateRange(posted, null, to);
    (Array.isArray(line.inventoryLineIds) ? line.inventoryLineIds : []).forEach((rawId) => {
      const id = String(rawId || '');
      if (!id || consumed.has(id)) return;
      const cost = inventoryPurchaseCost(byId.get(id));
      if (!cost) return;
      consumed.add(id);
      if (inPeriod) cogs += cost;
      if (soldByPeriodEnd) soldThrough.add(id);
    });
  });

  let onHand = 0;
  list.forEach((line) => {
    const id = String(line._id || line.id || '');
    if (id && soldThrough.has(id)) return;
    const posted = line.postedDate || line.date;
    if (!isInInclusiveDateRange(posted, null, to)) return;
    onHand += inventoryPurchaseCost(line);
  });

  return {
    sales: roundMoney(sales),
    cogs: roundMoney(cogs),
    onHand: roundMoney(onHand),
  };
}
