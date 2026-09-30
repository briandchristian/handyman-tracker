/**
 * Normalize a scanned or typed code and find an inventory item.
 * A match can be the barcode, the supplier part, or either side of "barcode | part".
 */
import { findItemByIdentity } from './inventoryIdentity.js';

export function normalizeSkuCode(code) {
  return String(code ?? '').trim();
}

export function findItemBySku(items, code) {
  const normalized = normalizeSkuCode(code);
  if (!normalized) return null;
  return findItemByIdentity(items, normalized);
}
