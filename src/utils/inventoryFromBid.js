/**
 * Copy bid worksheet lines into inventory.
 * New rows start at zero quantity and keep the supplier part number.
 * An existing part number is reported so the user can overwrite it or cancel.
 */
import { adiItemNumberFromSku } from './adiIntegration.js';
import { itemIdentityTokens } from './inventoryIdentity.js';

const text = (value) => (value == null ? '' : String(value).trim());
const key = (value) => text(value).toLowerCase();

function findExisting(existing, part, name) {
  const partKey = key(part);
  const nameKey = key(name);
  return (existing || []).find((item) => {
    if (partKey && itemIdentityTokens(item).has(partKey)) return true;
    return nameKey && key(item?.name) === nameKey;
  });
}

export function inventoryConflictMessage(conflicts = []) {
  const labels = conflicts.map((conflict) => text(conflict.partNumber) || text(conflict.name)).filter(Boolean);
  if (labels.length === 1) {
    return `${labels[0]} already exists in inventory. Overwrite it, or cancel.`;
  }
  return `${labels.join(', ')} already exist in inventory. Overwrite them, or cancel.`;
}

export function inventoryPartKeySet(items = []) {
  const keys = new Set();
  (items || []).forEach((item) => {
    const part = key(item?.supplierPartNumber);
    const sku = key(adiItemNumberFromSku(item?.sku));
    if (part) keys.add(part);
    if (sku) keys.add(sku);
  });
  return keys;
}

/** Blue after refresh or a first add. Green only when this visit found the part already on hand. */
export function bidPartLinkTone(part, inventoryParts, alreadyExistedParts = []) {
  const token = key(adiItemNumberFromSku(part));
  if (!token) return '';
  const known = inventoryParts instanceof Set ? inventoryParts : inventoryPartKeySet(inventoryParts);
  const existed = alreadyExistedParts instanceof Set
    ? alreadyExistedParts
    : new Set((alreadyExistedParts || []).map((value) => key(adiItemNumberFromSku(value))));
  if (!known.has(token)) return '';
  return existed.has(token) ? 'green' : 'blue';
}

export function inventoryItemsFromBidLines(lines = [], existing = [], options = {}) {
  const overwrite = options.overwrite === true;
  const known = [...(existing || [])];
  const created = [];
  const updates = [];
  const conflicts = [];

  (lines || []).forEach((line) => {
    const name = text(line?.item);
    if (!name) return;
    const part = adiItemNumberFromSku(line?.sku);
    const match = findExisting(known, part, name);
    // Omit sku. Inventory's unique index treats an explicit null as a value, so a second blank SKU fails to save.
    const draft = {
      name,
      supplierPartNumber: part,
      description: '',
      currentStock: 0,
      unit: 'each',
      parLevel: 0,
      lastPrice: Math.max(0, Number(line?.estimate) || 0),
      autoReorder: false,
      preferredSupplier: options.preferredSupplierId || null,
    };

    if (match) {
      if (!overwrite) {
        conflicts.push({
          existingId: match._id ? String(match._id) : '',
          partNumber: part || name,
          name,
        });
        return;
      }
      if (match._id && !created.includes(match)) {
        updates.push({
          _id: String(match._id),
          name,
          supplierPartNumber: part,
          lastPrice: draft.lastPrice,
        });
      } else {
        Object.assign(match, draft);
      }
      return;
    }

    known.push(draft);
    created.push(draft);
  });

  return { created, updates, conflicts };
}
