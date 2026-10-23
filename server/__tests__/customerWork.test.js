/**
 * Customer jobs are single tickets with charge lines, opened like a work order.
 * Amount due is hours × rate + travel + charge lines. Variance is paid − due.
 * A bid is a quote with its own total. A project only groups tickets.
 */

import {
  BID_STATUS_VALUES,
  DEFAULT_BID_STATUS,
  DEFAULT_SERVICE_JOB_STATUS,
  SERVICE_JOB_STATUS_VALUES,
  computeServiceJobTotals,
  nextCustomerRecordNumber,
  planRollup,
  serviceJobMatchesStatus,
  validateBid,
  validatePlan,
  validateServiceJob,
} from '../lib/customerWork.js';

describe('customer job tickets', () => {
  test('uses scheduled as the default status and keeps bids off the job status list', () => {
    expect(DEFAULT_SERVICE_JOB_STATUS).toBe('scheduled');
    expect(SERVICE_JOB_STATUS_VALUES).toEqual(['scheduled', 'completed', 'invoiced', 'paid']);
    expect(DEFAULT_BID_STATUS).toBe('draft');
    expect(BID_STATUS_VALUES).toEqual(['draft', 'sent', 'revised', 'accepted', 'declined', 'expired']);
  });

  test('Paid includes a recorded payment even when the ticket status is still invoiced', () => {
    const paidOnInvoice = { status: 'invoiced', paidAmount: 100 };
    const markedPaid = { status: 'paid', paidAmount: null };
    const openTicket = { status: 'scheduled', paidAmount: null };

    expect(serviceJobMatchesStatus(paidOnInvoice, 'paid')).toBe(true);
    expect(serviceJobMatchesStatus(markedPaid, 'paid')).toBe(true);
    expect(serviceJobMatchesStatus(openTicket, 'paid')).toBe(false);
    expect(serviceJobMatchesStatus(paidOnInvoice, 'invoiced')).toBe(true);
    expect(serviceJobMatchesStatus(openTicket, '')).toBe(true);
  });

  test('adds labor, travel, and charge lines into amount due', () => {
    const totals = computeServiceJobTotals({
      hoursWorked: 2,
      hourlyRate: 50,
      travelPay: 10,
      chargeLines: [
        { description: 'Keypad', quantity: 1, price: 85 },
        { description: 'Contact', quantity: 2, price: 12.5 },
      ],
    });
    expect(totals.laborPay).toBe(100);
    expect(totals.linesTotal).toBe(110);
    expect(totals.amountDue).toBe(220);
  });

  test('requires a job name and rejects an unknown status', () => {
    expect(validateServiceJob({}).error).toMatch(/job name/i);
    expect(validateServiceJob({ name: 'Keypad', status: 'bidded' }).error).toMatch(/status/i);
  });

  test('stores due, paid, and variance on the ticket', () => {
    const checked = validateServiceJob({
      name: '  Replace keypad ',
      workType: 'service',
      status: 'invoiced',
      hoursWorked: 1,
      hourlyRate: 75,
      travelPay: 0,
      chargeLines: [{ description: 'Keypad', quantity: 1, price: 85 }],
      paidAmount: 100,
      planId: 'plan1',
      bidId: 'bid1',
      notes: 'Customer supplied old keypad',
    });
    expect(checked.error).toBeUndefined();
    expect(checked.value.name).toBe('Replace keypad');
    expect(checked.value.workType).toBe('service');
    expect(checked.value.amountDue).toBe(160);
    expect(checked.value.paidAmount).toBe(100);
    expect(checked.value.variance).toBe(-60);
    expect(checked.value.planId).toBe('plan1');
    expect(checked.value.bidId).toBe('bid1');
    expect(checked.value.chargeLines).toEqual([
      { description: 'Keypad', quantity: 1, price: 85 },
    ]);
    expect(checked.value.jobNumber).toBeUndefined();
  });

  test('leaves variance empty until a paid amount is entered', () => {
    const checked = validateServiceJob({
      name: 'Panel check',
      hoursWorked: 1,
      hourlyRate: 80,
    });
    expect(checked.value.amountDue).toBe(80);
    expect(checked.value.paidAmount).toBeNull();
    expect(checked.value.variance).toBeNull();
  });
});

describe('customer bids and projects', () => {
  test('keeps a quoted amount that differs from the worksheet lines', () => {
    const checked = validateBid({
      name: 'Cameras and access',
      status: 'revised',
      quotedAmount: 9100,
      lines: [
        { description: 'Cameras', quantity: 4, estimate: 1800 },
      ],
    });
    expect(checked.error).toBeUndefined();
    expect(checked.value.status).toBe('revised');
    expect(checked.value.linesTotal).toBe(7200);
    expect(checked.value.quotedAmount).toBe(9100);
  });

  test('uses the line total when no quoted amount is entered', () => {
    const checked = validateBid({
      name: 'Panel service',
      lines: [{ description: 'Service', quantity: 1, estimate: 280 }],
    });
    expect(checked.value.status).toBe('draft');
    expect(checked.value.quotedAmount).toBe(280);
  });

  test('requires a bid name and a project name', () => {
    expect(validateBid({}).error).toMatch(/bid name/i);
    expect(validateBid({ name: 'Quote', status: 'sold' }).error).toMatch(/status/i);
    expect(validatePlan({}).error).toMatch(/project name/i);
    expect(validatePlan({ name: ' Building security ' }).value.name).toBe('Building security');
  });

  test('builds the next number from the customer account, one sequence per kind', () => {
    expect(nextCustomerRecordNumber('A-1001', 'job', []).value).toBe('A-1001-J0001');
    expect(nextCustomerRecordNumber('A-1001', 'bid', ['A-1001-B0001', 'A-1001-B0009']).value).toBe('A-1001-B0010');
    expect(nextCustomerRecordNumber('A-1001', 'project', []).value).toBe('A-1001-P0001');
    expect(nextCustomerRecordNumber('A-1001', 'job', ['A-1001-B0004', 'A-1001-J0002']).value).toBe('A-1001-J0003');
    expect(nextCustomerRecordNumber('A-1002', 'job', ['A-1001-J0009']).value).toBe('A-1002-J0001');
    expect(nextCustomerRecordNumber('', 'job', []).error).toMatch(/account number/i);
  });

  test('rolls a project up from its job tickets and its bids', () => {
    const rollup = planRollup('plan1', {
      jobs: [
        { planId: 'plan1', amountDue: 2400, paidAmount: 2000 },
        { planId: 'plan1', amountDue: 1800, paidAmount: null },
        { planId: 'other', amountDue: 265, paidAmount: 265 },
      ],
      bids: [
        { planId: 'plan1', quotedAmount: 8400, status: 'revised' },
        { planId: '', quotedAmount: 9100, status: 'declined' },
      ],
    });
    expect(rollup.jobCount).toBe(2);
    expect(rollup.amountDue).toBe(4200);
    expect(rollup.paid).toBe(2000);
    expect(rollup.quoted).toBe(8400);
  });
});
