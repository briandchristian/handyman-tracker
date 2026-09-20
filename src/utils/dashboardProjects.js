/**
 * Dashboard list: status cards filter the list; counts stay on the full set.
 * Pending includes Bidded so those jobs are not hidden. Completed includes Billed.
 */

export const STATUS_FILTERS = {
  all: 'all',
  pending: 'pending',
  scheduled: 'scheduled',
  completed: 'completed',
};

export const DEFAULT_STATUS_FILTER = STATUS_FILTERS.pending;
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
  { statusFilter = DEFAULT_STATUS_FILTER, search = '', sort = DEFAULT_SORT } = {}
) {
  const filtered = projects.filter(
    (p) => matchesStatusFilter(p, statusFilter) && matchesSearch(p, search)
  );
  return sortProjects(filtered, sort);
}

/** Tap Total → all. Tap the active status again → all. Otherwise select that status. */
export function nextStatusFilter(current, clicked) {
  if (clicked === STATUS_FILTERS.all) return STATUS_FILTERS.all;
  if (current === clicked) return STATUS_FILTERS.all;
  return clicked;
}
