/**
 * Stock activity for one inventory item.
 * Purchased is what was received. Used is what left the shelf for a job.
 * Cost is what the part was bought for. Sold is what the job charged.
 * The reason names the job.
 */

const LABELS = {
  receive: 'Purchased',
  use: 'Used',
  untracked: 'Used',
  add: 'Returned',
  remove: 'Removed',
  set: 'Counted',
};

export function inventoryActivity(movements = []) {
  const list = Array.isArray(movements) ? movements : [];
  const purchased = list.reduce((sum, movement) => (
    movement?.type === 'receive' ? sum + (Number(movement.quantity) || 0) : sum
  ), 0);
  const used = list.reduce((sum, movement) => (
    movement?.type === 'use' || movement?.type === 'untracked'
      ? sum + (Number(movement.quantity) || 0)
      : sum
  ), 0);
  const rows = list.map((movement) => ({
    label: LABELS[movement?.type] || 'Adjusted',
    quantity: Number(movement?.quantity) || 0,
    unitCost: movement?.unitCost == null || movement?.unitCost === '' ? null : Number(movement.unitCost),
    unitPrice: movement?.unitPrice == null || movement?.unitPrice === '' ? null : Number(movement.unitPrice),
    job: String(movement?.reason || '').trim(),
    onHand: movement?.newStock,
  }));
  return { purchased, used, rows };
}
