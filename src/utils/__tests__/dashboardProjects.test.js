import {
  STATUS_FILTERS,
  countProjectsByStatus,
  filterAndSortProjects,
  matchesSearch,
  matchesStatusFilter,
  nextStatusFilter,
} from '../dashboardProjects';

const projects = [
  { name: 'Alarm A', customerName: 'Ada', status: 'Pending', createdAt: '2024-01-01' },
  { name: 'Alarm B', customerName: 'Bea', status: 'Bidded', createdAt: '2024-03-01' },
  { name: 'CCTV', customerName: 'Cara', status: 'Scheduled', createdAt: '2024-02-01', scheduleDate: '2024-06-01' },
  { name: 'Fire', customerName: 'Dee', status: 'Completed', createdAt: '2024-04-01' },
  { name: 'Gate', customerName: 'Eve', status: 'Billed', createdAt: '2024-05-01' },
];

describe('dashboardProjects', () => {
  test('Pending filter includes Bidded; Completed includes Billed', () => {
    expect(matchesStatusFilter(projects[0], STATUS_FILTERS.pending)).toBe(true);
    expect(matchesStatusFilter(projects[1], STATUS_FILTERS.pending)).toBe(true);
    expect(matchesStatusFilter(projects[2], STATUS_FILTERS.pending)).toBe(false);
    expect(matchesStatusFilter(projects[3], STATUS_FILTERS.completed)).toBe(true);
    expect(matchesStatusFilter(projects[4], STATUS_FILTERS.completed)).toBe(true);
  });

  test('counts stay on the full set', () => {
    expect(countProjectsByStatus(projects)).toEqual({
      total: 5,
      pending: 2,
      scheduled: 1,
      completed: 2,
    });
  });

  test('search matches project, customer, or status', () => {
    expect(matchesSearch(projects[2], 'cara')).toBe(true);
    expect(matchesSearch(projects[2], 'cctv')).toBe(true);
    expect(matchesSearch(projects[2], 'scheduled')).toBe(true);
    expect(matchesSearch(projects[2], 'zzz')).toBe(false);
  });

  test('defaults to pending + newest first', () => {
    const visible = filterAndSortProjects(projects);
    expect(visible.map((p) => p.name)).toEqual(['Alarm B', 'Alarm A']);
  });

  test('search combines with status filter', () => {
    const visible = filterAndSortProjects(projects, {
      statusFilter: STATUS_FILTERS.pending,
      search: 'bea',
    });
    expect(visible.map((p) => p.name)).toEqual(['Alarm B']);
  });

  test('sort by schedule date', () => {
    const visible = filterAndSortProjects(projects, {
      statusFilter: STATUS_FILTERS.all,
      sort: 'schedule',
    });
    expect(visible[visible.length - 1].name).toBe('CCTV');
  });

  test('tapping the active card clears the filter to all', () => {
    expect(nextStatusFilter(STATUS_FILTERS.pending, STATUS_FILTERS.pending)).toBe(
      STATUS_FILTERS.all
    );
    expect(nextStatusFilter(STATUS_FILTERS.pending, STATUS_FILTERS.scheduled)).toBe(
      STATUS_FILTERS.scheduled
    );
    expect(nextStatusFilter(STATUS_FILTERS.pending, STATUS_FILTERS.all)).toBe(
      STATUS_FILTERS.all
    );
  });
});
