/**
 * A part chosen on the inventory page becomes a line on a service job.
 * Quantity that is on the shelf is drawn. An empty shelf is still a charge
 * and does not record a use.
 */

import { computeServiceJobTotals } from './customerWork.js';
import { reconcileVariance } from './subcontractorWorkOrders.js';

export function lineForInventoryOnJob(item = {}, { quantity, price } = {}) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { error: 'Quantity must be greater than zero' };
  }
  const sold = price === '' || price == null ? 0 : Number(price);
  if (!Number.isFinite(sold) || sold < 0) {
    return { error: 'Price must be a non-negative number' };
  }
  const description = String(item.name || '').trim();
  const sku = String(item.sku || '').trim();
  if (!description && !sku) return { error: 'Item name is required' };

  const onHand = Number(item.currentStock) || 0;
  if (onHand > 0 && qty > onHand) return { error: `Only ${onHand} on hand` };

  const paid = Number(item.lastPrice);
  const line = {
    description,
    sku,
    quantity: qty,
    price: sold,
    ...(Number.isFinite(paid) && paid >= 0 ? { paid } : {}),
  };
  if (onHand > 0) {
    line.inventoryDisposition = 'draw';
    line.inventoryItemId = String(item._id);
  }
  return { line };
}

/** Labor, travel, and every charge line, including the part just added. */
export function totalsForJobLines(job = {}, chargeLines = []) {
  const totals = computeServiceJobTotals({
    hoursWorked: job.hoursWorked,
    hourlyRate: job.hourlyRate,
    travelPay: job.travelPay,
    chargeLines,
  });
  return {
    ...totals,
    variance: reconcileVariance(totals.amountDue, job.paidAmount),
  };
}
