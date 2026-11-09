import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';
import {
  DEFAULT_SORT,
  DEFAULT_SOURCE,
  DEFAULT_STATUS_FILTER,
  SOURCE_FILTERS,
  STATUS_FILTERS,
  countProjectsByStatus,
  dashboardJobFromWorkOrder,
  filterAndSortProjects,
  jobsForSource,
  nextStatusFilter,
} from '../utils/dashboardProjects';
import { formatCustomerLabel, formatJobLabel } from '../constants/jobIdentity';

const SORT_LABELS = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  schedule: 'Schedule date',
};

const SOURCE_OPTIONS = [
  [SOURCE_FILTERS.all, 'All jobs'],
  [SOURCE_FILTERS.customers, 'Customer jobs'],
  [SOURCE_FILTERS.subcontractor, 'Subcontractor jobs'],
];

function statusClass(status) {
  if (status === 'Completed') return 'bg-green-100 text-green-800';
  if (status === 'Billed') return 'bg-blue-100 text-blue-800';
  if (status === 'Scheduled') return 'bg-yellow-100 text-yellow-800';
  if (status === 'Bidded') return 'bg-purple-100 text-purple-800';
  return 'bg-gray-100 text-gray-800';
}

function shownStatus(job) {
  return job.displayStatus || job.status || 'Pending';
}

function moneyText(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function countNote(visible, total) {
  return visible !== total ? `${visible} of ${total}` : null;
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [bidNotices, setBidNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceParam = searchParams.get('source');
  const source = sourceParam === SOURCE_FILTERS.customers || sourceParam === SOURCE_FILTERS.subcontractor
    ? sourceParam
    : DEFAULT_SOURCE;

  useEffect(() => {
    fetchAllProjects();
  }, []);

  const fetchAllProjects = async () => {
    const headers = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    try {
      const [customerResult, orderResult] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/customers`, headers),
        axios.get(`${API_BASE_URL}/api/subcontractor-work-orders`, headers),
      ]);
      const customers = customerResult.status === 'fulfilled' && Array.isArray(customerResult.value.data)
        ? customerResult.value.data
        : [];
      const orders = orderResult.status === 'fulfilled' && Array.isArray(orderResult.value.data)
        ? orderResult.value.data
        : [];

      const allProjects = [];
      customers.forEach((customer) => {
        if (customer.projects && customer.projects.length > 0) {
          customer.projects.forEach((project) => {
            allProjects.push({
              ...project,
              source: 'customer',
              customerName: customer.name,
              accountNumber: customer.accountNumber,
              customerId: customer._id,
            });
          });
        }
      });
      orders.forEach((order) => {
        const job = dashboardJobFromWorkOrder(order);
        if (job) allProjects.push(job);
      });

      setProjects(allProjects);
      setBidNotices(customers.filter((customer) => customer.heroBidUnread));
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectSource = (next) => {
    if (next === SOURCE_FILTERS.all) {
      setStatusFilter(STATUS_FILTERS.all);
      setSearchParams({});
    } else {
      setSearchParams({ source: next });
    }
  };

  const sourceJobs = useMemo(() => jobsForSource(projects, source), [projects, source]);
  const counts = useMemo(() => countProjectsByStatus(sourceJobs), [sourceJobs]);
  const visibleProjects = useMemo(
    () => filterAndSortProjects(projects, { statusFilter, search, sort, source }),
    [projects, statusFilter, search, sort, source]
  );
  const customerJobs = useMemo(
    () => projects.filter((job) => job.source !== 'subcontractor'),
    [projects]
  );
  const orderJobs = useMemo(
    () => projects.filter((job) => job.source === 'subcontractor'),
    [projects]
  );
  const visibleCustomers = visibleProjects.filter((job) => job.source !== 'subcontractor');
  const visibleOrders = visibleProjects.filter((job) => job.source === 'subcontractor');
  const showCustomers = source !== SOURCE_FILTERS.subcontractor;
  const showOrders = source !== SOURCE_FILTERS.customers;

  const openHeroBidNotice = (customerId) => {
    setBidNotices((current) => current.filter((customer) => customer._id !== customerId));
    axios.put(
      `${API_BASE_URL}/api/customers/${customerId}/hero-bid-notice`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    ).catch((err) => {
      console.error('Failed to clear new customer bid notice:', err);
    });
  };

  const cardClass = (filter) =>
    `text-left w-full card-surface p-4 min-h-[44px] ${
      statusFilter === filter
        ? 'border-emerald-600 ring-2 ring-emerald-600'
        : 'hover:border-emerald-300'
    }`;

  if (loading) {
    return (
      <div className="p-6 text-slate-900 max-w-6xl mx-auto">
        <h1 className="text-2xl mb-4 font-bold">Christian Security Services Dashboard</h1>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 text-slate-900 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Dashboard</h1>
      </div>

      {bidNotices.length > 0 && (
        <ul data-testid="hero-bid-notices" className="mb-4 space-y-2">
          {bidNotices.map((customer) => (
            <li key={customer._id} className="card-surface p-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                to={`/customers/${customer._id}`}
                onClick={() => openHeroBidNotice(customer._id)}
                className="font-semibold text-emerald-800 underline"
              >
                New Customer Bid!
              </Link>
              <span className="text-slate-700">{customer.name}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
        <button
          type="button"
          aria-pressed={statusFilter === STATUS_FILTERS.all}
          onClick={() => setStatusFilter(nextStatusFilter(statusFilter, STATUS_FILTERS.all))}
          className={cardClass(STATUS_FILTERS.all)}
        >
          <p className="text-gray-600 text-base md:text-sm">Total jobs</p>
          <p className="text-3xl font-bold text-black">{counts.total}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === STATUS_FILTERS.pending}
          onClick={() => setStatusFilter(nextStatusFilter(statusFilter, STATUS_FILTERS.pending))}
          className={cardClass(STATUS_FILTERS.pending)}
        >
          <p className="text-gray-600 text-base md:text-sm">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">{counts.pending}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === STATUS_FILTERS.scheduled}
          onClick={() => setStatusFilter(nextStatusFilter(statusFilter, STATUS_FILTERS.scheduled))}
          className={cardClass(STATUS_FILTERS.scheduled)}
        >
          <p className="text-gray-600 text-base md:text-sm">Scheduled</p>
          <p className="text-3xl font-bold text-blue-600">{counts.scheduled}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === STATUS_FILTERS.completed}
          onClick={() => setStatusFilter(nextStatusFilter(statusFilter, STATUS_FILTERS.completed))}
          className={cardClass(STATUS_FILTERS.completed)}
        >
          <p className="text-gray-600 text-base md:text-sm">Completed</p>
          <p className="text-3xl font-bold text-green-600">{counts.completed}</p>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Show">
        {SOURCE_OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={source === value}
            onClick={() => selectSource(value)}
            className={`px-3 py-2 rounded border min-h-[44px] ${
              source === value
                ? 'border-emerald-600 ring-2 ring-emerald-600 bg-white'
                : 'border-slate-300 bg-white hover:border-emerald-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="sticky top-[65px] z-20 lg:static bg-slate-50 lg:bg-transparent py-2 mb-4 flex flex-col md:flex-row gap-3">
        <label className="sr-only" htmlFor="dashboard-search">
          Search jobs
        </label>
        <input
          id="dashboard-search"
          type="search"
          role="searchbox"
          placeholder="Search job, customer, work order, account #, or status"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field md:flex-1"
        />
        <label className="sr-only" htmlFor="dashboard-sort">
          Sort jobs
        </label>
        <select
          id="dashboard-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="field md:w-48"
        >
          <option value="newest">{SORT_LABELS.newest}</option>
          <option value="oldest">{SORT_LABELS.oldest}</option>
          <option value="schedule">{SORT_LABELS.schedule}</option>
        </select>
      </div>

      {showCustomers && (
      <section aria-label="Customers" className="card-surface p-4 md:p-6 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">Customers</h2>
          {countNote(visibleCustomers.length, customerJobs.length) ? (
            <span className="text-sm text-slate-600">{countNote(visibleCustomers.length, customerJobs.length)}</span>
          ) : null}
        </div>

        {customerJobs.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-base md:text-sm">
            No jobs found. Create a customer and add jobs to get started.
          </p>
        ) : visibleCustomers.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-base md:text-sm">
            No jobs match this filter. Try another card or clear search.
          </p>
        ) : (
          <>
            <div className="md:hidden space-y-4">
              {visibleCustomers.map((project, index) => (
                <div key={project._id || index} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-black flex-1">
                      {formatJobLabel(project)}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded text-sm ml-2 ${
                        project.status === 'Completed'
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'Billed'
                            ? 'bg-blue-100 text-blue-800'
                            : project.status === 'Scheduled'
                              ? 'bg-yellow-100 text-yellow-800'
                              : project.status === 'Bidded'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {project.status || 'Pending'}
                    </span>
                  </div>

                  <div className="space-y-2 text-base">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer:</span>
                      <Link
                        to={`/customers/${project.customerId}`}
                        className="text-emerald-700 font-medium underline"
                      >
                        {formatCustomerLabel({
                          name: project.customerName,
                          accountNumber: project.accountNumber,
                        })}
                      </Link>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bid Amount:</span>
                      <span className="text-black">
                        {project.bidAmount
                          ? `$${project.bidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bill Amount:</span>
                      <span className="text-black">
                        {project.billAmount
                          ? `$${project.billAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Schedule Date:</span>
                      <span className="text-black">
                        {project.scheduleDate
                          ? format(new Date(project.scheduleDate), 'MMM d, yyyy')
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="text-gray-600">
                        {project.createdAt
                          ? format(new Date(project.createdAt), 'MMM d, yyyy')
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Link
                      to={`/projects/${project.customerId}/${project._id}`}
                      className="block w-full bg-blue-500 text-white text-center py-3 rounded hover:bg-blue-600 font-medium"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 text-black text-sm font-semibold">Job</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Customer</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Status</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Bid Amount</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Bill Amount</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Schedule Date</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Created</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomers.map((project, index) => (
                    <tr key={project._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-black font-medium text-sm">{formatJobLabel(project)}</td>
                      <td className="p-3 text-sm">
                        <Link
                          to={`/customers/${project.customerId}`}
                          className="text-emerald-700 font-medium underline"
                        >
                          {formatCustomerLabel({
                            name: project.customerName,
                            accountNumber: project.accountNumber,
                          })}
                        </Link>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            project.status === 'Completed'
                              ? 'bg-green-100 text-green-800'
                              : project.status === 'Billed'
                                ? 'bg-blue-100 text-blue-800'
                                : project.status === 'Scheduled'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : project.status === 'Bidded'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {project.status || 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-black text-sm">
                        {project.bidAmount
                          ? `$${project.bidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="p-3 text-black text-sm">
                        {project.billAmount
                          ? `$${project.billAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="p-3 text-black text-sm">
                        {project.scheduleDate
                          ? format(new Date(project.scheduleDate), 'MMM d, yyyy')
                          : '-'}
                      </td>
                      <td className="p-3 text-gray-600 text-sm">
                        {project.createdAt
                          ? format(new Date(project.createdAt), 'MMM d, yyyy')
                          : 'N/A'}
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/projects/${project.customerId}/${project._id}`}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      )}

      {showOrders && (
        <section aria-label="Subcontractor" className="card-surface p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold">Subcontractor</h2>
            {countNote(visibleOrders.length, orderJobs.length) ? (
              <span className="text-sm text-slate-600">{countNote(visibleOrders.length, orderJobs.length)}</span>
            ) : null}
          </div>
          {orderJobs.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-base md:text-sm">
              No subcontractor work orders yet.
            </p>
          ) : visibleOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-base md:text-sm">
              No work orders match this filter. Try another card or clear search.
            </p>
          ) : (
            <>
              <div className="md:hidden space-y-4">
                {visibleOrders.map((order) => (
                  <div key={order._id} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold flex-1">
                        <Link
                          to={order.href}
                          className={`underline ${order.reconciled ? 'text-green-700' : 'text-black'}`}
                        >
                          {order.workOrderNumber}
                        </Link>
                      </h3>
                      <span className={`px-3 py-1 rounded text-sm ml-2 ${statusClass(order.status)}`}>
                        {shownStatus(order)}
                      </span>
                    </div>
                    <div className="space-y-2 text-base">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Site:</span>
                        <span className="text-black">{order.siteName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Principal:</span>
                        <span className="text-black">{order.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount due:</span>
                        <span className="text-black">{moneyText(order.amountDue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Paid:</span>
                        <span className="text-black">{order.reconciled ? moneyText(order.paidAmount) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Schedule Date:</span>
                        <span className="text-black">
                          {order.scheduleDate ? format(new Date(order.scheduleDate), 'MMM d, yyyy') : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <Link
                        to={order.href}
                        className="block w-full bg-blue-500 text-white text-center py-3 rounded hover:bg-blue-600 font-medium"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3 text-black text-sm font-semibold">Work order</th>
                      <th className="text-left p-3 text-black text-sm font-semibold">Site</th>
                      <th className="text-left p-3 text-black text-sm font-semibold">Principal</th>
                      <th className="text-left p-3 text-black text-sm font-semibold">Status</th>
                      <th className="text-left p-3 text-black text-sm font-semibold">Amount due</th>
                      <th className="text-left p-3 text-black text-sm font-semibold">Paid</th>
                      <th className="text-left p-3 text-black text-sm font-semibold">Schedule Date</th>
                      <th className="text-left p-3 text-black text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr key={order._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 text-sm font-medium">
                          <Link
                            to={order.href}
                            className={`underline ${order.reconciled ? 'text-green-700' : 'text-black'}`}
                          >
                            {order.workOrderNumber}
                          </Link>
                        </td>
                        <td className="p-3 text-black text-sm">{order.siteName || '—'}</td>
                        <td className="p-3 text-black text-sm">{order.customerName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-sm ${statusClass(order.status)}`}>
                            {shownStatus(order)}
                          </span>
                        </td>
                        <td className="p-3 text-black text-sm">{moneyText(order.amountDue)}</td>
                        <td className="p-3 text-black text-sm">
                          {order.reconciled ? moneyText(order.paidAmount) : '—'}
                        </td>
                        <td className="p-3 text-black text-sm">
                          {order.scheduleDate ? format(new Date(order.scheduleDate), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="p-3">
                          <Link to={order.href} className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                            View Details →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

    </div>
  );
}
