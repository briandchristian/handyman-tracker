/**
 * A barcode SKU and a supplier part number can be the same product.
 * Suppliers sometimes store both in one field, separated by |.
 */
import {
  duplicateIdentityGroups,
  findItemByIdentity,
  mergedInventoryFields,
} from '../inventoryIdentity';

describe('inventoryIdentity', () => {
  test('treats a combined barcode and part number as the same item', () => {
    const items = [
      { _id: 'a', name: 'Glassbreak', sku: '012345 | Q9-IQRPG', supplierPartNumber: '' },
      { _id: 'b', name: 'Sensor', sku: '', supplierPartNumber: 'Q9-IQRPG' },
    ];
    expect(findItemByIdentity(items, 'Q9-IQRPG')._id).toBe('a');
    expect(findItemByIdentity(items, '012345')._id).toBe('a');
    expect(duplicateIdentityGroups(items)).toEqual([items]);
  });

  test('keeps the barcode and the supplier part when two rows are merged', () => {
    const merged = mergedInventoryFields(
      { name: 'Glassbreak', sku: '012345678905', supplierPartNumber: '', currentStock: 2, lastPrice: 40 },
      { name: 'Sensor', sku: '', supplierPartNumber: 'Q9-IQRPG', currentStock: 1, lastPrice: 0 }
    );
    expect(merged).toEqual(expect.objectContaining({
      name: 'Glassbreak',
      sku: '012345678905',
      supplierPartNumber: 'Q9-IQRPG',
      currentStock: 3,
      lastPrice: 40,
      dropped: [],
    }));
  });

  test('does not treat unrelated items as the same', () => {
    const items = [
      { _id: 'a', name: 'Glassbreak', sku: '012345', supplierPartNumber: '' },
      { _id: 'b', name: 'Panel', sku: '', supplierPartNumber: 'PNL-1' },
    ];
    expect(duplicateIdentityGroups(items)).toEqual([]);
    expect(findItemByIdentity(items, 'PNL-1')._id).toBe('b');
  });
});
