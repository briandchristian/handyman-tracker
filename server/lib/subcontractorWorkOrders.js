/**
 * Brinks / national-account subcontractor work-order tracker.
 *
 * These are principal tickets (work orders), not Christian Security customer
 * install jobs. Totals stay on the work-order source document and are not
 * posted into the Direct/Indirect light ledger or job-profit billed/bid.
 *
 * Amount due from the principal:
 *   laborPay (hours * hourlyRate) + travelPay + reimbursable equipment
 *
 * Brinks reconciliation (paid vs work done):
 *   paidAmount is what Brinks actually remitted. Variance is paid − due
 *   (null until paid is entered). Amount due is not changed by reconciling.
 *
 * A completion/close number from the principal is required before a work
 * order can be marked completed, invoiced, or paid.
 */

export const DEFAULT_PRINCIPAL = 'Brinks';

export const SUBCONTRACTOR_JOB_TYPES = [
  { value: 'install', label: 'Install' },
  { value: 'service', label: 'Service' },
  { value: 'takeover', label: 'Takeover' },
  { value: 'other', label: 'Other' },
];

export const SUBCONTRACTOR_JOB_TYPE_VALUES = SUBCONTRACTOR_JOB_TYPES.map((type) => type.value);

export const SUBCONTRACTOR_STATUSES = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' },
];

export const SUBCONTRACTOR_STATUS_VALUES = SUBCONTRACTOR_STATUSES.map((status) => status.value);

export const DEFAULT_SUBCONTRACTOR_STATUS = 'assigned';
export const DEFAULT_SUBCONTRACTOR_JOB_TYPE = 'install';

export const STATUSES_REQUIRING_COMPLETION_NUMBER = ['completed', 'invoiced', 'paid'];

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function asNonNegative(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return money(amount);
}

export function normalizePrincipal(value) {
  const principal = String(value || '').trim();
  return principal || DEFAULT_PRINCIPAL;
}

export function normalizeJobType(value) {
  return String(value || DEFAULT_SUBCONTRACTOR_JOB_TYPE).trim().toLowerCase();
}

export function isKnownJobType(value) {
  return SUBCONTRACTOR_JOB_TYPE_VALUES.includes(normalizeJobType(value));
}

export function normalizeStatus(value) {
  return String(value || DEFAULT_SUBCONTRACTOR_STATUS).trim().toLowerCase();
}

export function isKnownStatus(value) {
  return SUBCONTRACTOR_STATUS_VALUES.includes(normalizeStatus(value));
}

export function requiresCompletionNumber(status) {
  return STATUSES_REQUIRING_COMPLETION_NUMBER.includes(normalizeStatus(status));
}

export function laborPay({ hoursWorked, hourlyRate } = {}) {
  return money(asNonNegative(hoursWorked) * asNonNegative(hourlyRate));
}

export function equipmentLineTotal(line = {}) {
  if (line.reimbursable === false) return 0;
  return money(asNonNegative(line.quantity) * asNonNegative(line.cost));
}

export function equipmentTotal(lines = []) {
  return money((Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + equipmentLineTotal(line), 0));
}

export function amountDue({ hoursWorked, hourlyRate, travelPay, equipmentLines } = {}) {
  return money(laborPay({ hoursWorked, hourlyRate }) + asNonNegative(travelPay) + equipmentTotal(equipmentLines));
}

/** Paid minus amount due. Null until Brinks paid amount is entered. */
export function reconcileVariance(amountDueValue, paidAmount) {
  if (paidAmount === '' || paidAmount == null) return null;
  const paid = Number(paidAmount);
  if (!Number.isFinite(paid)) return null;
  return money(paid - (Number(amountDueValue) || 0));
}

export function computeWorkOrderTotals(input = {}) {
  const hoursWorked = asNonNegative(input.hoursWorked);
  const hourlyRate = asNonNegative(input.hourlyRate);
  const travel = asNonNegative(input.travelPay);
  const labor = laborPay({ hoursWorked, hourlyRate });
  const equipment = equipmentTotal(input.equipmentLines);
  return {
    hoursWorked,
    hourlyRate,
    travelPay: travel,
    laborPay: labor,
    equipmentTotal: equipment,
    amountDue: money(labor + travel + equipment),
  };
}

function normalizeEquipmentLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      description: String(line?.description || '').trim(),
      sku: String(line?.sku || '').trim(),
      quantity: asNonNegative(line?.quantity),
      cost: asNonNegative(line?.cost),
      reimbursable: line?.reimbursable !== false,
    }))
    .filter((line) => line.description || line.sku || line.quantity || line.cost);
}

function optionalDate(value) {
  if (value == null || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'Invalid date' };
  return date;
}

export function validateWorkOrder(input = {}) {
  const workOrderNumber = String(input.workOrderNumber || '').trim();
  if (!workOrderNumber) {
    return { error: 'Work order / ticket number is required' };
  }

  const jobType = normalizeJobType(input.jobType);
  if (!isKnownJobType(jobType)) {
    return { error: 'Invalid job type' };
  }

  const status = normalizeStatus(input.status);
  if (!isKnownStatus(status)) {
    return { error: 'Invalid status' };
  }

  const completionNumber = String(input.completionNumber || '').trim();
  if (requiresCompletionNumber(status) && !completionNumber) {
    return { error: 'Completion / close number is required to mark complete, invoiced, or paid' };
  }

  const hoursWorked = Number(input.hoursWorked === '' || input.hoursWorked == null ? 0 : input.hoursWorked);
  const hourlyRate = Number(input.hourlyRate === '' || input.hourlyRate == null ? 0 : input.hourlyRate);
  const travelPay = Number(input.travelPay === '' || input.travelPay == null ? 0 : input.travelPay);
  if (!Number.isFinite(hoursWorked) || hoursWorked < 0) {
    return { error: 'hoursWorked must be a non-negative number' };
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    return { error: 'hourlyRate must be a non-negative number' };
  }
  if (!Number.isFinite(travelPay) || travelPay < 0) {
    return { error: 'travelPay must be a non-negative number' };
  }

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

  const equipmentLines = normalizeEquipmentLines(input.equipmentLines);
  const totals = computeWorkOrderTotals({
    hoursWorked,
    hourlyRate,
    travelPay,
    equipmentLines,
  });

  return {
    value: {
      principal: normalizePrincipal(input.principal),
      workOrderNumber,
      completionNumber,
      siteName: String(input.siteName || '').trim(),
      siteAddress: String(input.siteAddress || '').trim(),
      siteCity: String(input.siteCity || '').trim(),
      jobType,
      status,
      scheduledDate,
      completedDate,
      notes: String(input.notes || '').trim(),
      equipmentLines,
      paidAmount,
      paidDate,
      reconciliationNotes: String(input.reconciliationNotes || '').trim(),
      variance: reconcileVariance(totals.amountDue, paidAmount),
      ...totals,
    },
  };
}

export function filterWorkOrdersByStatus(orders = [], status) {
  const wanted = String(status || '').trim();
  if (!wanted) return Array.isArray(orders) ? orders : [];
  const normalized = normalizeStatus(wanted);
  return (Array.isArray(orders) ? orders : []).filter((order) => normalizeStatus(order?.status) === normalized);
}
