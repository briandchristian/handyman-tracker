/**
 * Quick picks reuse a job line's description, SKU, price, and paid amount.
 * Quantity is chosen on the job, not stored on the pick.
 * A bid line takes the description and uses the price as the estimate.
 * A blank bid line is filled. A line that already names a part gets another line.
 */

import {
  applyQuickPick,
  applyQuickPickToBid,
  applyQuickPickToEquipment,
  moveQuickPick,
  orderQuickPicks,
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

  test('keeps a saved list order and falls back to name when a line has none', () => {
    const ordered = orderQuickPicks([
      { _id: 'sw', description: 'Switch', sku: 'SW-1' },
      { _id: 'rl', description: 'Relay', sku: 'RL-1', sortOrder: 1 },
      { _id: 'dc', description: 'Contact', sku: 'DC-1', sortOrder: 0 },
    ]);
    expect(ordered.map((pick) => pick._id)).toEqual(['dc', 'rl', 'sw']);
  });

  test('moves a quick pick above or below another line', () => {
    const picks = [
      { _id: 'sw', description: 'Switch', sortOrder: 0 },
      { _id: 'rl', description: 'Relay', sortOrder: 1 },
      { _id: 'dc', description: 'Contact', sortOrder: 2 },
    ];
    expect(moveQuickPick(picks, 'dc', 'sw', 'above').map((pick) => pick._id)).toEqual(['dc', 'sw', 'rl']);
    expect(moveQuickPick(picks, 'sw', 'rl', 'below').map((pick) => pick._id)).toEqual(['rl', 'sw', 'dc']);
    expect(moveQuickPick(picks, 'sw', 'sw', 'below').map((pick) => pick._id)).toEqual(['sw', 'rl', 'dc']);
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

  test('fills a blank reimbursable equipment line from a quick pick', () => {
    expect(applyQuickPickToEquipment(
      [{ description: '', sku: '', quantity: 2, cost: '', sold: '', reimbursable: true }],
      { description: 'Door contact', sku: 'DC-1', price: 32.5, paid: 13.92 },
    )).toEqual([
      {
        description: 'Door contact',
        sku: 'DC-1',
        quantity: 2,
        cost: 13.92,
        sold: 32.5,
        reimbursable: true,
      },
    ]);
  });

  test('keeps an equipment line that is not reimbursable when the starter line was unchecked', () => {
    expect(applyQuickPickToEquipment(
      [{ description: '', sku: '', quantity: '', cost: '', sold: '', reimbursable: false }],
      { description: 'Door contact', sku: 'DC-1', price: null, paid: null },
    )[0]).toMatchObject({ cost: '', sold: '', reimbursable: false, quantity: 1 });
  });

  test('adds another equipment line when reimbursable equipment is already entered', () => {
    const lines = applyQuickPickToEquipment(
      [{ description: 'Motion', sku: '', quantity: 1, cost: 18, sold: '', reimbursable: true }],
      { description: 'Door contact', sku: 'DC-1', price: 32.5, paid: 13.92 },
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({
      description: 'Door contact',
      sku: 'DC-1',
      quantity: 1,
      cost: 13.92,
      sold: 32.5,
      reimbursable: true,
    });
  });

  test('fills a blank bid line with the description and the price as the estimate', () => {
    expect(applyQuickPickToBid(
      [{ description: '', quantity: 4, estimate: '' }],
      { description: 'Switch', sku: 'SW-1', price: 500, paid: 180 },
    )).toEqual([
      { description: 'Switch', quantity: 4, estimate: 500 },
    ]);
  });

  test('uses the SKU as the bid description when the pick has no description', () => {
    expect(applyQuickPickToBid(
      [{ description: '', quantity: '', estimate: '' }],
      { description: '', sku: 'SW-1', price: null, paid: 12 },
    )).toEqual([
      { description: 'SW-1', quantity: 1, estimate: '' },
    ]);
  });

  test('adds another bid line when the quote already has a part', () => {
    const lines = applyQuickPickToBid(
      [{ description: 'Keypad', quantity: 1, estimate: 85 }],
      { description: 'Switch', sku: 'SW-1', price: 500, paid: 180 },
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({ description: 'Switch', quantity: 1, estimate: 500 });
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
