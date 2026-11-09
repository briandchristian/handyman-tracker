/**
 * Parts used on a customer job, a project, or a subcontractor work order.
 * Adding a quantity records a purchase into inventory and then the same
 * quantity used, so the shelf count stays put and the movement history
 * shows the part was bought and used.
 * Paid is the unit cost. Sold is the unit price charged.
 * Accounting takes paid × qty as material cost and sold × qty as revenue.
 */

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function asNonNegative(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

export function partIdentity(line = {}) {
  const sku = String(line.sku || '').trim().toLowerCase();
  if (sku) return `sku:${sku}`;
  const name = String(line.description || line.item || line.name || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
}

function asPart(line = {}) {
  return {
    description: String(line.description || line.item || line.name || '').trim(),
    sku: String(line.sku || '').trim(),
    quantity: asNonNegative(line.quantity),
    paid: asNonNegative(line.paid ?? line.cost),
  };
}

/** Purchase then use when quantity grows. Reverse both when it shrinks. */
export function movementsForQuantityDelta(delta) {
  const qty = Math.abs(Number(delta) || 0);
  if (!(qty > 0)) return [];
  if (delta > 0) {
    return [
      { type: 'receive', quantity: qty },
      { type: 'use', quantity: qty },
    ];
  }
  return [
    { type: 'add', quantity: qty },
    { type: 'remove', quantity: qty },
  ];
}

export function partQuantityDeltas(previous = [], next = []) {
  const bucket = (lines) => {
    const map = new Map();
    (Array.isArray(lines) ? lines : []).forEach((raw) => {
      const line = asPart(raw);
      const key = partIdentity(line);
      if (!key || !(line.quantity > 0)) return;
      const current = map.get(key) || { ...line, quantity: 0 };
      current.quantity += line.quantity;
      if (line.paid) current.paid = line.paid;
      if (!current.description) current.description = line.description;
      if (!current.sku) current.sku = line.sku;
      map.set(key, current);
    });
    return map;
  };

  const before = bucket(previous);
  const after = bucket(next);
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].map((key) => {
    const prev = before.get(key);
    const nxt = after.get(key);
    const source = nxt || prev;
    return {
      key,
      description: source.description,
      sku: source.sku,
      paid: source.paid,
      delta: (nxt?.quantity || 0) - (prev?.quantity || 0),
    };
  }).filter((row) => row.delta !== 0);
}

export function partPaidTotal(lines = []) {
  return money((Array.isArray(lines) ? lines : []).reduce((sum, line) => (
    sum + asNonNegative(line.quantity) * asNonNegative(line.paid ?? line.cost)
  ), 0));
}

export function partSoldTotal(lines = []) {
  return money((Array.isArray(lines) ? lines : []).reduce((sum, line) => {
    if (line?.sold === '' || line?.sold == null) return sum;
    if (line?.reimbursable === false) return sum;
    return sum + asNonNegative(line.quantity) * asNonNegative(line.sold);
  }, 0));
}

/**
 * Brinks equipment becomes an accounting job for the parts only.
 * Labor and travel stay off the ledger. Blank sold uses the paid amount
 * as the charge, which is how reimbursable cost was billed before.
 */
export function subcontractorPartsJob(order = {}) {
  const lines = (Array.isArray(order.equipmentLines) ? order.equipmentLines : [])
    .filter((line) => asNonNegative(line?.quantity) > 0 && (line?.description || line?.sku || line?.cost || line?.sold));
  if (!lines.length) return null;
  const sold = money(lines.reduce((sum, line) => {
    if (line.reimbursable === false) return sum;
    const qty = asNonNegative(line.quantity);
    const hasSold = !(line.sold === '' || line.sold == null);
    const unit = hasSold ? asNonNegative(line.sold) : asNonNegative(line.cost);
    return sum + qty * unit;
  }, 0));
  return {
    _id: order._id,
    name: order.siteName || order.workOrderNumber || 'Subcontractor',
    jobNumber: order.workOrderNumber || '',
    customerName: order.principal || 'Brinks',
    status: 'Pending',
    workType: 'service',
    billAmount: sold,
    partsIncludedInBill: true,
    materials: lines.map((line) => {
      const quantity = asNonNegative(line.quantity);
      const cost = asNonNegative(line.cost ?? line.paid);
      const hasSold = !(line.sold === '' || line.sold == null);
      const billed = line.reimbursable === false ? null : (hasSold ? asNonNegative(line.sold) : cost);
      return {
        quantity,
        cost,
        ...(billed == null ? {} : { sold: billed }),
      };
    }),
    createdAt: order.completedDate || order.scheduledDate || order.createdAt || null,
  };
}

/**
 * Parts job when the work order has equipment. A work order with no parts
 * stays off Job Profit unless an expense was filed on it.
 * Labor and travel on the work order stay off the ledger.
 */
export function subcontractorJobForAccounting(order = {}, { includeWithoutParts = false } = {}) {
  const parts = subcontractorPartsJob(order);
  if (parts) return parts;
  if (!includeWithoutParts) return null;
  return {
    _id: order._id,
    name: order.siteName || order.workOrderNumber || 'Subcontractor',
    jobNumber: order.workOrderNumber || '',
    customerName: order.principal || 'Brinks',
    status: 'Pending',
    workType: 'service',
    billAmount: 0,
    partsIncludedInBill: true,
    materials: [],
    createdAt: order.completedDate || order.scheduledDate || order.createdAt || null,
  };
}

/**
 * Apply purchase/use movements for the quantity difference and stamp the
 * inventory id back onto the saved lines.
 */
export async function syncPartLines({
  previous = [],
  next = [],
  findOrCreate,
  applyMovement,
  source,
  reason,
}) {
  const deltas = partQuantityDeltas(previous, next);
  const ids = new Map();
  for (const delta of deltas) {
    if (!findOrCreate || !applyMovement) continue;
    const item = await findOrCreate(delta);
    if (!item) continue;
    ids.set(delta.key, item._id);
    for (const movement of movementsForQuantityDelta(delta.delta)) {
      const purchased = movement.type === 'receive' || movement.type === 'remove';
      await applyMovement({
        item,
        type: movement.type,
        quantity: movement.quantity,
        unitCost: delta.paid,
        reason: purchased ? `Purchased for ${reason}` : `Used on ${reason}`,
        source,
      });
    }
  }
  const lines = (Array.isArray(next) ? next : []).map((line) => {
    const id = ids.get(partIdentity(line));
    return id ? { ...line, inventoryItemId: id } : line;
  });
  return { lines };
}
