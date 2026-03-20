/**
 * Unit tests for equipment category helpers used by project forms and API payloads.
 */
import {
  buildProposedSystemStatement,
  emptyEquipmentCategories,
  normalizeEquipmentCategories,
  formatEquipmentCategoriesLabels
} from '../equipmentCategories';

describe('equipmentCategories helpers', () => {
  test('emptyEquipmentCategories returns all false', () => {
    expect(emptyEquipmentCategories()).toEqual({
      burglarAlarm: false,
      fireAlarm: false,
      accessControl: false,
      cctv: false,
      monitoring: false
    });
  });

  test('normalizeEquipmentCategories fills missing keys and treats truthy only', () => {
    expect(normalizeEquipmentCategories({ burglarAlarm: true })).toEqual({
      burglarAlarm: true,
      fireAlarm: false,
      accessControl: false,
      cctv: false,
      monitoring: false
    });
    expect(normalizeEquipmentCategories(null)).toEqual(emptyEquipmentCategories());
  });

  test('formatEquipmentCategoriesLabels returns labels for selected categories', () => {
    expect(
      formatEquipmentCategoriesLabels({
        burglarAlarm: true,
        fireAlarm: true,
        accessControl: false,
        cctv: false,
        monitoring: false
      })
    ).toEqual(['Burglar Alarm', 'Fire Alarm']);
  });

  test('buildProposedSystemStatement returns burglar statement', () => {
    expect(
      buildProposedSystemStatement({
        burglarAlarm: true,
        fireAlarm: false,
        accessControl: false,
        cctv: false,
        monitoring: false
      })
    ).toBe('Professional installation of a wireless/hardwired burglar alarm system including:');
  });

  test('buildProposedSystemStatement concatenates multiple systems naturally', () => {
    expect(
      buildProposedSystemStatement({
        burglarAlarm: true,
        fireAlarm: true,
        accessControl: true,
        cctv: true,
        monitoring: false
      })
    ).toBe(
      'Professional installation of a wireless/hardwired burglar alarm system, a fire alarm system, an access control system, and a CCTV system including:'
    );
  });
});
