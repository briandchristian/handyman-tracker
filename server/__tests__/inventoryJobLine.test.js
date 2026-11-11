/**
 * Adding an inventory item onto a job from the inventory page.
 * Stock on hand is drawn and the job records the cost, the price, and the quantity.
 * An empty shelf still becomes a charge on the job and does not change stock.
 */

import { lineForInventoryOnJob, totalsForJobLines } from '../lib/inventoryJobLine.js';

const switchItem = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Switch',
  sku: 'SW-1',
  currentStock: 4,
  lastPrice: 180,
};

describe('lineForInventoryOnJob', () => {
  test('draws stock on hand and keeps the cost and the price', () => {
    const built = lineForInventoryOnJob(switchItem, { quantity: 2, price: 500 });
    expect(built.line).toEqual({
      description: 'Switch',
      sku: 'SW-1',
      quantity: 2,
      price: 500,
      paid: 180,
      inventoryDisposition: 'draw',
      inventoryItemId: '507f1f77bcf86cd799439011',
    });
  });

  test('refuses a quantity larger than the shelf', () => {
    const built = lineForInventoryOnJob(switchItem, { quantity: 5, price: 500 });
    expect(built.error).toBe('Only 4 on hand');
  });

  test('adds an out-of-stock part as a charge without drawing it', () => {
    const built = lineForInventoryOnJob(
      { ...switchItem, currentStock: 0 },
      { quantity: '1', price: '' }
    );
    expect(built.line).toEqual({
      description: 'Switch',
      sku: 'SW-1',
      quantity: 1,
      price: 0,
      paid: 180,
    });
    expect(built.line.inventoryItemId).toBeUndefined();
    expect(built.line.inventoryDisposition).toBeUndefined();
  });

  test('requires a quantity greater than zero', () => {
    expect(lineForInventoryOnJob(switchItem, { quantity: 0, price: 10 }).error)
      .toBe('Quantity must be greater than zero');
  });
});

describe('totalsForJobLines', () => {
  test('adds the new part price to the amount due', () => {
    const totals = totalsForJobLines(
      { hoursWorked: 1, hourlyRate: 75, travelPay: 0, paidAmount: 100 },
      [{ quantity: 1, price: 85 }, { quantity: 1, price: 500 }]
    );
    expect(totals.linesTotal).toBe(585);
    expect(totals.amountDue).toBe(660);
    expect(totals.variance).toBe(-560);
  });
});
