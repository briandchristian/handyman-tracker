/**
 * Unit tests for inventory stock math and SKU normalization.
 * These rules are the foundation for PO receiving and job material usage.
 */

import {
  applyJobUsageToProject,
  applyStockChange,
  isDuplicateKeyError,
  jobAssignmentError,
  materialMatchesInventoryItem,
  normalizeSku,
  reconcileCount,
  STOCK_MOVEMENT_TYPES,
} from '../lib/inventoryStock.js';

describe('normalizeSku', () => {
  test('trims and keeps a real SKU', () => {
    expect(normalizeSku('  LUM-2X4  ')).toBe('LUM-2X4');
  });

  test('treats blank SKUs as unset so unique indexes do not collide', () => {
    expect(normalizeSku('')).toBeNull();
    expect(normalizeSku('   ')).toBeNull();
    expect(normalizeSku(null)).toBeNull();
    expect(normalizeSku(undefined)).toBeNull();
  });
});

describe('applyStockChange', () => {
  test('adds stock', () => {
    expect(applyStockChange(10, { type: STOCK_MOVEMENT_TYPES.add, quantity: 5 })).toEqual({
      previousStock: 10,
      newStock: 15,
      delta: 5,
    });
  });

  test('removes stock', () => {
    expect(applyStockChange(10, { type: STOCK_MOVEMENT_TYPES.remove, quantity: 4 })).toEqual({
      previousStock: 10,
      newStock: 6,
      delta: -4,
    });
  });

  test('receive is the same as add (PO receiving)', () => {
    expect(applyStockChange(2, { type: STOCK_MOVEMENT_TYPES.receive, quantity: 8 }).newStock).toBe(10);
  });

  test('use is the same as remove (job materials)', () => {
    expect(applyStockChange(5, { type: STOCK_MOVEMENT_TYPES.use, quantity: 2 }).newStock).toBe(3);
  });

  test('set replaces the on-hand count', () => {
    expect(applyStockChange(10, { type: STOCK_MOVEMENT_TYPES.set, quantity: 3 })).toEqual({
      previousStock: 10,
      newStock: 3,
      delta: -7,
    });
  });

  test('rejects a remove that would go negative', () => {
    expect(applyStockChange(3, { type: STOCK_MOVEMENT_TYPES.remove, quantity: 4 })).toEqual({
      error: 'Stock cannot be negative',
    });
  });

  test('rejects negative quantity', () => {
    expect(applyStockChange(10, { type: STOCK_MOVEMENT_TYPES.add, quantity: -1 }).error).toMatch(
      /non-negative/i
    );
  });

  test('rejects invalid type', () => {
    expect(applyStockChange(10, { type: 'gift', quantity: 1 }).error).toMatch(/invalid movement type/i);
  });

  test('untracked use does not change on-hand stock', () => {
    expect(applyStockChange(0, { type: STOCK_MOVEMENT_TYPES.untracked, quantity: 4 })).toEqual({
      previousStock: 0,
      newStock: 0,
      delta: 0,
    });
    expect(applyStockChange(8, { type: STOCK_MOVEMENT_TYPES.untracked, quantity: 2 })).toEqual({
      previousStock: 8,
      newStock: 8,
      delta: 0,
    });
  });

  test('rejects untracked use of zero', () => {
    expect(applyStockChange(0, { type: STOCK_MOVEMENT_TYPES.untracked, quantity: 0 }).error).toMatch(
      /greater than zero/i
    );
  });
});

describe('isDuplicateKeyError', () => {
  test('detects Mongo duplicate key errors', () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(isDuplicateKeyError({ code: '11000' })).toBe(true);
    expect(isDuplicateKeyError({ code: 1 })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});

describe('reconcileCount', () => {
  test('shortage: counted less than book is unrecorded use', () => {
    expect(reconcileCount(50, 42)).toEqual({
      book: 50,
      counted: 42,
      delta: -8,
      usedQuantity: 8,
      foundQuantity: 0,
    });
  });

  test('overage: counted more than book is found stock', () => {
    expect(reconcileCount(10, 12)).toEqual({
      book: 10,
      counted: 12,
      delta: 2,
      usedQuantity: 0,
      foundQuantity: 2,
    });
  });

  test('count matching book has no variance', () => {
    expect(reconcileCount(7, 7).delta).toBe(0);
    expect(reconcileCount(7, 7).usedQuantity).toBe(0);
    expect(reconcileCount(7, 7).foundQuantity).toBe(0);
  });

  test('empty shelf is a valid count of zero', () => {
    expect(reconcileCount(4, 0)).toEqual({
      book: 4,
      counted: 0,
      delta: -4,
      usedQuantity: 4,
      foundQuantity: 0,
    });
  });

  test('rejects a negative counted quantity', () => {
    expect(reconcileCount(10, -1).error).toMatch(/non-negative/i);
  });
});

describe('jobAssignmentError', () => {
  test('allows no job on any stock change', () => {
    expect(jobAssignmentError(-3, {})).toBeNull();
    expect(jobAssignmentError(5, {})).toBeNull();
  });

  test('requires both customer and job when assigning use', () => {
    expect(jobAssignmentError(-2, { customerId: 'c1' })).toMatch(/customer and job/i);
    expect(jobAssignmentError(-2, { projectId: 'p1' })).toMatch(/customer and job/i);
  });

  test('allows a job only when stock is reduced', () => {
    expect(jobAssignmentError(-8, { customerId: 'c1', projectId: 'p1' })).toBeNull();
    expect(jobAssignmentError(0, { customerId: 'c1', projectId: 'p1' })).toMatch(/reduced/i);
    expect(jobAssignmentError(3, { customerId: 'c1', projectId: 'p1' })).toMatch(/reduced/i);
  });

  test('requires a job for untracked use even when stock does not change', () => {
    expect(jobAssignmentError(0, { type: 'untracked' })).toMatch(/never received/i);
    expect(jobAssignmentError(0, { type: 'untracked', customerId: 'c1', projectId: 'p1' })).toBeNull();
  });
});

describe('materialMatchesInventoryItem', () => {
  const item = { _id: 'item1', sku: 'LUM-2X4', name: '2x4 Lumber' };

  test('matches by inventory item id', () => {
    expect(materialMatchesInventoryItem({ inventoryItemId: 'item1', quantity: 1 }, item)).toBe(true);
  });

  test('matches by SKU', () => {
    expect(materialMatchesInventoryItem({ sku: 'LUM-2X4', item: 'Other label' }, item)).toBe(true);
  });

  test('matches by item name when the job line has no SKU', () => {
    expect(materialMatchesInventoryItem({ item: '2x4 Lumber', quantity: 2 }, item)).toBe(true);
  });

  test('does not match a different SKU', () => {
    expect(materialMatchesInventoryItem({ sku: 'OTHER', item: '2x4 Lumber' }, item)).toBe(false);
  });
});

describe('applyJobUsageToProject', () => {
  test('adds a new material line when the job has not used this item', () => {
    const project = { name: 'Alarm', materials: [] };
    const line = applyJobUsageToProject(project, { _id: 'item1', sku: 'LUM-2X4', name: '2x4 Lumber', lastPrice: 4 }, 3);
    expect(project.materials).toHaveLength(1);
    expect(line).toMatchObject({ sku: 'LUM-2X4', quantity: 3, cost: 4 });
  });

  test('increments an existing SKU line instead of duplicating it', () => {
    const project = {
      name: 'Alarm',
      materials: [{ item: '2x4 Lumber', sku: 'LUM-2X4', quantity: 2, cost: 4 }],
    };
    applyJobUsageToProject(project, { _id: 'item1', sku: 'LUM-2X4', name: '2x4 Lumber', lastPrice: 4 }, 5);
    expect(project.materials).toHaveLength(1);
    expect(project.materials[0].quantity).toBe(7);
  });

  test('keeps untracked job charges on a separate line so stock is not restored later', () => {
    const project = {
      name: 'Alarm',
      materials: [{ item: '2x4 Lumber', sku: 'LUM-2X4', quantity: 2, cost: 4 }],
    };
    applyJobUsageToProject(
      project,
      { _id: 'item1', sku: 'LUM-2X4', name: '2x4 Lumber', lastPrice: 4 },
      3,
      { chargedFromStock: false }
    );
    expect(project.materials).toHaveLength(2);
    expect(project.materials[1]).toMatchObject({ quantity: 3, chargedFromStock: false });
  });
});
