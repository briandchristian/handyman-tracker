/**
 * Copy bid worksheet lines into inventory when they are not already on hand.
 * New rows start at zero quantity. An existing part number is a conflict until overwrite is chosen.
 */
import { inventoryConflictMessage, inventoryItemsFromBidLines, bidPartLinkTone, inventoryPartKeySet } from '../inventoryFromBid';

describe('inventoryFromBid', () => {
  const lines = [
    { item: 'Glassbreak', sku: 'Q9-IQRPG', quantity: 2, estimate: 40 },
    { item: 'Existing camera', sku: '3W-MX922', quantity: 1, estimate: 28 },
    { item: 'Wave relay', sku: 'WE-4421', quantity: 1, estimate: 15 },
  ];

  test('creates missing lines at zero quantity and reports an existing part number', () => {
    const { created, conflicts, updates } = inventoryItemsFromBidLines(lines, [
      { _id: 'inv1', name: 'Camera', sku: 'BAR-1', supplierPartNumber: '3W-MX922' },
    ]);

    expect(updates).toEqual([]);
    expect(conflicts).toEqual([
      expect.objectContaining({ existingId: 'inv1', partNumber: '3W-MX922', name: 'Existing camera' }),
    ]);
    expect(created[0]).not.toHaveProperty('sku');
    expect(created[0].preferredSupplier).toBeNull();
    expect(created).toEqual([
      expect.objectContaining({
        name: 'Glassbreak',
        supplierPartNumber: 'Q9-IQRPG',
        currentStock: 0,
        lastPrice: 40,
      }),
      expect.objectContaining({
        name: 'Wave relay',
        supplierPartNumber: 'WE-4421',
        currentStock: 0,
        lastPrice: 15,
      }),
    ]);
  });

  test('overwrites an existing part without creating a second item or clearing stock', () => {
    const { created, conflicts, updates } = inventoryItemsFromBidLines(
      [{ item: 'Existing camera', sku: '3W-MX922', estimate: 28 }],
      [{ _id: 'inv1', name: 'Camera', sku: 'BAR-1', supplierPartNumber: '3W-MX922', currentStock: 4 }],
      { overwrite: true }
    );

    expect(conflicts).toEqual([]);
    expect(created).toEqual([]);
    expect(updates).toEqual([
      expect.objectContaining({
        _id: 'inv1',
        name: 'Existing camera',
        supplierPartNumber: '3W-MX922',
        lastPrice: 28,
      }),
    ]);
    expect(updates[0].currentStock).toBeUndefined();
  });

  test('matches a part number stored inside a combined barcode and part sku', () => {
    const { created, conflicts } = inventoryItemsFromBidLines(
      [{ item: 'Glassbreak', sku: 'Q9-IQRPG', estimate: 40 }],
      [{ _id: 'inv1', name: 'Sensor', sku: '012345 | Q9-IQRPG', supplierPartNumber: '' }]
    );
    expect(created).toEqual([]);
    expect(conflicts).toEqual([
      expect.objectContaining({ existingId: 'inv1', partNumber: 'Q9-IQRPG' }),
    ]);
  });

  test('keeps the ADI supplier on a line sent from the worksheet', () => {
    const { created } = inventoryItemsFromBidLines(
      [{ item: 'Glassbreak', sku: 'Q9-IQRPG', estimate: 40 }],
      [],
      { preferredSupplierId: 'adi-1' }
    );
    expect(created[0].preferredSupplier).toBe('adi-1');
    expect(created[0].supplierPartNumber).toBe('Q9-IQRPG');
  });

  test('asks to overwrite or cancel when a part number already exists', () => {
    expect(inventoryConflictMessage([
      { partNumber: 'Q9-IQRPG', name: 'Glassbreak' },
    ])).toBe('Q9-IQRPG already exists in inventory. Overwrite it, or cancel.');
    expect(inventoryConflictMessage([
      { partNumber: 'Q9-IQRPG', name: 'Glassbreak' },
      { partNumber: 'WE-4421', name: 'Wave relay' },
    ])).toBe('Q9-IQRPG, WE-4421 already exist in inventory. Overwrite them, or cancel.');
  });

  test('colors an existing part green only until refresh, and a new part blue', () => {
    const onHand = inventoryPartKeySet([
      { supplierPartNumber: 'Q9-IQRPG', sku: 'BAR-1' },
    ]);
    expect(bidPartLinkTone('Q9-IQRPG', onHand, [])).toBe('blue');
    expect(bidPartLinkTone('Q9-IQRPG', onHand, ['Q9-IQRPG'])).toBe('green');
    expect(bidPartLinkTone('WE-4421', onHand, [])).toBe('');
  });
});
