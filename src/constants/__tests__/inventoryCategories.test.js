import { INVENTORY_CATEGORIES } from '../inventoryCategories';

describe('INVENTORY_CATEGORIES', () => {
  it('lists the five security-system categories in order', () => {
    expect(INVENTORY_CATEGORIES).toEqual([
      'Intrusion',
      'Fire',
      'CCTV',
      'Access Control',
      'Monitoring',
    ]);
  });
});
