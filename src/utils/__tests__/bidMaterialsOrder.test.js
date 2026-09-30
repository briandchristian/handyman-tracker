/**
 * Bid worksheet line order: move one line onto another, and apply a full id list.
 */
import { moveBidMaterial, reorderByIds } from '../bidMaterialsOrder';

const lines = [
  { _id: 'b1', item: 'Camera' },
  { _id: 'b2', item: 'Panel' },
  { _id: 'b3', item: 'Siren' },
];

describe('bidMaterialsOrder', () => {
  test('moves a line to the position of the line it is dropped on', () => {
    expect(moveBidMaterial(lines, 'b1', 'b3').map((line) => line._id)).toEqual(['b2', 'b3', 'b1']);
    expect(moveBidMaterial(lines, 'b3', 'b1').map((line) => line._id)).toEqual(['b3', 'b1', 'b2']);
  });

  test('leaves the list unchanged when the drop target is the same line or unknown', () => {
    expect(moveBidMaterial(lines, 'b2', 'b2')).toBe(lines);
    expect(moveBidMaterial(lines, 'missing', 'b1')).toBe(lines);
    expect(moveBidMaterial(lines, 'b1', 'missing')).toBe(lines);
  });

  test('reorders lines to match the requested ids', () => {
    expect(reorderByIds(lines, ['b3', 'b1', 'b2']).map((line) => line._id)).toEqual(['b3', 'b1', 'b2']);
  });

  test('rejects an order that does not list every line once', () => {
    expect(() => reorderByIds(lines, ['b1', 'b2'])).toThrow(/every line once/);
    expect(() => reorderByIds(lines, ['b1', 'b2', 'b2'])).toThrow(/every line once/);
    expect(() => reorderByIds(lines, ['b1', 'b2', 'nope'])).toThrow(/every line once/);
  });
});
