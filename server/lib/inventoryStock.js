/**
 * Inventory stock rules used by the API (PO receive, job usage, and counts).
 * Stock never goes below zero. Empty SKUs are treated as unset so unique
 * indexes do not collide on blank values.
 *
 * Physical counts: `set` the on-hand qty to what was counted. A shortage
 * (counted < book) is unrecorded use; optionally assign that shortage to a
 * job so job cost matches the shelf. A job may only be charged when stock
 * is reduced — never on a restock or count overage — except `untracked`:
 * items used on a job that were never received into inventory. That posts
 * job cost and leaves on-hand unchanged.
 */

export const STOCK_MOVEMENT_TYPES = {
  add: 'add',
  remove: 'remove',
  set: 'set',
  receive: 'receive',
  use: 'use',
  untracked: 'untracked',
};

export function normalizeSku(sku) {
  const value = String(sku ?? '').trim();
  return value === '' ? null : value;
}

export function applyStockChange(currentStock, { type, quantity } = {}) {
  const previousStock = Number(currentStock) || 0;
  const qty = Number(quantity);

  if (!Number.isFinite(qty) || qty < 0) {
    return { error: 'Quantity must be a non-negative number' };
  }

  let newStock;
  if (type === STOCK_MOVEMENT_TYPES.add || type === STOCK_MOVEMENT_TYPES.receive) {
    newStock = previousStock + qty;
  } else if (type === STOCK_MOVEMENT_TYPES.remove || type === STOCK_MOVEMENT_TYPES.use) {
    newStock = previousStock - qty;
  } else if (type === STOCK_MOVEMENT_TYPES.set) {
    newStock = qty;
  } else if (type === STOCK_MOVEMENT_TYPES.untracked) {
    if (qty === 0) {
      return { error: 'Quantity must be greater than zero' };
    }
    newStock = previousStock;
  } else {
    return { error: 'Invalid movement type' };
  }

  if (newStock < 0) {
    return { error: 'Stock cannot be negative' };
  }

  return {
    previousStock,
    newStock,
    delta: newStock - previousStock,
  };
}

export function isDuplicateKeyError(err) {
  return Boolean(err && (err.code === 11000 || err.code === '11000'));
}

/**
 * Compare book on-hand to a physical count.
 * Negative delta / usedQuantity = unrecorded use (missing from the shelf).
 */
export function reconcileCount(currentStock, countedQuantity) {
  const book = Number(currentStock) || 0;
  const counted = Number(countedQuantity);

  if (!Number.isFinite(counted) || counted < 0) {
    return { error: 'Counted quantity must be a non-negative number' };
  }

  const delta = counted - book;
  return {
    book,
    counted,
    delta,
    usedQuantity: delta < 0 ? -delta : 0,
    foundQuantity: delta > 0 ? delta : 0,
  };
}

/**
 * Job cost can only be posted when stock is reduced, except untracked use:
 * items that went to a job without ever being received into inventory.
 */
export function jobAssignmentError(delta, { customerId, projectId, type } = {}) {
  const hasCustomer = Boolean(customerId);
  const hasProject = Boolean(projectId);
  if (type === STOCK_MOVEMENT_TYPES.untracked) {
    if (!hasCustomer || !hasProject) {
      return 'Customer and job are both required for items never received into inventory';
    }
    return null;
  }
  if (!hasCustomer && !hasProject) return null;
  if (!hasCustomer || !hasProject) {
    return 'Customer and job are both required to assign used stock';
  }
  if (!(Number(delta) < 0)) {
    return 'A job can only be assigned when stock is reduced';
  }
  return null;
}

export function materialMatchesInventoryItem(material, item) {
  if (!material || !item) return false;

  const itemId = item._id || item.id;
  const materialId = material.inventoryItemId?._id || material.inventoryItemId;
  if (itemId && materialId && String(materialId) === String(itemId)) return true;

  const itemSku = normalizeSku(item.sku);
  const materialSku = normalizeSku(material.sku);
  if (itemSku && materialSku) return itemSku === materialSku;

  if (!materialSku) {
    const itemName = String(item.name || '').trim().toLowerCase();
    const materialName = String(material.item || '').trim().toLowerCase();
    if (itemName && materialName && itemName === materialName) return true;
  }

  return false;
}

/**
 * Charge used qty to a job: increment an existing SKU/name line, or add one.
 * Does not change inventory — callers apply the stock movement separately.
 */
export function applyJobUsageToProject(project, item, usedQty, { chargedFromStock = true } = {}) {
  if (!project.materials) project.materials = [];
  const qty = Number(usedQty) || 0;
  if (chargedFromStock) {
    const existing = project.materials.find((material) => (
      materialMatchesInventoryItem(material, item) && material.chargedFromStock !== false
    ));
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + qty;
      if (!normalizeSku(existing.sku) && item.sku) existing.sku = item.sku;
      if (!existing.inventoryItemId && item._id) existing.inventoryItemId = item._id;
      return existing;
    }
  }

  project.materials.push({
    item: item.name,
    sku: item.sku || undefined,
    inventoryItemId: item._id,
    quantity: qty,
    cost: Number(item.lastPrice) || 0,
    markup: 0,
    taxable: true,
    chargedFromStock,
  });
  return project.materials[project.materials.length - 1];
}
