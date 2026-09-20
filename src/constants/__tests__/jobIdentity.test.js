import { formatCustomerLabel, formatJobLabel, nextAccountNumber, nextJobNumber } from '../jobIdentity';

describe('job identity constants', () => {
  test('re-exports account and job labels for the staff UI', () => {
    expect(nextAccountNumber([])).toBe('A-1001');
    expect(nextJobNumber(['J-1001'])).toBe('J-1002');
    expect(formatCustomerLabel({ name: 'Ada', accountNumber: 'A-1001' })).toBe('Ada · A-1001');
    expect(formatJobLabel({ name: 'Alarm', jobNumber: 'J-1001' })).toBe('J-1001 · Alarm');
  });
});
