/**
 * Quick picks reuse a job line's description, SKU, price, and paid amount.
 * Quantity is chosen on the job, not stored on the pick.
 */

import {
  applyQuickPick,
  compareQuickPicks,
  matchingQuickPick,
  normalizeQuickPick,
  quickPickAvailability,
  quickPickLabel,
  quickPickStock,
} from '../quickPicks';

describe('quick picks', () => {
  test('keeps description, SKU, price, and paid from a job line', () => {
    expect(normalizeQuickPick({
      description: '  Door contact ',
      sku: ' DC-1 ',
      price: '32.5',
      paid: 13.926,
    })).toEqual({
      ok: true,
      value: { description: 'Door contact', sku: 'DC-1', price: 32.5, paid: 13.93 },
    });
  });

  test('allows a blank paid amount and a zero price', () => {
    expect(normalizeQuickPick({ description: 'Labor trip', sku: '', price: 0, paid: '' }).value).toEqual({
      description: 'Labor trip',
      sku: '',
      price: 0,
      paid: null,
    });
  });

  test('requires a description or a SKU', () => {
    expect(normalizeQuickPick({ description: '  ', sku: '', price: 10 })).toEqual({
      ok: false,
      error: 'Enter a description or SKU before saving a quick pick',
    });
  });

  test('rejects a negative price or paid amount', () => {
    expect(normalizeQuickPick({ description: 'Relay', price: -1 }).ok).toBe(false);
    expect(normalizeQuickPick({ sku: 'RL-1', paid: -0.01 }).error).toBe('Paid must be zero or more');
  });

  test('matches an existing part by SKU regardless of letter case', () => {
    const saved = [{ _id: 'qp1', description: 'Door contact', sku: 'DC-1', price: 32, paid: 14 }];
    expect(matchingQuickPick(saved, { description: 'Contact', sku: 'dc-1' })?._id).toBe('qp1');
  });

  test('matches a description only when the saved part has no SKU', () => {
    const saved = [
      { _id: 'sku', description: 'Service call', sku: 'SVC', price: 85, paid: null },
      { _id: 'plain', description: 'Service call', sku: '', price: 85, paid: null },
    ];
    expect(matchingQuickPick(saved, { description: 'service call', sku: '' })?._id).toBe('plain');
  });

  test('labels a pick with the charge and the cost', () => {
    expect(quickPickLabel({ description: 'Switch', sku: 'SW-1', price: 500, paid: 180 }))
      .toBe('Switch · SW-1 · $500.00 · paid $180.00');
  });

  test('sorts picks by description, then SKU', () => {
    const picks = [
      { description: 'Switch', sku: 'SW-2' },
      { description: 'relay', sku: 'RL-1' },
      { description: 'Switch', sku: 'SW-1' },
    ];
    expect([...picks].sort(compareQuickPicks).map((pick) => pick.sku)).toEqual(['RL-1', 'SW-1', 'SW-2']);
  });

  test('fills the blank starter line and keeps a quantity already typed there', () => {
    expect(applyQuickPick(
      [{ description: '', sku: '', quantity: 3, price: '', paid: '' }],
      { description: 'Switch', sku: 'SW-1', price: 500, paid: 180 },
    )).toEqual([
      { description: 'Switch', sku: 'SW-1', quantity: 3, price: 500, paid: 180 },
    ]);
  });

  test('says a quick pick is missing until an inventory item exists', () => {
    expect(quickPickStock({ description: 'Switch', sku: 'SW-1' }, [])).toEqual({
      status: 'missing',
      onHand: 0,
      item: null,
    });
  });

  test('marks an inventory item with nothing on hand as out of stock', () => {
    const item = { _id: 'item1', name: 'Switch', sku: 'SW-1', currentStock: 0 };
    expect(quickPickStock({ description: 'Switch', sku: 'sw-1' }, [item])).toEqual({
      status: 'out',
      onHand: 0,
      item,
    });
  });

  test('marks stock on hand and reduces it by quantities already chosen on the job', () => {
    const item = { _id: 'item1', name: 'Switch', sku: 'SW-1', currentStock: 4 };
    expect(quickPickAvailability({ sku: 'SW-1' }, [item], 1)).toEqual({
      status: 'in',
      onHand: 4,
      item,
      available: 3,
      cue: 'In stock, 3 on hand',
    });
    expect(quickPickAvailability({ sku: 'SW-1' }, [item], 4).cue).toBe('Out of stock');
  });

  test('adds a new line when the job already has a part', () => {
    const lines = applyQuickPick(
      [{ description: 'Keypad', sku: '', quantity: 1, price: 85, paid: '' }],
      { description: 'Switch', sku: 'SW-1', price: 500, paid: null },
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({ description: 'Switch', sku: 'SW-1', quantity: 1, price: 500, paid: '' });
  });
});
