/**
 * Persists the next bid quote number in localStorage (client-only).
 * First issued quote is 1000, then 1001, etc.
 */
export const BID_QUOTE_LOCAL_STORAGE_KEY = 'handyman-bid-quote-sequence';

/**
 * @param {Storage} [storage]
 * @returns {number}
 */
export function getNextBidQuoteNumber(storage = globalThis.localStorage) {
  const raw = storage.getItem(BID_QUOTE_LOCAL_STORAGE_KEY);
  let next = parseInt(raw, 10);
  if (Number.isNaN(next) || next < 1000) {
    next = 1000;
  }
  const current = next;
  storage.setItem(BID_QUOTE_LOCAL_STORAGE_KEY, String(next + 1));
  return current;
}
