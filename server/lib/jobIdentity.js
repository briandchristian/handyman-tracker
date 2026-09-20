/**
 * Customer account numbers and job numbers.
 *
 * Staff language: today's nested project is a Job. Mongo still stores jobs on
 * customer.projects[] and APIs still use projectId.
 *
 * A-1001 / J-1001 are the default sequences. Either number can be edited to
 * match a central-station or shop number. Labels never fall back to "Job".
 */

export const ACCOUNT_PREFIX = 'A-';
export const JOB_PREFIX = 'J-';
export const FIRST_SEQUENCE = 1001;

export function normalizeNumber(value) {
  return String(value || '').trim();
}

function sequentialValue(value, prefix) {
  const raw = normalizeNumber(value);
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`^${escaped}(\\d+)$`, 'i'));
  return match ? Number(match[1]) : null;
}

export function nextSequentialNumber(existing = [], prefix, start = FIRST_SEQUENCE) {
  let max = start - 1;
  for (const value of existing) {
    const parsed = sequentialValue(value, prefix);
    if (parsed != null && parsed > max) max = parsed;
  }
  return `${prefix}${max + 1}`;
}

export function nextAccountNumber(existing = []) {
  return nextSequentialNumber(existing, ACCOUNT_PREFIX);
}

export function nextJobNumber(existing = []) {
  return nextSequentialNumber(existing, JOB_PREFIX);
}

export function numbersEqual(a, b) {
  return normalizeNumber(a).toLowerCase() === normalizeNumber(b).toLowerCase();
}

export function isUniqueNumber(value, existing = [], ignore = '') {
  const normalized = normalizeNumber(value);
  if (!normalized) return false;
  return !existing.some((item) => numbersEqual(item, normalized) && !numbersEqual(item, ignore));
}

export function collectAccountNumbers(customers = []) {
  return (Array.isArray(customers) ? customers : [])
    .map((customer) => normalizeNumber(customer?.accountNumber))
    .filter(Boolean);
}

export function collectJobNumbers(customers = []) {
  const numbers = [];
  for (const customer of Array.isArray(customers) ? customers : []) {
    for (const project of customer?.projects || []) {
      const number = normalizeNumber(project?.jobNumber);
      if (number) numbers.push(number);
    }
  }
  return numbers;
}

export function backfillIdentity(customers = []) {
  const accountNumbers = collectAccountNumbers(customers);
  const jobNumbers = collectJobNumbers(customers);
  return (Array.isArray(customers) ? customers : []).map((customer) => {
    const next = {
      ...customer,
      projects: (customer.projects || []).map((project) => ({ ...project })),
    };
    if (!normalizeNumber(next.accountNumber)) {
      next.accountNumber = nextAccountNumber(accountNumbers);
      accountNumbers.push(next.accountNumber);
    }
    for (const project of next.projects) {
      if (!normalizeNumber(project.jobNumber)) {
        project.jobNumber = nextJobNumber(jobNumbers);
        jobNumbers.push(project.jobNumber);
      }
    }
    return next;
  });
}

export async function ensureJobIdentity(Customer) {
  const customers = await Customer.find({});
  const accountNumbers = collectAccountNumbers(customers);
  const jobNumbers = collectJobNumbers(customers);
  for (const customer of customers) {
    let dirty = false;
    if (!normalizeNumber(customer.accountNumber)) {
      customer.accountNumber = nextAccountNumber(accountNumbers);
      accountNumbers.push(customer.accountNumber);
      dirty = true;
    }
    for (const project of customer.projects || []) {
      if (!normalizeNumber(project.jobNumber)) {
        project.jobNumber = nextJobNumber(jobNumbers);
        jobNumbers.push(project.jobNumber);
        dirty = true;
      }
    }
    if (dirty) await customer.save();
  }
  return customers;
}

export function formatCustomerLabel({ name, accountNumber } = {}) {
  const account = normalizeNumber(accountNumber);
  const displayName = String(name || '').trim();
  if (account && displayName) return `${displayName} · ${account}`;
  if (account) return account;
  if (displayName) return displayName;
  return 'Customer';
}

export function formatJobLabel({ name, jobNumber } = {}) {
  const number = normalizeNumber(jobNumber);
  const displayName = String(name || '').trim();
  const safeName = !displayName || /^job$/i.test(displayName) ? '' : displayName;
  if (number && safeName) return `${number} · ${safeName}`;
  if (number) return number;
  if (safeName) return safeName;
  return 'Untitled job';
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Materials used + job hours + job expenses. Quote worksheet is not included. */
export function jobLinesToDate({ materials = [], laborEntries = [], expenses = [] } = {}) {
  const materialCost = (Array.isArray(materials) ? materials : []).reduce((sum, line) => (
    sum + (Number(line?.quantity) || 0) * (Number(line?.cost) || 0)
  ), 0);
  const laborCost = (Array.isArray(laborEntries) ? laborEntries : []).reduce((sum, entry) => (
    sum + (Number(entry?.hours) || 0) * (Number(entry?.hourlyCost) || 0)
  ), 0);
  const expenseCost = (Array.isArray(expenses) ? expenses : []).reduce((sum, expense) => (
    sum + (Number(expense?.amount) || 0)
  ), 0);
  return money(materialCost + laborCost + expenseCost);
}
