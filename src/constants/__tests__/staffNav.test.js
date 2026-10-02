/**
 * Shared staff destinations: short labels for the desktop bar, longer labels
 * for the phone menu, and a single rule for which item is the current page.
 */

import { isStaffNavActive, staffNavLabel } from '../staffNav';

describe('staffNav', () => {
  test('uses the short name on the desktop bar and the long name in the phone menu', () => {
    const orders = { name: 'Orders', menuName: 'Purchase Orders', path: '/purchase-orders' };
    const customers = { name: 'Customers', path: '/customers' };

    expect(staffNavLabel(orders, { compact: true })).toBe('Orders');
    expect(staffNavLabel(orders)).toBe('Purchase Orders');
    expect(staffNavLabel(customers)).toBe('Customers');
  });

  test('matches the current page, including hashes, and ignores a parent when a hash link is open', () => {
    expect(isStaffNavActive('/dashboard', { pathname: '/dashboard', hash: '' })).toBe(true);
    expect(isStaffNavActive('/dashboard', { pathname: '/customers', hash: '' })).toBe(false);
    expect(isStaffNavActive('/customers', { pathname: '/customers/42', hash: '' })).toBe(true);
    expect(isStaffNavActive('/inventory', { pathname: '/inventory', hash: '' })).toBe(true);
    expect(isStaffNavActive('/inventory', { pathname: '/inventory', hash: '#adi-price' })).toBe(false);
    expect(
      isStaffNavActive('/inventory#adi-price', { pathname: '/inventory', hash: '#adi-price' })
    ).toBe(true);
    expect(
      isStaffNavActive('/inventory#adi-price', { pathname: '/inventory', hash: '' })
    ).toBe(false);
  });
});
