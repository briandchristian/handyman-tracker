import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';
import {
  DEFAULT_SORT,
  DEFAULT_STATUS_FILTER,
  STATUS_FILTERS,
  countProjectsByStatus,
  filterAndSortProjects,
  nextStatusFilter,
} from '../utils/dashboardProjects';
import { formatCustomerLabel, formatJobLabel } from '../constants/jobIdentity';

const SORT_LABELS = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  schedule: 'Schedule date',
};

const FILTER_LABELS = {
  [STATUS_FILTERS.all]: 'All jobs',
  [STATUS_FILTERS.pending]: 'Pending',
  [STATUS_FILTERS.scheduled]: 'Scheduled',
  [STATUS_FILTERS.completed]: 'Completed',
};

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT);

  useEffect(() => {
    fetchAllProjects();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  const fetchAllProjects = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      const allProjects = [];
      res.data.forEach((customer) => {
        if (customer.projects && customer.projects.length > 0) {
          customer.projects.forEach((project) => {
            allProjects.push({
              ...project,
              customerName: customer.name,
              accountNumber: customer.accountNumber,
              customerId: customer._id,
            });
          });
        }
      });

      setProjects(allProjects);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setLoading(false);
    }
  };

  const counts = useMemo(() => countProjectsByStatus(projects), [projects]);
  const visibleProjects = useMemo(
    () => filterAndSortProjects(projects, { statusFilter, search, sort }),
    [projects, statusFilter, search, sort]
  );

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
      <div className="hidden lg:flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <div className="flex gap-2 flex-wrap">
          <Link to="/inventory" className="btn-staff text-sm">
            Inventory
          </Link>
          <Link to="/purchase-orders" className="btn-staff text-sm">
            Orders
          </Link>
          <Link to="/suppliers" className="btn-staff text-sm">
            Suppliers
          </Link>
          <Link to="/accounting" className="btn-staff text-sm">
            Accounting
          </Link>
          <Link to="/subcontractor" className="btn-staff text-sm">
            Subcontractor
          </Link>
          <Link to="/admin/users" className="btn-staff text-sm">
            Users
          </Link>
          <Link to="/customers" className="btn-staff text-sm">
            Customers
          </Link>
          <Link to="/installation-history" className="btn-staff text-sm">
            History
          </Link>
        </div>
      </div>

      <div className="lg:hidden mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      </div>

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

      <div className="sticky top-[65px] z-20 lg:static bg-slate-50 lg:bg-transparent py-2 mb-4 flex flex-col md:flex-row gap-3">
        <label className="sr-only" htmlFor="dashboard-search">
          Search jobs
        </label>
        <input
          id="dashboard-search"
          type="search"
          role="searchbox"
          placeholder="Search job, customer, account #, or status"
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

      <div className="card-surface p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-semibold mb-4 text-slate-900">
          {FILTER_LABELS[statusFilter]} ({SORT_LABELS[sort]})
          {visibleProjects.length !== projects.length
            ? ` — ${visibleProjects.length} of ${projects.length}`
            : ''}
        </h2>

        {projects.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-base md:text-sm">
            No jobs found. Create a customer and add jobs to get started.
          </p>
        ) : visibleProjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-base md:text-sm">
            No jobs match this filter. Try another card or clear search.
          </p>
        ) : (
          <>
            <div className="md:hidden space-y-4">
              {visibleProjects.map((project, index) => (
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
                      <span className="text-black font-medium">
                        {formatCustomerLabel({
                          name: project.customerName,
                          accountNumber: project.accountNumber,
                        })}
                      </span>
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
                  {visibleProjects.map((project, index) => (
                    <tr key={project._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-black font-medium text-sm">{formatJobLabel(project)}</td>
                      <td className="p-3 text-black text-sm">{formatCustomerLabel({
                        name: project.customerName,
                        accountNumber: project.accountNumber,
                      })}</td>
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
      </div>

      <div data-testid="page-footer" className="mt-8 flex justify-end items-center">
        <button
          onClick={handleLogout}
          className="btn-danger"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
