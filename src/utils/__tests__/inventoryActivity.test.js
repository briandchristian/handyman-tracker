/**
 * Inventory activity totals purchases and uses and keeps cost, price, and job.
 */

import { inventoryActivity } from '../inventoryActivity';

test('totals purchases and uses and keeps the cost, price, and job', () => {
  const activity = inventoryActivity([
    { type: 'receive', quantity: 4, unitCost: 180, unitPrice: 500, reason: 'Purchased for Cameras', newStock: 4 },
    { type: 'use', quantity: 2, unitCost: 180, unitPrice: 500, reason: 'Used on Cameras', newStock: 2 },
  ]);
  expect(activity.purchased).toBe(4);
  expect(activity.used).toBe(2);
  expect(activity.rows[1]).toEqual({
    label: 'Used',
    quantity: 2,
    unitCost: 180,
    unitPrice: 500,
    job: 'Used on Cameras',
    onHand: 2,
  });
});
