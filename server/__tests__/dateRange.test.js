/**
 * Calendar-day helpers for the accounting period filter.
 * Input values stay YYYY-MM-DD strings — never Date.parse + toISOString.
 */

import {
  asCalendarDay,
  currentMonthRange,
  parseRangeBound,
  rangeFromSearch,
} from '../lib/dateRange.js';

describe('dateRange', () => {
  test('asCalendarDay keeps YYYY-MM-DD without a Date.parse timezone shift', () => {
    expect(asCalendarDay('2026-01-15')).toBe('2026-01-15');
    expect(asCalendarDay('2026-12-31')).toBe('2026-12-31');
    expect(asCalendarDay('2026-01-15T00:00:00.000Z')).toBe('2026-01-15');
    expect(asCalendarDay('')).toBe('');
    expect(asCalendarDay('2026-1-15')).toBe('');
    expect(asCalendarDay('not-a-date')).toBe('');

    const shiftedThroughDate = (() => {
      const parsed = new Date('2026-01-15');
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
        .toISOString()
        .slice(0, 10);
    })();
    expect(asCalendarDay('2026-01-15')).not.toBe(shiftedThroughDate === '2026-01-14' ? '2026-01-14' : 'shifted');
    expect(asCalendarDay('2026-01-15')).toBe('2026-01-15');
  });

  test('currentMonthRange uses the local calendar month, not UTC toISOString', () => {
    const lateUsJanuary = new Date('2026-01-31T23:00:00-05:00');
    expect(currentMonthRange(lateUsJanuary)).toEqual({ from: '2026-01-01', to: '2026-01-31' });

    const midSeptember = new Date('2026-09-20T16:00:00-05:00');
    expect(currentMonthRange(midSeptember)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  test('rangeFromSearch reads ?from=&to= as calendar days and ignores junk', () => {
    expect(rangeFromSearch('?from=2026-01-15&to=2026-02-20', { from: '2026-09-01', to: '2026-09-30' }))
      .toEqual({ from: '2026-01-15', to: '2026-02-20' });
    expect(rangeFromSearch('?from=nope&to=2026-02-20', { from: '2026-09-01', to: '2026-09-30' }))
      .toEqual({ from: '2026-09-01', to: '2026-02-20' });
    expect(rangeFromSearch('', { from: '2026-09-01', to: '2026-09-30' }))
      .toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  test('parseRangeBound treats YYYY-MM-DD as UTC midnight, not a local Date.parse shift', () => {
    const start = parseRangeBound('2026-01-15', false);
    expect(start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    const end = parseRangeBound('2026-01-15', true);
    expect(end.toISOString()).toBe('2026-01-15T23:59:59.999Z');
  });
});
