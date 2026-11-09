/**
 * Dashboard list: status cards filter the list; counts stay on the full set
 * for the selected source. Pending includes Bidded so those jobs are not hidden.
 * Completed includes Billed.
 *
 * Customer jobs and Brinks work orders share this list. All jobs shows both
 * sources and every status, so a scheduled work order is on the list immediately.
 * Customers and Subcontractor each show one source. Assigned work orders count
 * as pending, scheduled as scheduled, and completed, invoiced, or paid as completed.
 */
import {
  DEFAULT_PRINCIPAL,
  SUBCONTRACTOR_STATUSES,
  normalizeStatus,
  workOrderIsReconciled,
} from '../constants/subcontractorWorkOrders';

export const STATUS_FILTERS = {
  all: 'all',
  pending: 'pending',
  scheduled: 'scheduled',
  completed: 'completed',
};

export const SOURCE_FILTERS = {
  all: 'all',
  customers: 'customers',
  subcontractor: 'subcontractor',
};

export const DEFAULT_SOURCE = SOURCE_FILTERS.all;

const SUBCONTRACTOR_FILTER_STATUS = {
  assigned: 'Pending',
  scheduled: 'Scheduled',
  completed: 'Completed',
  invoiced: 'Billed',
  paid: 'Billed',
};

const SERVICE_JOB_STATUS = {
  scheduled: { status: 'Scheduled', displayStatus: 'Scheduled' },
  completed: { status: 'Completed', displayStatus: 'Completed' },
  invoiced: { status: 'Billed', displayStatus: 'Invoiced' },
  paid: { status: 'Billed', displayStatus: 'Paid' },
};

/**
 * A single-entry customer job as a dashboard row.
 * These live on the customer, separate from installation projects.
 */
export function dashboardJobFromServiceJob(job, customer = {}) {
  const name = String(job?.name || '').trim();
  const jobNumber = String(job?.jobNumber || '').trim();
  if (!name && !jobNumber) return null;
  const mapped = SERVICE_JOB_STATUS[String(job?.status || '').trim().toLowerCase()]
    || { status: 'Pending', displayStatus: 'Pending' };
  const amount = Number(job?.amountDue);
  return {
    _id: job._id,
    source: 'customer',
    name: name || jobNumber,
    jobNumber,
    customerName: customer.name || '',
    accountNumber: customer.accountNumber || '',
    customerId: customer._id,
    status: mapped.status,
    displayStatus: mapped.displayStatus,
    billAmount: Number.isFinite(amount) ? amount : undefined,
    scheduleDate: job?.scheduledDate || null,
    createdAt: job?.createdAt || null,
    href: customer._id ? `/customers/${customer._id}` : '/customers',
  };
}

/** A Brinks work order as a dashboard row. Records without a number are skipped. */
export function dashboardJobFromWorkOrder(order) {
  const workOrderNumber = String(order?.workOrderNumber || '').trim();
  if (!workOrderNumber) return null;
  const rawStatus = normalizeStatus(order?.status);
  const displayStatus = SUBCONTRACTOR_STATUSES.find((status) => status.value === rawStatus)?.label
    || rawStatus;
  const siteName = String(order?.siteName || '').trim();
  return {
    _id: order._id,
    source: 'subcontractor',
    name: siteName || workOrderNumber,
    siteName,
    workOrderNumber,
    customerName: order?.principal || DEFAULT_PRINCIPAL,
    completionNumber: order?.completionNumber || '',
    status: SUBCONTRACTOR_FILTER_STATUS[rawStatus] || 'Pending',
    displayStatus,
    amountDue: order?.amountDue,
    paidAmount: order?.paidAmount,
    reconciled: workOrderIsReconciled(order),
    scheduleDate: order?.scheduledDate || null,
    createdAt: order?.createdAt || null,
    href: order?._id ? `/subcontractor/${order._id}` : '/subcontractor',
  };
}

export function matchesSource(job, source = DEFAULT_SOURCE) {
  if (source === SOURCE_FILTERS.subcontractor) return job?.source === 'subcontractor';
  if (source === SOURCE_FILTERS.customers) return job?.source !== 'subcontractor';
  return true;
}

export function jobsForSource(jobs = [], source = DEFAULT_SOURCE) {
  return jobs.filter((job) => matchesSource(job, source));
}

export const DEFAULT_STATUS_FILTER = STATUS_FILTERS.all;
export const DEFAULT_SORT = 'newest';

export function projectStatus(project) {
  return project?.status || 'Pending';
}

export function matchesStatusFilter(project, filter) {
  const status = projectStatus(project);
  if (filter === STATUS_FILTERS.all) return true;
  if (filter === STATUS_FILTERS.pending) {
    return status === 'Pending' || status === 'Bidded';
  }
  if (filter === STATUS_FILTERS.scheduled) return status === 'Scheduled';
  if (filter === STATUS_FILTERS.completed) {
    return status === 'Completed' || status === 'Billed';
  }
  return true;
}

export function countProjectsByStatus(projects = []) {
  return {
    total: projects.length,
    pending: projects.filter((p) => matchesStatusFilter(p, STATUS_FILTERS.pending)).length,
    scheduled: projects.filter((p) => matchesStatusFilter(p, STATUS_FILTERS.scheduled)).length,
    completed: projects.filter((p) => matchesStatusFilter(p, STATUS_FILTERS.completed)).length,
  };
}

export function matchesSearch(project, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [
    project.name,
    project.customerName,
    project.accountNumber,
    project.jobNumber,
    project.workOrderNumber,
    project.siteName,
    project.completionNumber,
    project.displayStatus,
    projectStatus(project),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function sortProjects(projects, sortKey = DEFAULT_SORT) {
  const copy = [...projects];
  const time = (value) => {
    const t = new Date(value || 0).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  if (sortKey === 'oldest') {
    copy.sort((a, b) => time(a.createdAt) - time(b.createdAt));
  } else if (sortKey === 'schedule') {
    copy.sort((a, b) => time(a.scheduleDate) - time(b.scheduleDate));
  } else {
    copy.sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }
  return copy;
}

export function filterAndSortProjects(
  projects,
  {
    statusFilter = DEFAULT_STATUS_FILTER,
    search = '',
    sort = DEFAULT_SORT,
    source = DEFAULT_SOURCE,
  } = {}
) {
  const filtered = projects.filter(
    (p) => matchesSource(p, source)
      && matchesStatusFilter(p, statusFilter)
      && matchesSearch(p, search)
  );
  return sortProjects(filtered, sort);
}

/** Tap Total → all. Tap the active status again → all. Otherwise select that status. */
export function nextStatusFilter(current, clicked) {
  if (clicked === STATUS_FILTERS.all) return STATUS_FILTERS.all;
  if (current === clicked) return STATUS_FILTERS.all;
  return clicked;
}
