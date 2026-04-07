import { findItemBySku, normalizeSkuCode } from '../inventorySkuMatch';

describe('inventorySkuMatch', () => {
  const items = [
    { _id: '1', name: 'A', sku: ' 12345 ' },
    { _id: '2', name: 'B', sku: 'ABC-9' },
  ];

  test('normalizeSkuCode trims', () => {
    expect(normalizeSkuCode('  x  ')).toBe('x');
    expect(normalizeSkuCode(null)).toBe('');
  });

  test('findItemBySku matches trimmed SKU', () => {
    expect(findItemBySku(items, '12345')).toEqual(items[0]);
    expect(findItemBySku(items, '  12345  ')).toEqual(items[0]);
  });

  test('findItemBySku returns null when no match', () => {
    expect(findItemBySku(items, '999')).toBeNull();
    expect(findItemBySku(items, '')).toBeNull();
  });
});
