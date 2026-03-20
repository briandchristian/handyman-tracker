/**
 * Equipment categories for projects (alarm / security scope).
 * Keys match API `project.equipmentCategories` booleans.
 */
export const EQUIPMENT_CATEGORY_OPTIONS = [
  { key: 'burglarAlarm', label: 'Burglar Alarm' },
  { key: 'fireAlarm', label: 'Fire Alarm' },
  { key: 'accessControl', label: 'Access Control' },
  { key: 'cctv', label: 'CCTV' },
  { key: 'monitoring', label: 'Monitoring' }
];

export function emptyEquipmentCategories() {
  return {
    burglarAlarm: false,
    fireAlarm: false,
    accessControl: false,
    cctv: false,
    monitoring: false
  };
}

/** @param {Record<string, boolean>|null|undefined} raw */
export function normalizeEquipmentCategories(raw) {
  const base = emptyEquipmentCategories();
  if (!raw || typeof raw !== 'object') return base;
  EQUIPMENT_CATEGORY_OPTIONS.forEach(({ key }) => {
    if (raw[key]) base[key] = true;
  });
  return base;
}

/** @param {Record<string, boolean>|null|undefined} cats */
export function formatEquipmentCategoriesLabels(cats) {
  const n = normalizeEquipmentCategories(cats);
  return EQUIPMENT_CATEGORY_OPTIONS.filter(({ key }) => n[key]).map((o) => o.label);
}

/**
 * Build sentence for the "Proposed System" block above materials.
 * @param {Record<string, boolean>|null|undefined} cats
 */
export function buildProposedSystemStatement(cats) {
  const n = normalizeEquipmentCategories(cats);
  const phrases = [];
  if (n.burglarAlarm) phrases.push('a wireless/hardwired burglar alarm system');
  if (n.fireAlarm) phrases.push('a fire alarm system');
  if (n.accessControl) phrases.push('an access control system');
  if (n.cctv) phrases.push('a CCTV system');

  if (phrases.length === 0) return '';
  if (phrases.length === 1) {
    return `Professional installation of ${phrases[0]} including:`;
  }
  if (phrases.length === 2) {
    return `Professional installation of ${phrases[0]} and ${phrases[1]} including:`;
  }
  return `Professional installation of ${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]} including:`;
}
