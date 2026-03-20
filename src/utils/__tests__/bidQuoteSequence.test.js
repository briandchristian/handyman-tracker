/**
 * Bid quote # sequence for PDF bids: starts at 1000, increments per generation.
 */
import { BID_QUOTE_LOCAL_STORAGE_KEY, getNextBidQuoteNumber } from '../bidQuoteSequence';

describe('bidQuoteSequence', () => {
  beforeEach(() => {
    localStorage.removeItem(BID_QUOTE_LOCAL_STORAGE_KEY);
  });

  test('returns 1000 when storage is empty and increments for next call', () => {
    expect(getNextBidQuoteNumber()).toBe(1000);
    expect(getNextBidQuoteNumber()).toBe(1001);
    expect(getNextBidQuoteNumber()).toBe(1002);
    expect(localStorage.getItem(BID_QUOTE_LOCAL_STORAGE_KEY)).toBe('1003');
  });

  test('resumes from stored value when valid', () => {
    localStorage.setItem(BID_QUOTE_LOCAL_STORAGE_KEY, '1005');
    expect(getNextBidQuoteNumber()).toBe(1005);
    expect(getNextBidQuoteNumber()).toBe(1006);
  });

  test('treats invalid stored value as start at 1000', () => {
    localStorage.setItem(BID_QUOTE_LOCAL_STORAGE_KEY, 'not-a-number');
    expect(getNextBidQuoteNumber()).toBe(1000);
  });

  test('treats stored value below 1000 as 1000', () => {
    localStorage.setItem(BID_QUOTE_LOCAL_STORAGE_KEY, '500');
    expect(getNextBidQuoteNumber()).toBe(1000);
  });

});
