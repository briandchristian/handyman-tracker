/**
 * A barcode and a supplier part number can identify the same product.
 * A supplier may store both in one field as "barcode | part".
 */
import { adiItemNumberFromSku } from './adiIntegration.js';

const text = (value) => (value == null ? '' : String(value).trim());

export function identityTokens(...values) {
  const tokens = new Set();
  values.forEach((value) => {
    text(value)
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => tokens.add(part.toLowerCase()));
  });
  return tokens;
}

export function itemIdentityTokens(item) {
  return identityTokens(item?.sku, item?.supplierPartNumber);
}

export function itemsShareIdentity(a, b) {
  const left = itemIdentityTokens(a);
  const right = itemIdentityTokens(b);
  if (!left.size || !right.size) return false;
  for (const token of left) {
    if (right.has(token)) return true;
  }
  return false;
}

export function findItemByIdentity(items, code) {
  const wanted = identityTokens(code);
  if (!wanted.size) return null;
  return (items || []).find((item) => {
    const tokens = itemIdentityTokens(item);
    for (const token of wanted) {
      if (tokens.has(token)) return true;
    }
    return false;
  }) || null;
}

/** Keep both identifiers on the keeper and add the quantities together. */
export function mergedInventoryFields(keeper, other) {
  const keeperSku = text(keeper?.sku);
  const otherSku = text(other?.sku);
  const keeperPart = text(keeper?.supplierPartNumber);
  const otherPart = text(other?.supplierPartNumber);
  const sku = keeperSku || otherSku;
  let supplierPartNumber = keeperPart || otherPart;
  if (!supplierPartNumber && sku.includes('|')) {
    supplierPartNumber = adiItemNumberFromSku(sku);
  }
  const dropped = [];
  if (otherSku && otherSku !== sku) dropped.push(otherSku);
  if (otherPart && otherPart !== supplierPartNumber) dropped.push(otherPart);
  const keeperPrice = Number(keeper?.lastPrice);
  const otherPrice = Number(other?.lastPrice);
  return {
    name: text(keeper?.name) || text(other?.name),
    sku: sku || null,
    supplierPartNumber,
    currentStock: Math.max(0, Number(keeper?.currentStock) || 0) + Math.max(0, Number(other?.currentStock) || 0),
    lastPrice: keeperPrice > 0 ? keeperPrice : Math.max(0, otherPrice || 0),
    description: text(keeper?.description) || text(other?.description),
    dropped,
  };
}

export function duplicateIdentityGroups(items = []) {
  const list = items || [];
  const parent = list.map((_, index) => index);
  const find = (index) => {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  };
  const unite = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (itemsShareIdentity(list[i], list[j])) unite(i, j);
    }
  }
  const groups = new Map();
  list.forEach((item, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}
