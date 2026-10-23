/**
 * Open section headings for the current login.
 * sessionStorage lasts for this tab until logout or the next sign-in.
 * A new login starts with every heading closed.
 */

const STORAGE_KEY = 'section-toggles';

export function sectionToggleKey(pathname, title) {
  return `${pathname}::${title}`;
}

function readMap() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function sectionIsOpen(key) {
  return readMap()[key] === true;
}

export function setSectionOpen(key, open) {
  const map = readMap();
  if (open) map[key] = true;
  else delete map[key];
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function clearSectionToggles() {
  sessionStorage.removeItem(STORAGE_KEY);
}
