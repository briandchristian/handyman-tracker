/**
 * Labor work types for the light ledger.
 * Direct types count toward a job when a projectId is present.
 */

export const LABOR_WORK_TYPES = [
  { value: 'install', label: 'Install', defaultClass: 'direct', billable: true },
  { value: 'service', label: 'Service', defaultClass: 'direct', billable: true },
  { value: 'consult', label: 'Consult', defaultClass: 'direct', billable: true },
  { value: 'warranty', label: 'Warranty', defaultClass: 'direct', billable: false },
  { value: 'bidding', label: 'Bidding', defaultClass: 'indirect', billable: false },
  { value: 'admin', label: 'Admin', defaultClass: 'indirect', billable: false },
  { value: 'misc', label: 'Misc', defaultClass: 'indirect', billable: false },
];

export const LABOR_WORK_TYPE_VALUES = LABOR_WORK_TYPES.map((type) => type.value);

export const DIRECT_LABOR_WORK_TYPES = LABOR_WORK_TYPES
  .filter((type) => type.defaultClass === 'direct')
  .map((type) => type.value);

export const INDIRECT_LABOR_WORK_TYPES = LABOR_WORK_TYPES
  .filter((type) => type.defaultClass === 'indirect')
  .map((type) => type.value);

export const JOB_LABOR_WORK_TYPES = DIRECT_LABOR_WORK_TYPES;

export function normalizeLaborWorkType(workType) {
  return String(workType || '').trim().toLowerCase();
}

export function isKnownLaborWorkType(workType) {
  return LABOR_WORK_TYPE_VALUES.includes(normalizeLaborWorkType(workType));
}
