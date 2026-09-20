import {
  DEFAULT_PRINCIPAL,
  SUBCONTRACTOR_JOB_TYPE_VALUES,
  SUBCONTRACTOR_STATUS_VALUES,
  amountDue,
  requiresCompletionNumber,
} from '../subcontractorWorkOrders';

describe('subcontractor work-order constants', () => {
  test('re-exports Brinks tracker rules for the staff UI', () => {
    expect(DEFAULT_PRINCIPAL).toBe('Brinks');
    expect(SUBCONTRACTOR_JOB_TYPE_VALUES).toContain('takeover');
    expect(SUBCONTRACTOR_STATUS_VALUES).toContain('invoiced');
    expect(requiresCompletionNumber('completed')).toBe(true);
    expect(amountDue({
      hoursWorked: 1,
      hourlyRate: 40,
      travelPay: 10,
      equipmentLines: [{ quantity: 1, cost: 5, reimbursable: true }],
    })).toBe(55);
  });
});
