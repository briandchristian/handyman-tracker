/**
 * Seeded internal cost centers for the light ledger.
 * Default class is indirect; a source row with a job is classified Direct.
 */

export const COST_CENTERS = [
  { code: 'OFFICE', name: 'Office overhead', defaultClass: 'indirect' },
  { code: 'BIDDING', name: 'Bidding', defaultClass: 'indirect' },
  { code: 'FUEL', name: 'Fuel', defaultClass: 'indirect' },
  { code: 'CONSUMABLES', name: 'Consumables', defaultClass: 'indirect' },
  { code: 'VEHICLE', name: 'Vehicle', defaultClass: 'indirect' },
  { code: 'LICENSES', name: 'Licenses and permits', defaultClass: 'indirect' },
  { code: 'TOOLS', name: 'Tools', defaultClass: 'indirect' },
  { code: 'WARRANTY', name: 'Warranty (unassigned)', defaultClass: 'indirect' },
  { code: 'MISC', name: 'Misc', defaultClass: 'indirect' },
];

export const COST_CENTER_CODES = COST_CENTERS.map((center) => center.code);

export function normalizeCostCenterCode(code) {
  return String(code || '').trim().toUpperCase();
}

export function isKnownCostCenter(code) {
  return COST_CENTER_CODES.includes(normalizeCostCenterCode(code));
}

export function costCenterName(code) {
  const normalized = normalizeCostCenterCode(code);
  const match = COST_CENTERS.find((center) => center.code === normalized);
  return match?.name || normalized || 'Unknown';
}
