/**
 * Customer jobs are single tickets with charge lines, opened like a work order.
 * Amount due is hours × rate + travel + charge lines. Variance is paid − due.
 * A bid is a separate quote. A project only groups tickets and does not start a job.
 */

import { laborPay, reconcileVariance } from './subcontractorWorkOrders.js';
import { PROJECT_WORK_TYPE_VALUES, DEFAULT_PROJECT_WORK_TYPE } from './projectWorkTypes.js';

export const SERVICE_JOB_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' },
];

export const SERVICE_JOB_STATUS_VALUES = SERVICE_JOB_STATUSES.map((status) => status.value);
export const DEFAULT_SERVICE_JOB_STATUS = 'scheduled';

/** A recorded payment counts as paid even when the ticket status was left on an earlier step. */
export function serviceJobHasPayment(job = {}) {
  return !(job.paidAmount === '' || job.paidAmount == null);
}

export function serviceJobMatchesStatus(job = {}, statusFilter = '') {
  const wanted = String(statusFilter || '').trim().toLowerCase();
  if (!wanted) return true;
  const status = String(job.status || '').trim().toLowerCase();
  if (wanted === 'paid') return status === 'paid' || serviceJobHasPayment(job);
  return status === wanted;
}

export const BID_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'revised', label: 'Revised' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

export const BID_STATUS_VALUES = BID_STATUSES.map((status) => status.value);
export const DEFAULT_BID_STATUS = 'draft';

const RECORD_KIND = { bid: 'B', job: 'J', project: 'P' };
const RECORD_NUMBER_WIDTH = 4;

const WORK_TYPE_ALIASES = {
  install: 'installation',
  consult: 'consultation',
};

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function asNonNegative(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return money(amount);
}

function optionalDate(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'Invalid date' };
  return date;
}

function normalizeWorkType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return DEFAULT_PROJECT_WORK_TYPE;
  const mapped = WORK_TYPE_ALIASES[raw] || raw;
  return PROJECT_WORK_TYPE_VALUES.includes(mapped) ? mapped : null;
}

function normalizeChoice(value, allowed, fallback) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  return allowed.includes(raw) ? raw : null;
}

export function chargeLineTotal(line = {}) {
  return money(asNonNegative(line.quantity) * asNonNegative(line.price));
}

export function linesTotal(lines = []) {
  return money((Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + chargeLineTotal(line), 0));
}

function normalizeChargeLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      description: String(line?.description || '').trim(),
      quantity: asNonNegative(line?.quantity),
      price: asNonNegative(line?.price),
    }))
    .filter((line) => line.description || line.quantity || line.price);
}

export function computeServiceJobTotals({ hoursWorked, hourlyRate, travelPay, chargeLines } = {}) {
  const labor = laborPay({ hoursWorked, hourlyRate });
  const travel = asNonNegative(travelPay);
  const charges = linesTotal(chargeLines);
  return {
    laborPay: labor,
    travelPay: travel,
    linesTotal: charges,
    amountDue: money(labor + travel + charges),
  };
}

function readNonNegative(value, label) {
  if (value === '' || value == null) return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: `${label} must be a non-negative number` };
  }
  return amount;
}

export function validateServiceJob(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return { error: 'Job name is required' };

  const workType = normalizeWorkType(input.workType);
  if (!workType) return { error: 'Invalid work type' };

  const status = normalizeChoice(input.status, SERVICE_JOB_STATUS_VALUES, DEFAULT_SERVICE_JOB_STATUS);
  if (!status) return { error: 'Invalid status' };

  const hoursWorked = readNonNegative(input.hoursWorked, 'hoursWorked');
  if (hoursWorked?.error) return hoursWorked;
  const hourlyRate = readNonNegative(input.hourlyRate, 'hourlyRate');
  if (hourlyRate?.error) return hourlyRate;
  const travelPay = readNonNegative(input.travelPay, 'travelPay');
  if (travelPay?.error) return travelPay;

  const paidRaw = input.paidAmount;
  const hasPaid = !(paidRaw === '' || paidRaw == null);
  const paidAmount = hasPaid ? Number(paidRaw) : null;
  if (hasPaid && (!Number.isFinite(paidAmount) || paidAmount < 0)) {
    return { error: 'paidAmount must be a non-negative number' };
  }

  const scheduledDate = optionalDate(input.scheduledDate);
  if (scheduledDate?.error) return { error: scheduledDate.error };
  const completedDate = optionalDate(input.completedDate);
  if (completedDate?.error) return { error: completedDate.error };
  const paidDate = optionalDate(input.paidDate);
  if (paidDate?.error) return { error: paidDate.error };

  const chargeLines = normalizeChargeLines(input.chargeLines);
  const totals = computeServiceJobTotals({ hoursWorked, hourlyRate, travelPay, chargeLines });

  return {
    value: {
      name,
      siteName: String(input.siteName || '').trim(),
      siteAddress: String(input.siteAddress || '').trim(),
      siteCity: String(input.siteCity || '').trim(),
      workType,
      status,
      scheduledDate,
      completedDate,
      notes: String(input.notes || '').trim(),
      chargeLines,
      paidAmount,
      paidDate,
      variance: reconcileVariance(totals.amountDue, paidAmount),
      planId: String(input.planId || '').trim(),
      bidId: String(input.bidId || '').trim(),
      hoursWorked: asNonNegative(hoursWorked),
      hourlyRate: asNonNegative(hourlyRate),
      ...totals,
    },
  };
}

function normalizeBidLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      description: String(line?.description || '').trim(),
      quantity: asNonNegative(line?.quantity),
      estimate: asNonNegative(line?.estimate),
    }))
    .filter((line) => line.description || line.quantity || line.estimate);
}

function bidLinesTotal(lines = []) {
  return money((Array.isArray(lines) ? lines : []).reduce((sum, line) => (
    sum + money(asNonNegative(line.quantity) * asNonNegative(line.estimate))
  ), 0));
}

export function validateBid(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return { error: 'Bid name is required' };

  const status = normalizeChoice(input.status, BID_STATUS_VALUES, DEFAULT_BID_STATUS);
  if (!status) return { error: 'Invalid bid status' };

  const lines = normalizeBidLines(input.lines);
  const total = bidLinesTotal(lines);
  const rawQuoted = input.quotedAmount;
  const hasQuoted = !(rawQuoted === '' || rawQuoted == null);
  const quotedAmount = hasQuoted ? Number(rawQuoted) : total;
  if (hasQuoted && (!Number.isFinite(quotedAmount) || quotedAmount < 0)) {
    return { error: 'quotedAmount must be a non-negative number' };
  }

  return {
    value: {
      name,
      description: String(input.description || '').trim(),
      status,
      notes: String(input.notes || '').trim(),
      planId: String(input.planId || '').trim(),
      lines,
      linesTotal: total,
      quotedAmount: money(quotedAmount),
    },
  };
}

export function validatePlan(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return { error: 'Project name is required' };
  const targetDate = optionalDate(input.targetDate);
  if (targetDate?.error) return { error: targetDate.error };
  return {
    value: {
      name,
      description: String(input.description || '').trim(),
      targetDate,
    },
  };
}

/**
 * A-1001-J0001, A-1001-B0001, and A-1001-P0001.
 * The sequence belongs to that customer and that kind. Staff do not type it.
 */
export function nextCustomerRecordNumber(accountNumber, kind, existing = []) {
  const account = String(accountNumber || '').trim();
  if (!account) return { error: 'Customer account number is required' };
  const letter = RECORD_KIND[kind];
  if (!letter) return { error: 'Invalid record kind' };
  const escaped = account.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-${letter}(\\d+)$`, 'i');
  let max = 0;
  for (const value of existing) {
    const match = String(value || '').trim().match(pattern);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (parsed > max) max = parsed;
  }
  return { value: `${account}-${letter}${String(max + 1).padStart(RECORD_NUMBER_WIDTH, '0')}` };
}

export function planRollup(planId, { jobs = [], bids = [] } = {}) {
  const id = String(planId || '');
  const attachedJobs = (Array.isArray(jobs) ? jobs : []).filter((job) => String(job?.planId || '') === id);
  const attachedBids = (Array.isArray(bids) ? bids : []).filter((bid) => String(bid?.planId || '') === id);
  const paid = attachedJobs.reduce((sum, job) => {
    if (job?.paidAmount == null || job.paidAmount === '') return sum;
    return sum + (Number(job.paidAmount) || 0);
  }, 0);
  return {
    jobCount: attachedJobs.length,
    bidCount: attachedBids.length,
    amountDue: money(attachedJobs.reduce((sum, job) => sum + (Number(job.amountDue) || 0), 0)),
    paid: money(paid),
    quoted: money(attachedBids.reduce((sum, bid) => sum + (Number(bid.quotedAmount) || 0), 0)),
  };
}
