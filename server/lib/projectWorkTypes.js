/**
 * Job work types for customer projects (install vs service vs consult).
 * Distinct from labor workType (hours) and from equipment categories.
 */

export const PROJECT_WORK_TYPES = [
  { value: 'installation', label: 'Installation' },
  { value: 'service', label: 'Service' },
  { value: 'consultation', label: 'Consultation' },
];

export const PROJECT_WORK_TYPE_VALUES = PROJECT_WORK_TYPES.map((type) => type.value);

export const DEFAULT_PROJECT_WORK_TYPE = 'installation';

export function normalizeProjectWorkType(workType) {
  const value = String(workType || '').trim().toLowerCase();
  if (value === 'install') return 'installation';
  if (value === 'consult') return 'consultation';
  if (PROJECT_WORK_TYPE_VALUES.includes(value)) return value;
  return DEFAULT_PROJECT_WORK_TYPE;
}

/** Blank, install, and INSTALLATION all count as installation for Job profit filters. */
export function jobMatchesWorkTypeFilter(workType, filter) {
  if (!filter) return true;
  return normalizeProjectWorkType(workType) === String(filter).trim().toLowerCase();
}

export function projectWorkTypeLabel(workType) {
  const value = normalizeProjectWorkType(workType);
  return PROJECT_WORK_TYPES.find((type) => type.value === value)?.label || 'Installation';
}

/** Map project.workType onto ServiceHistory.type. */
export function serviceHistoryTypeFromProjectWorkType(workType) {
  return normalizeProjectWorkType(workType);
}
