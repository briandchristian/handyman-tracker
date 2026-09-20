/**
 * Subcontractor work-order math and status rules.
 * Labor + travel + reimbursable equipment = amount due from the principal.
 * Completed / invoiced / paid require a completion (close) number.
 */

import {
  DEFAULT_PRINCIPAL,
  DEFAULT_SUBCONTRACTOR_JOB_TYPE,
  DEFAULT_SUBCONTRACTOR_STATUS,
  STATUSES_REQUIRING_COMPLETION_NUMBER,
  SUBCONTRACTOR_JOB_TYPE_VALUES,
  SUBCONTRACTOR_STATUS_VALUES,
  amountDue,
  computeWorkOrderTotals,
  reconcileVariance,
  equipmentLineTotal,
  equipmentTotal,
  filterWorkOrdersByStatus,
  isKnownJobType,
  isKnownStatus,
  laborPay,
  normalizeJobType,
  normalizePrincipal,
  normalizeStatus,
  requiresCompletionNumber,
  validateWorkOrder,
} from '../lib/subcontractorWorkOrders.js';

describe('subcontractor work-order constants', () => {
  test('defaults to Brinks and work-order statuses used by national-account tickets', () => {
    expect(DEFAULT_PRINCIPAL).toBe('Brinks');
    expect(DEFAULT_SUBCONTRACTOR_STATUS).toBe('assigned');
    expect(DEFAULT_SUBCONTRACTOR_JOB_TYPE).toBe('install');
    expect(SUBCONTRACTOR_JOB_TYPE_VALUES).toEqual(['install', 'service', 'takeover', 'other']);
    expect(SUBCONTRACTOR_STATUS_VALUES).toEqual([
      'assigned',
      'scheduled',
      'completed',
      'invoiced',
      'paid',
    ]);
    expect(STATUSES_REQUIRING_COMPLETION_NUMBER).toEqual(['completed', 'invoiced', 'paid']);
  });
});

describe('labor + travel + equipment due', () => {
  test('labor pay is hours times hourly rate', () => {
    expect(laborPay({ hoursWorked: 3.5, hourlyRate: 45.5 })).toBe(159.25);
    expect(laborPay({ hoursWorked: '', hourlyRate: 40 })).toBe(0);
  });

  test('equipment lines count only when reimbursable', () => {
    expect(equipmentLineTotal({ quantity: 2, cost: 12.5, reimbursable: true })).toBe(25);
    expect(equipmentLineTotal({ quantity: 2, cost: 12.5, reimbursable: false })).toBe(0);
    expect(equipmentLineTotal({ quantity: 1, cost: 10 })).toBe(10);
    expect(equipmentTotal([
      { quantity: 2, cost: 10, reimbursable: true },
      { description: 'Door contact', sku: 'DC-1', quantity: 1, cost: 8, reimbursable: false },
    ])).toBe(20);
  });

  test('amount due is labor plus travel plus reimbursable equipment', () => {
    const totals = computeWorkOrderTotals({
      hoursWorked: 2,
      hourlyRate: 50,
      travelPay: 25,
      equipmentLines: [
        { description: 'Panel', sku: 'P1', quantity: 1, cost: 80, reimbursable: true },
        { description: 'Tool', quantity: 1, cost: 15, reimbursable: false },
      ],
    });
    expect(totals.laborPay).toBe(100);
    expect(totals.travelPay).toBe(25);
    expect(totals.equipmentTotal).toBe(80);
    expect(totals.amountDue).toBe(205);
    expect(amountDue({
      hoursWorked: 2,
      hourlyRate: 50,
      travelPay: 25,
      equipmentLines: [{ quantity: 1, cost: 80, reimbursable: true }],
    })).toBe(205);
  });
});

describe('completion number and filters', () => {
  test('cannot complete, invoice, or mark paid without a completion number', () => {
    expect(requiresCompletionNumber('completed')).toBe(true);
    expect(requiresCompletionNumber('INVOICED')).toBe(true);
    expect(requiresCompletionNumber('paid')).toBe(true);
    expect(requiresCompletionNumber('assigned')).toBe(false);

    const missing = validateWorkOrder({
      workOrderNumber: 'WO-100',
      status: 'completed',
    });
    expect(missing.error).toMatch(/completion/i);

    const ready = validateWorkOrder({
      workOrderNumber: 'WO-100',
      status: 'completed',
      completionNumber: 'CL-8891',
      hoursWorked: 1,
      hourlyRate: 40,
      travelPay: 10,
    });
    expect(ready.error).toBeUndefined();
    expect(ready.value.completionNumber).toBe('CL-8891');
    expect(ready.value.amountDue).toBe(50);
  });

  test('requires a work-order number and known status/job type', () => {
    expect(validateWorkOrder({}).error).toMatch(/work order/i);
    expect(validateWorkOrder({ workOrderNumber: 'WO-1', jobType: 'plumbing' }).error).toMatch(/job type/i);
    expect(validateWorkOrder({ workOrderNumber: 'WO-1', status: 'won' }).error).toMatch(/status/i);
    expect(normalizePrincipal('')).toBe(DEFAULT_PRINCIPAL);
    expect(normalizePrincipal('ADI')).toBe('ADI');
    expect(normalizeJobType('Takeover')).toBe('takeover');
    expect(isKnownJobType('service')).toBe(true);
    expect(normalizeStatus('Paid')).toBe('paid');
    expect(isKnownStatus('scheduled')).toBe(true);
  });

  test('filters the list by status and keeps all when unset', () => {
    const orders = [
      { workOrderNumber: 'A', status: 'assigned' },
      { workOrderNumber: 'B', status: 'completed', completionNumber: 'C1' },
    ];
    expect(filterWorkOrdersByStatus(orders, 'completed').map((row) => row.workOrderNumber)).toEqual(['B']);
    expect(filterWorkOrdersByStatus(orders, '')).toHaveLength(2);
    expect(filterWorkOrdersByStatus(null, 'assigned')).toEqual([]);
  });

  test('Brinks reconciliation tracks paid vs amount due without changing work totals', () => {
    expect(reconcileVariance(205, '')).toBeNull();
    expect(reconcileVariance(205, null)).toBeNull();
    expect(reconcileVariance(205, 180)).toBe(-25);
    expect(reconcileVariance(205, 205)).toBe(0);
    expect(reconcileVariance(205, 220)).toBe(15);

    const checked = validateWorkOrder({
      workOrderNumber: 'WO-100',
      status: 'invoiced',
      completionNumber: 'CL-1',
      hoursWorked: 2,
      hourlyRate: 50,
      travelPay: 25,
      equipmentLines: [{ quantity: 1, cost: 80, reimbursable: true }],
      paidAmount: 180,
      paidDate: '2026-09-20',
      reconciliationNotes: 'Travel cut; equipment approved',
    });
    expect(checked.error).toBeUndefined();
    expect(checked.value.amountDue).toBe(205);
    expect(checked.value.paidAmount).toBe(180);
    expect(checked.value.variance).toBe(-25);
    expect(checked.value.reconciliationNotes).toBe('Travel cut; equipment approved');
  });

  test('rejects a negative Brinks paid amount', () => {
    expect(validateWorkOrder({
      workOrderNumber: 'WO-1',
      paidAmount: -5,
    }).error).toMatch(/paidAmount/i);
  });

  test('rejects invalid dates and negative pay fields', () => {
    expect(validateWorkOrder({
      workOrderNumber: 'WO-1',
      scheduledDate: 'not-a-date',
    }).error).toMatch(/date/i);
    expect(validateWorkOrder({
      workOrderNumber: 'WO-1',
      hoursWorked: -1,
    }).error).toMatch(/hoursWorked/i);
    expect(validateWorkOrder({
      workOrderNumber: 'WO-1',
      hourlyRate: -2,
    }).error).toMatch(/hourlyRate/i);
    expect(validateWorkOrder({
      workOrderNumber: 'WO-1',
      travelPay: -3,
    }).error).toMatch(/travelPay/i);
  });
});
