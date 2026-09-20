/**
 * Inclusive calendar-day range helpers for the light-ledger period filter.
 * YYYY-MM-DD bounds are treated as UTC start/end of that day.
 * Date inputs keep the YYYY-MM-DD string — never Date.parse + toISOString.
 */

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Keep a YYYY-MM-DD string as-is. Empty or partial values are ignored. */
export function asCalendarDay(value) {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  const exact = raw.match(CALENDAR_DAY);
  if (exact) {
    const month = Number(exact[2]);
    const day = Number(exact[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    return `${exact[1]}-${exact[2]}-${exact[3]}`;
  }
  const prefix = raw.slice(0, 10);
  if (CALENDAR_DAY.test(prefix) && raw.charAt(10) === 'T') return prefix;
  return '';
}

export function parseRangeBound(value, endOfDay = false) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const day = asCalendarDay(raw);
  if (day) {
    return new Date(endOfDay ? `${day}T23:59:59.999Z` : `${day}T00:00:00.000Z`);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isInInclusiveDateRange(dateValue, from, to) {
  if (!from && !to) return true;
  if (dateValue == null || dateValue === '') return true;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return true;
  const start = parseRangeBound(from, false);
  const end = parseRangeBound(to, true);
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  return true;
}

export function currentMonthRange(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

export function rangeFromSearch(search, fallback = currentMonthRange()) {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : search;
  const read = (key) => {
    if (!params) return '';
    if (typeof params.get === 'function') return asCalendarDay(params.get(key));
    return asCalendarDay(params[key]);
  };
  return {
    from: read('from') || fallback.from,
    to: read('to') || fallback.to,
  };
}

export function projectActivityDate(project = {}) {
  return project.completedAt || project.createdAt || null;
}
