import {
  movementsForQuantityDelta,
  partPaidTotal,
  partQuantityDeltas,
  partSoldTotal,
  subcontractorPartsJob,
  subcontractorJobForAccounting,
  syncPartLines,
} from '../lib/jobParts.js';

describe('jobParts', () => {
  test('a new part is purchased and then used, and a removed part reverses both', () => {
    expect(movementsForQuantityDelta(2)).toEqual([
      { type: 'receive', quantity: 2 },
      { type: 'use', quantity: 2 },
    ]);
    expect(movementsForQuantityDelta(-1)).toEqual([
      { type: 'add', quantity: 1 },
      { type: 'remove', quantity: 1 },
    ]);
    expect(movementsForQuantityDelta(0)).toEqual([]);
  });

  test('quantity changes group by sku and ignore unchanged lines', () => {
    const deltas = partQuantityDeltas(
      [{ description: 'Contact', sku: 'DC-1', quantity: 1, cost: 4 }],
      [
        { description: 'Contact', sku: 'DC-1', quantity: 3, paid: 4 },
        { item: 'Wire', quantity: 2, cost: 1 },
      ]
    );
    expect(deltas).toEqual([
      expect.objectContaining({ sku: 'DC-1', delta: 2, paid: 4 }),
      expect.objectContaining({ description: 'Wire', delta: 2, paid: 1 }),
    ]);
  });

  test('paid is cost and sold is revenue', () => {
    const lines = [
      { quantity: 2, paid: 10, sold: 25 },
      { quantity: 1, cost: 5, sold: 0 },
      { quantity: 1, cost: 8, reimbursable: false, sold: 30 },
    ];
    expect(partPaidTotal(lines)).toBe(33);
    expect(partSoldTotal(lines)).toBe(50);
  });

  test('a subcontractor work order sends parts to accounting and leaves labor off', () => {
    const job = subcontractorPartsJob({
      principal: 'Brinks',
      workOrderNumber: 'BRK-1',
      siteName: 'Lobby',
      laborPay: 200,
      travelPay: 40,
      equipmentLines: [
        { description: 'Contact', quantity: 2, cost: 10, sold: 18 },
        { description: 'Tool', quantity: 1, cost: 15, reimbursable: false },
      ],
      createdAt: '2026-06-01',
    });
    expect(job).toMatchObject({
      jobNumber: 'BRK-1',
      customerName: 'Brinks',
      name: 'Lobby',
      billAmount: 36,
      materials: [
        { quantity: 2, cost: 10 },
        { quantity: 1, cost: 15 },
      ],
    });
    expect(job.laborPay).toBeUndefined();
    expect(job._id).toBeUndefined();
    expect(subcontractorPartsJob({ _id: 'wo1', equipmentLines: [{ description: 'Contact', quantity: 1, cost: 8, sold: 15 }] })._id).toBe('wo1');
    expect(subcontractorPartsJob({ equipmentLines: [] })).toBeNull();
    expect(subcontractorJobForAccounting({
      _id: 'wo2',
      workOrderNumber: 'BRK-2',
      principal: 'Brinks',
      equipmentLines: [],
    })).toBeNull();
    expect(subcontractorJobForAccounting({
      _id: 'wo2',
      workOrderNumber: 'BRK-2',
      principal: 'Brinks',
      equipmentLines: [],
    }, { includeWithoutParts: true })).toMatchObject({
      _id: 'wo2',
      jobNumber: 'BRK-2',
      billAmount: 0,
    });
    expect(subcontractorJobForAccounting({
      _id: 'wo2',
      workOrderNumber: 'BRK-2',
      equipmentLines: [],
    }, { includeWithoutParts: true }).laborPay).toBeUndefined();
  });

  test('sync records the purchase and the use and keeps the inventory id', async () => {
    const movements = [];
    const result = await syncPartLines({
      previous: [],
      next: [{ description: 'Contact', sku: 'DC-1', quantity: 2, paid: 10, sold: 18 }],
      reason: 'Lobby',
      source: { kind: 'job', id: 'wo1' },
      findOrCreate: async () => ({ _id: 'item1' }),
      applyMovement: async (movement) => {
        movements.push(movement);
      },
    });
    expect(movements.map((movement) => movement.type)).toEqual(['receive', 'use']);
    expect(movements[0].reason).toMatch(/purchased/i);
    expect(movements[1].reason).toMatch(/used/i);
    expect(movements[0].unitCost).toBe(10);
    expect(result.lines[0].inventoryItemId).toBe('item1');
  });
});
