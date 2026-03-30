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

/**
 * Returns the next quote number without incrementing.
 * Useful for previews/regeneration flows that should not consume a new number.
 * @param {Storage} [storage]
 * @returns {number}
 */
export function getCurrentBidQuoteNumber(storage = globalThis.localStorage) {
  const raw = storage.getItem(BID_QUOTE_LOCAL_STORAGE_KEY);
  const next = parseInt(raw, 10);
  if (Number.isNaN(next) || next < 1000) {
    return 1000;
  }
  return next;
}

/**
 * Returns the most recently issued quote number without incrementing.
 * If no quote has been issued yet, returns 1000.
 * @param {Storage} [storage]
 * @returns {number}
 */
export function getLastIssuedBidQuoteNumber(storage = globalThis.localStorage) {
  const current = getCurrentBidQuoteNumber(storage);
  return Math.max(1000, current - 1);
}
