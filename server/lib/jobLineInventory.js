/**
 * A job line can stay a charge, rest on the shelf, or be bought and then used
 * on that job. Keep in inventory is a purchase that stays in stock.
 * Use on this job records the purchase and then the use.
 * Use stock on hand draws a quantity already in inventory and does not purchase it.
 * A quantity already on the shelf for this job is used from that stock
 * instead of being purchased a second time.
 * A saved line that already has an inventory item counts as used.
 */

import { partIdentity } from './jobParts.js';

export function storedLineDisposition(line = {}) {
  if (line.inventoryDisposition === 'stock' || line.inventoryDisposition === 'used' || line.inventoryDisposition === 'draw') {
    return line.inventoryDisposition;
  }
  const quantity = Number(line.quantity);
  if (line.inventoryItemId && Number.isFinite(quantity) && quantity > 0) return 'used';
  return '';
}

function quantityOf(line) {
  const quantity = Number(line?.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function tally(lines, dispositionFor) {
  const map = new Map();
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    const disposition = dispositionFor(line);
    const quantity = quantityOf(line);
    const key = partIdentity(line);
    if (!disposition || !quantity || !key) return;
    const row = map.get(key) || {
      key,
      description: '',
      sku: '',
      paid: 0,
      price: null,
      supplierId: '',
      stocked: 0,
      used: 0,
      drawn: 0,
    };
    if (!row.description) row.description = String(line.description || line.item || line.name || '').trim();
    if (!row.sku) row.sku = String(line.sku || '').trim();
    const paid = Number(line.paid ?? line.cost);
    if (Number.isFinite(paid) && paid > 0) row.paid = paid;
    const price = Number(line.price ?? line.sold);
    if (Number.isFinite(price)) row.price = price;
    if (line.supplierId) row.supplierId = String(line.supplierId?._id || line.supplierId);
    const bucket = disposition === 'stock' ? 'stocked' : disposition === 'draw' ? 'drawn' : 'used';
    row[bucket] += quantity;
    map.set(key, row);
  });
  return map;
}

/**
 * Movements that take the saved lines from `previous` to `next`.
 * `next` uses the disposition on the line. `previous` also treats an
 * inventory item with no disposition as already used on the job.
 */
export function inventoryPlans(previous = [], next = []) {
  const before = tally(previous, storedLineDisposition);
  const after = tally(next, (line) => (
    line?.inventoryDisposition === 'stock' || line?.inventoryDisposition === 'used' || line?.inventoryDisposition === 'draw'
      ? line.inventoryDisposition
      : ''
  ));
  const keys = new Set([...before.keys(), ...after.keys()]);
  const plans = [];
  keys.forEach((key) => {
    const prev = before.get(key) || { stocked: 0, used: 0 };
    const nxt = after.get(key);
    const source = nxt || before.get(key);
    const stockedDelta = (nxt?.stocked || 0) - (prev.stocked || 0);
    const usedDelta = (nxt?.used || 0) - (prev.used || 0);
    const drawnDelta = (nxt?.drawn || 0) - (prev.drawn || 0);
    const usedFromShelf = usedDelta > 0 ? Math.min(usedDelta, Math.max(-stockedDelta, 0)) : 0;
    const usedFromPurchase = usedDelta > 0 ? usedDelta - usedFromShelf : 0;
    const returnedToShelf = usedDelta < 0 ? Math.min(-usedDelta, Math.max(stockedDelta, 0)) : 0;
    const reversedUse = usedDelta < 0 ? -usedDelta - returnedToShelf : 0;
    const receivedToShelf = Math.max(stockedDelta - returnedToShelf, 0);
    const removedFromShelf = Math.max(-stockedDelta - usedFromShelf, 0);
    const movements = [];
    if (usedFromPurchase > 0) {
      movements.push({ type: 'receive', quantity: usedFromPurchase, reason: 'purchased' });
      movements.push({ type: 'use', quantity: usedFromPurchase, reason: 'used' });
    }
    if (usedFromShelf > 0) movements.push({ type: 'use', quantity: usedFromShelf, reason: 'used' });
    if (returnedToShelf > 0) movements.push({ type: 'add', quantity: returnedToShelf, reason: 'returned' });
    if (reversedUse > 0) {
      movements.push({ type: 'add', quantity: reversedUse, reason: 'returned' });
      movements.push({ type: 'remove', quantity: reversedUse, reason: 'reversed' });
    }
    if (receivedToShelf > 0) movements.push({ type: 'receive', quantity: receivedToShelf, reason: 'purchased' });
    if (removedFromShelf > 0) movements.push({ type: 'remove', quantity: removedFromShelf, reason: 'removed' });
    if (drawnDelta > 0) movements.push({ type: 'use', quantity: drawnDelta, reason: 'used' });
    if (drawnDelta < 0) movements.push({ type: 'add', quantity: -drawnDelta, reason: 'returned' });
    if (!movements.length) return;
    plans.push({
      key,
      description: source.description || '',
      sku: source.sku || '',
      paid: source.paid || 0,
      price: source.price,
      supplierId: nxt?.supplierId || source.supplierId || '',
      movements,
    });
  });
  return plans;
}

/**
 * Quantity still missing from the shelf for a Keep in inventory line.
 * Purchases and removals posted for this same job are what count.
 */
export function stockStillOwed(quantity, movements = []) {
  const net = (Array.isArray(movements) ? movements : []).reduce((sum, movement) => {
    const amount = Number(movement?.quantity) || 0;
    if (movement?.type === 'receive') return sum + amount;
    if (movement?.type === 'remove') return sum - amount;
    return sum;
  }, 0);
  const owed = (Number(quantity) || 0) - net;
  return owed > 0 ? owed : 0;
}

/** A new purchase needs a supplier. Using stock already on the shelf does not. */
export function inventoryPlanError(next = [], plans = []) {
  for (const line of Array.isArray(next) ? next : []) {
    const disposition = line?.inventoryDisposition;
    if (disposition !== 'stock' && disposition !== 'used' && disposition !== 'draw') continue;
    if (!partIdentity(line)) return 'Enter a description or SKU before adding this line to inventory';
    if (!(Number(line.quantity) > 0)) return 'Enter a quantity before adding this line to inventory';
  }
  if (plans.some((plan) => plan.movements.some((movement) => movement.type === 'receive') && !plan.supplierId)) {
    return 'Choose a supplier';
  }
  return null;
}

export async function syncServiceJobInventory({
  previous = [],
  next = [],
  findOrCreate,
  applyMovement,
  source,
  reason,
}) {
  const plans = inventoryPlans(previous, next);
  const error = inventoryPlanError(next, plans);
  if (error) {
    const err = new Error(error);
    err.statusCode = 400;
    throw err;
  }
  const ids = new Map();
  (Array.isArray(previous) ? previous : []).forEach((line) => {
    const key = partIdentity(line);
    if (key && line?.inventoryItemId) ids.set(key, line.inventoryItemId);
  });
  for (const plan of plans) {
    if (!findOrCreate || !applyMovement) continue;
    const item = await findOrCreate(plan);
    if (!item) continue;
    ids.set(plan.key, item._id);
    for (const movement of plan.movements) {
      const text = movement.reason === 'used'
        ? `Used on ${reason}`
        : movement.reason === 'returned'
          ? `Returned to inventory from ${reason}`
          : movement.reason === 'removed'
            ? `Removed from inventory for ${reason}`
            : movement.reason === 'reversed'
              ? `Reversed purchase for ${reason}`
              : `Purchased for ${reason}`;
      await applyMovement({
        item,
        type: movement.type,
        quantity: movement.quantity,
        unitCost: plan.paid,
        unitPrice: plan.price,
        reason: text,
        source,
        supplierId: plan.supplierId,
      });
    }
  }
  const lines = (Array.isArray(next) ? next : []).map((line) => {
    const key = partIdentity(line);
    const id = key ? ids.get(key) : null;
    const disposition = line?.inventoryDisposition;
    if ((disposition === 'stock' || disposition === 'used' || disposition === 'draw') && id) {
      return { ...line, inventoryItemId: id };
    }
    return line;
  });
  return { lines };
}
