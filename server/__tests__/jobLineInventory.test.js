/**
 * Job lines choose whether a purchase stays in inventory or is used on the job.
 * The supplier is required when the quantity is purchased.
 */

import { inventoryPlanError, inventoryPlans, stockStillOwed } from '../lib/jobLineInventory.js';

const supplier = '64b0supplier00000000000001';

describe('job line inventory', () => {
  test('a kept line is purchased onto the shelf', () => {
    const plans = inventoryPlans([], [{
      description: 'Switch',
      sku: 'SW-1',
      quantity: 2,
      paid: 180,
      inventoryDisposition: 'stock',
      supplierId: supplier,
    }]);
    expect(plans).toEqual([
      expect.objectContaining({
        sku: 'SW-1',
        paid: 180,
        supplierId: supplier,
        movements: [{ type: 'receive', quantity: 2, reason: 'purchased' }],
      }),
    ]);
  });

  test('using a new line purchases it and then uses it on the job', () => {
    const plans = inventoryPlans([], [{
      description: 'Switch',
      sku: 'SW-1',
      quantity: 2,
      paid: 180,
      inventoryDisposition: 'used',
      supplierId: supplier,
    }]);
    expect(plans[0].movements).toEqual([
      { type: 'receive', quantity: 2, reason: 'purchased' },
      { type: 'use', quantity: 2, reason: 'used' },
    ]);
  });

  test('using a line that is already on the shelf for this job does not purchase it again', () => {
    const plans = inventoryPlans(
      [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: 'stock', supplierId: supplier }],
      [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: 'used', supplierId: supplier }],
    );
    expect(plans[0].movements).toEqual([{ type: 'use', quantity: 2, reason: 'used' }]);
  });

  test('a line already tied to an inventory item counts as used until the choice changes', () => {
    expect(inventoryPlans(
      [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryItemId: 'item1' }],
      [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: 'used', inventoryItemId: 'item1' }],
    )).toEqual([]);
  });

  test('clearing a stocked line removes it from the shelf', () => {
    const plans = inventoryPlans(
      [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: 'stock' }],
      [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: '' }],
    );
    expect(plans[0].movements).toEqual([{ type: 'remove', quantity: 2, reason: 'removed' }]);
  });

  test('a purchase without a supplier is rejected', () => {
    const next = [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: 'stock' }];
    expect(inventoryPlanError(next, inventoryPlans([], next))).toMatch(/supplier/i);
  });

  test('drawing stock on hand uses it and does not purchase another', () => {
    const plans = inventoryPlans([], [{
      description: 'Switch',
      sku: 'SW-1',
      quantity: 2,
      paid: 180,
      price: 500,
      inventoryDisposition: 'draw',
      inventoryItemId: 'item1',
    }]);
    expect(plans[0].movements).toEqual([{ type: 'use', quantity: 2, reason: 'used' }]);
    expect(plans[0].paid).toBe(180);
    expect(plans[0].price).toBe(500);
  });

  test('removing a drawn line puts that quantity back on the shelf', () => {
    const plans = inventoryPlans(
      [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: 'draw' }],
      [],
    );
    expect(plans[0].movements).toEqual([{ type: 'add', quantity: 2, reason: 'returned' }]);
  });

  test('a kept quantity is still owed after this job received it and then removed it', () => {
    const owed = stockStillOwed(1, [
      { type: 'receive', quantity: 1 },
      { type: 'remove', quantity: 1 },
    ]);
    expect(owed).toBe(1);
    expect(stockStillOwed(1, [{ type: 'receive', quantity: 1 }])).toBe(0);
  });

  test('a shelf use does not require a new supplier', () => {
    const next = [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: 'used' }];
    const plans = inventoryPlans(
      [{ description: 'Switch', sku: 'SW-1', quantity: 2, inventoryDisposition: 'stock', supplierId: supplier }],
      next,
    );
    expect(inventoryPlanError(next, plans)).toBeNull();
  });
});
