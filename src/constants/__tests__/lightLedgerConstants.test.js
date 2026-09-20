import { COST_CENTERS, COST_CENTER_CODES, isKnownCostCenter, costCenterName } from '../costCenters';
import {
  LABOR_WORK_TYPES,
  JOB_LABOR_WORK_TYPES,
  INDIRECT_LABOR_WORK_TYPES,
  isKnownLaborWorkType,
} from '../laborWorkTypes';
import {
  DEFAULT_PROJECT_WORK_TYPE,
  jobMatchesWorkTypeFilter,
  normalizeProjectWorkType,
  projectWorkTypeLabel,
  serviceHistoryTypeFromProjectWorkType,
} from '../projectWorkTypes';

describe('light ledger constants', () => {
  test('exposes seeded cost centers used by the accounting UI', () => {
    expect(COST_CENTER_CODES).toEqual(expect.arrayContaining(['OFFICE', 'BIDDING', 'FUEL', 'CONSUMABLES']));
    expect(isKnownCostCenter('fuel')).toBe(true);
    expect(costCenterName('OFFICE')).toBe(COST_CENTERS[0].name);
  });

  test('exposes labor and project work types', () => {
    expect(LABOR_WORK_TYPES.map((type) => type.value)).toEqual(expect.arrayContaining(['install', 'bidding']));
    expect(JOB_LABOR_WORK_TYPES).toEqual(expect.arrayContaining(['install', 'warranty']));
    expect(isKnownLaborWorkType('ADMIN')).toBe(true);
    expect(normalizeProjectWorkType('consult')).toBe('consultation');
    expect(serviceHistoryTypeFromProjectWorkType('service')).toBe('service');
    expect(DEFAULT_PROJECT_WORK_TYPE).toBe('installation');
    expect(projectWorkTypeLabel('')).toBe('Installation');
    expect(projectWorkTypeLabel('service')).toBe('Service');
    expect(jobMatchesWorkTypeFilter(undefined, 'installation')).toBe(true);
    expect(jobMatchesWorkTypeFilter('', 'installation')).toBe(true);
    expect(jobMatchesWorkTypeFilter('install', 'installation')).toBe(true);
    expect(jobMatchesWorkTypeFilter(undefined, 'service')).toBe(false);
    expect(jobMatchesWorkTypeFilter('service', '')).toBe(true);
  });

  test('includes Misc as an overhead cost center and indirect labor work type', () => {
    expect(COST_CENTER_CODES).toContain('MISC');
    expect(isKnownCostCenter('misc')).toBe(true);
    expect(costCenterName('MISC')).toBe('Misc');
    expect(COST_CENTERS.find((center) => center.code === 'MISC')).toMatchObject({
      name: 'Misc',
      defaultClass: 'indirect',
    });

    expect(LABOR_WORK_TYPES.map((type) => type.value)).toContain('misc');
    expect(LABOR_WORK_TYPES.find((type) => type.value === 'misc')).toMatchObject({
      label: 'Misc',
      defaultClass: 'indirect',
    });
    expect(INDIRECT_LABOR_WORK_TYPES).toContain('misc');
    expect(isKnownLaborWorkType('MISC')).toBe(true);
  });
});
