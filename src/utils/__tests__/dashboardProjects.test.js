import {
  SOURCE_FILTERS,
  STATUS_FILTERS,
  countProjectsByStatus,
  dashboardJobFromServiceJob,
  dashboardJobFromWorkOrder,
  filterAndSortProjects,
  jobsForSource,
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

  test('search matches project, customer, status, or numbers', () => {
    expect(matchesSearch(projects[2], 'cara')).toBe(true);
    expect(matchesSearch(projects[2], 'cctv')).toBe(true);
    expect(matchesSearch(projects[2], 'scheduled')).toBe(true);
    expect(matchesSearch(projects[2], 'zzz')).toBe(false);
    expect(matchesSearch({
      ...projects[2],
      accountNumber: 'A-1042',
      jobNumber: 'J-208',
    }, 'j-208')).toBe(true);
    expect(matchesSearch({
      ...projects[2],
      accountNumber: 'A-1042',
      jobNumber: 'J-208',
    }, 'a-1042')).toBe(true);
  });

  test('defaults to every status, newest first', () => {
    const visible = filterAndSortProjects(projects);
    expect(visible.map((p) => p.name)).toEqual(['Gate', 'Fire', 'Alarm B', 'CCTV', 'Alarm A']);
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

  test('subcontractor work orders join the same status cards', () => {
    const assigned = dashboardJobFromWorkOrder({
      _id: 'wo1',
      workOrderNumber: 'BRK-1001',
      siteName: 'Warehouse',
      status: 'assigned',
      amountDue: 166,
    });
    const scheduled = dashboardJobFromWorkOrder({
      _id: 'wo2',
      workOrderNumber: 'BRK-2002',
      siteName: 'Lobby',
      status: 'scheduled',
      scheduledDate: '2024-06-02',
      completionNumber: 'CL-88',
    });
    const paid = dashboardJobFromWorkOrder({
      _id: 'wo3',
      workOrderNumber: 'BRK-3003',
      status: 'paid',
      paidAmount: 80,
      amountDue: 80,
    });

    expect(assigned).toMatchObject({
      source: 'subcontractor',
      status: 'Pending',
      displayStatus: 'Assigned',
      customerName: 'Brinks',
      name: 'Warehouse',
      href: '/subcontractor/wo1',
      reconciled: false,
    });
    expect(scheduled.status).toBe('Scheduled');
    expect(paid).toMatchObject({
      status: 'Billed',
      displayStatus: 'Paid',
      reconciled: true,
    });
    expect(dashboardJobFromWorkOrder({ siteName: 'No number' })).toBeNull();

    const mixed = [...projects, assigned, scheduled, paid];
    expect(countProjectsByStatus(mixed)).toEqual({
      total: 8,
      pending: 3,
      scheduled: 2,
      completed: 3,
    });
    expect(jobsForSource(mixed, SOURCE_FILTERS.customers)).toHaveLength(5);
    expect(jobsForSource(mixed, SOURCE_FILTERS.subcontractor).map((job) => job.workOrderNumber))
      .toEqual(['BRK-1001', 'BRK-2002', 'BRK-3003']);
    expect(matchesSearch(scheduled, 'cl-88')).toBe(true);
    expect(matchesSearch(scheduled, 'lobby')).toBe(true);
    expect(filterAndSortProjects(mixed, { source: SOURCE_FILTERS.subcontractor }).map((job) => job.workOrderNumber))
      .toEqual(['BRK-1001', 'BRK-2002', 'BRK-3003']);
    expect(filterAndSortProjects(mixed, {
      statusFilter: STATUS_FILTERS.pending,
      source: SOURCE_FILTERS.subcontractor,
    }).map((job) => job.workOrderNumber)).toEqual(['BRK-1001']);
    expect(filterAndSortProjects(mixed, {
      statusFilter: STATUS_FILTERS.all,
      source: SOURCE_FILTERS.customers,
    })).toHaveLength(5);
  });

  test('a customer service job is a customer job on the dashboard', () => {
    const job = dashboardJobFromServiceJob({
      _id: 'j1',
      name: 'IP Cameras for property',
      jobNumber: 'A-1006-J0001',
      status: 'scheduled',
      amountDue: 1200,
      scheduledDate: '2026-11-10',
      createdAt: '2026-11-09',
    }, { _id: 'c1', name: 'Mike Dibble', accountNumber: 'A-1006' });

    expect(job).toMatchObject({
      source: 'customer',
      name: 'IP Cameras for property',
      jobNumber: 'A-1006-J0001',
      customerName: 'Mike Dibble',
      accountNumber: 'A-1006',
      customerId: 'c1',
      status: 'Scheduled',
      displayStatus: 'Scheduled',
      billAmount: 1200,
      scheduleDate: '2026-11-10',
      href: '/customers/c1',
    });
    expect(matchesStatusFilter(job, STATUS_FILTERS.scheduled)).toBe(true);
    expect(matchesSearch(job, 'a-1006')).toBe(true);
    expect(jobsForSource([job], SOURCE_FILTERS.customers)).toEqual([job]);
    expect(dashboardJobFromServiceJob(
      { name: 'Done', jobNumber: 'A-1-J0002', status: 'paid' },
      { _id: 'c1' }
    )).toMatchObject({ status: 'Billed', displayStatus: 'Paid' });
    expect(dashboardJobFromServiceJob(
      { name: 'Invoice', jobNumber: 'A-1-J0003', status: 'invoiced' },
      { _id: 'c1' }
    )).toMatchObject({ status: 'Billed', displayStatus: 'Invoiced' });
    expect(dashboardJobFromServiceJob(
      { name: 'Finished', jobNumber: 'A-1-J0004', status: 'completed' },
      { _id: 'c1' }
    ).status).toBe('Completed');
    expect(dashboardJobFromServiceJob({}, { _id: 'c1' })).toBeNull();
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
