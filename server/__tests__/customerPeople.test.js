/**
 * A customer is either a business or a private individual.
 * People are contacts on a business. A private individual is the person and their home.
 */

import {
  customerKindLabel,
  normalizeCustomerKind,
  validateCustomerPerson,
} from '../lib/customerPeople.js';

describe('customer people', () => {
  test('distinguishes a business from a private individual', () => {
    expect(normalizeCustomerKind('business')).toBe('business');
    expect(normalizeCustomerKind('individual')).toBe('individual');
    expect(normalizeCustomerKind('')).toBe('');
    expect(normalizeCustomerKind('vendor')).toBeNull();
    expect(customerKindLabel('business')).toBe('Business');
    expect(customerKindLabel('individual')).toBe('Private individual');
    expect(customerKindLabel('')).toBe('');
  });

  test('a person needs a name and keeps their role and contact', () => {
    expect(validateCustomerPerson({}).error).toBe('Person name is required');
    expect(validateCustomerPerson({
      name: ' Ada Owner ',
      role: ' Owner ',
      phone: '931-279-7879',
      email: 'ada@example.com',
    }).value).toEqual({
      name: 'Ada Owner',
      role: 'Owner',
      phone: '931-279-7879',
      email: 'ada@example.com',
    });
  });
});
