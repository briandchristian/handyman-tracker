/**
 * Normalize a scanned or typed code and find an inventory item whose SKU matches (exact trim match).
 */
export function normalizeSkuCode(code) {
  return String(code ?? '').trim();
}

export function findItemBySku(items, code) {
  const normalized = normalizeSkuCode(code);
  if (!normalized) return null;
  return (
    items.find(
      (item) => item.sku != null && String(item.sku).trim() === normalized
    ) ?? null
  );
}
