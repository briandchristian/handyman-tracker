/**
 * A quick pick is a part saved from a job line.
 * Description, SKU, price (what you charge), and paid (what it cost) are kept.
 * Quantity stays on the job. Adding a pick starts that line at quantity 1
 * unless the blank starter line already has a quantity.
 */

export function normalizeQuickPick(input) {
  const description = String(input?.description || '').trim();
  const sku = String(input?.sku || '').trim();
  if (!description && !sku) {
    return { ok: false, error: 'Enter a description or SKU before saving a quick pick' };
  }
  const price = readMoney(input?.price, 'Price');
  if (!price.ok) return price;
  const paid = readMoney(input?.paid, 'Paid');
  if (!paid.ok) return paid;
  return {
    ok: true,
    value: { description, sku, price: price.value, paid: paid.value },
  };
}

function readMoney(value, label) {
  if (value === '' || value == null) return { ok: true, value: null };
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: `${label} must be zero or more` };
  }
  return { ok: true, value: Math.round(amount * 100) / 100 };
}

/** Same SKU is the same part. Without a SKU, the description is the identity. */
export function matchingQuickPick(list, value) {
  const items = Array.isArray(list) ? list : [];
  const sku = String(value?.sku || '').trim().toLowerCase();
  if (sku) {
    return items.find((item) => String(item.sku || '').trim().toLowerCase() === sku) || null;
  }
  const description = String(value?.description || '').trim().toLowerCase();
  return items.find((item) => (
    !String(item.sku || '').trim()
    && String(item.description || '').trim().toLowerCase() === description
  )) || null;
}

export function compareQuickPicks(a, b) {
  const description = String(a?.description || '').localeCompare(String(b?.description || ''), undefined, { sensitivity: 'base' });
  if (description) return description;
  return String(a?.sku || '').localeCompare(String(b?.sku || ''), undefined, { sensitivity: 'base' });
}

const dollars = (value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function quickPickLabel(pick) {
  const name = [pick?.description, pick?.sku].map((part) => String(part || '').trim()).filter(Boolean).join(' · ');
  const price = pick?.price == null || pick?.price === '' ? '' : dollars(pick.price);
  const paid = pick?.paid == null || pick?.paid === '' ? '' : `paid ${dollars(pick.paid)}`;
  return [name, price, paid].filter(Boolean).join(' · ');
}

/**
 * Match a quick pick to a stocked part.
 * missing: no inventory item yet. out: the item exists and none are on hand.
 * in: at least one is on the shelf.
 */
export function quickPickStock(pick, items = []) {
  const list = Array.isArray(items) ? items : [];
  const sku = String(pick?.sku || '').trim().toLowerCase();
  const description = String(pick?.description || '').trim().toLowerCase();
  const item = sku
    ? list.find((row) => String(row?.sku || '').trim().toLowerCase() === sku) || null
    : list.find((row) => (
      !String(row?.sku || '').trim()
      && String(row?.name || '').trim().toLowerCase() === description
    )) || null;
  if (!item) return { status: 'missing', onHand: 0, item: null };
  const onHand = Math.max(0, Number(item.currentStock) || 0);
  if (onHand <= 0) return { status: 'out', onHand: 0, item };
  return { status: 'in', onHand, item };
}

/** Cue after lines already on this job have claimed some of the on-hand quantity. */
export function quickPickAvailability(pick, items = [], reserved = 0) {
  const stock = quickPickStock(pick, items);
  if (stock.status === 'missing') return { ...stock, available: 0, cue: 'Not in inventory' };
  const available = Math.max(0, stock.onHand - (Number(reserved) || 0));
  if (available <= 0) return { ...stock, available: 0, cue: 'Out of stock' };
  return { ...stock, available, cue: `In stock, ${available} on hand` };
}

export function lineFromQuickPick(pick) {
  return {
    description: pick?.description || '',
    sku: pick?.sku || '',
    quantity: 1,
    price: pick?.price ?? '',
    paid: pick?.paid ?? '',
  };
}

function blankIdentity(line) {
  return !String(line?.description || '').trim()
    && !String(line?.sku || '').trim()
    && (line?.price === '' || line?.price == null)
    && (line?.paid === '' || line?.paid == null);
}

/** Fill the empty starter line, or add another line when the job already has parts. */
export function applyQuickPick(lines, pick) {
  const next = lineFromQuickPick(pick);
  const current = Array.isArray(lines) && lines.length ? lines : [];
  if (current.length === 1 && blankIdentity(current[0])) {
    const quantity = current[0].quantity;
    return [{
      ...next,
      quantity: quantity === '' || quantity == null ? 1 : quantity,
    }];
  }
  return [...current, next];
}
