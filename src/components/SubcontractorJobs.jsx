/**
 * Searchable index of Brinks work orders.
 * Search, status filter, and New work order stay open on this page.
 * A work order is opened on its own page. Edit, reimbursable equipment,
 * and reconciliation live on that page, not on this list.
 * Reconciled orders are shown in green.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import {
  DEFAULT_PRINCIPAL,
  SUBCONTRACTOR_STATUSES,
  filterWorkOrders,
  workOrderIsReconciled,
} from '../constants/subcontractorWorkOrders';
import { AlignedFormField } from './common/AlignedFormGrid';

const money = (value) =>
  `$${(Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const signedMoney = (value) => {
  const amount = Number(value) || 0;
  if (amount < 0) {
    return `-$${Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return money(amount);
};

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

export default function SubcontractorJobs() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/subcontractor-work-orders`, authHeaders());
        if (!cancelled) setOrders(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.msg || 'Failed to load work orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleOrders = useMemo(
    () => filterWorkOrders(orders, { status: statusFilter, query: search }),
    [orders, statusFilter, search]
  );

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
        <h1 className="text-2xl font-bold mb-4">Subcontractor</h1>
        <p>Loading work orders...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Subcontractor</h1>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Brinks work-order tracker. Open a work order to edit it. These tickets are not
        Christian Security customer jobs and do not post into the Direct/Indirect ledger.
      </p>
      {error ? <p className="text-red-700 mb-4">{error}</p> : null}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
        <AlignedFormField label="Search work orders" htmlFor="wo-search" className="flex-1">
          <input
            id="wo-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Number, site, city, completion, equipment, notes…"
            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
          />
        </AlignedFormField>
        <AlignedFormField label="Filter by status" htmlFor="wo-status-filter">
          <select
            id="wo-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full sm:w-48 p-2 border border-slate-300 rounded bg-white text-slate-900"
          >
            <option value="">All</option>
            {SUBCONTRACTOR_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </AlignedFormField>
        <Link to="/subcontractor/new" className="btn-secondary">
          New work order
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="text-slate-600">No Brinks work orders yet.</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-slate-600">No work orders match.</p>
      ) : (
        <div className="space-y-3">
            {visibleOrders.map((order) => {
              const reconciled = workOrderIsReconciled(order);
              const muted = reconciled ? 'text-sm' : 'text-sm text-slate-600';
              return (
                <article
                  key={order._id}
                  data-testid={`work-order-${order._id}`}
                  className={`border border-slate-200 rounded-lg p-3 ${reconciled ? 'text-green-700' : ''}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        <Link to={`/subcontractor/${order._id}`} className="underline">
                          {order.workOrderNumber}
                        </Link>
                      </p>
                      <p className={muted}>{order.principal || DEFAULT_PRINCIPAL}</p>
                      {order.siteName ? <p className="text-sm">{order.siteName}</p> : null}
                      {order.siteCity ? <p className={muted}>{order.siteCity}</p> : null}
                      <p className="text-sm capitalize">{order.jobType} · {order.status}</p>
                      <p className="text-sm">
                        Completion #: <span>{order.completionNumber || '—'}</span>
                      </p>
                    </div>
                    <div className="md:text-right">
                      <p className={muted}>Amount due</p>
                      <p className="text-lg font-semibold">{money(order.amountDue)}</p>
                      {reconciled ? (
                        <>
                          <p className={`${muted} mt-1`}>Paid by Brinks</p>
                          <p className="font-semibold">{money(order.paidAmount)}</p>
                          <p className={muted}>Variance</p>
                          <p className="font-semibold">{signedMoney(order.variance)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500 mt-1">Not reconciled</p>
                      )}
                      <div className="mt-2">
                        <Link to={`/subcontractor/${order._id}?edit=1`} className="btn-staff text-sm">
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
    </div>
  );
}
