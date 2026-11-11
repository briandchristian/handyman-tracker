/**
 * Entering a line's paid amount suggests a price of that cost plus 30%.
 * $100 paid becomes $130. A blank paid amount does not suggest a price.
 */

import { priceFromPaid } from '../linePrice';

describe('price from paid', () => {
  test('sets the price to the paid amount plus 30 percent', () => {
    expect(priceFromPaid(32.07)).toBe(41.69);
    expect(priceFromPaid(265.25)).toBe(344.83);
    expect(priceFromPaid(100)).toBe(130);
    expect(priceFromPaid('13.92')).toBe(18.1);
    expect(priceFromPaid(0)).toBe(0);
  });

  test('leaves the price alone when paid is blank or not a number', () => {
    expect(priceFromPaid('')).toBeNull();
    expect(priceFromPaid(null)).toBeNull();
    expect(priceFromPaid('abc')).toBeNull();
  });
});
