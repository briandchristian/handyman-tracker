/**
 * Staff tracker for Brinks / national-account subcontractor work orders.
 * Tickets are source documents of their own — not CSS customer jobs.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import {
  DEFAULT_PRINCIPAL,
  DEFAULT_SUBCONTRACTOR_JOB_TYPE,
  DEFAULT_SUBCONTRACTOR_STATUS,
  SUBCONTRACTOR_JOB_TYPES,
  SUBCONTRACTOR_STATUSES,
  computeWorkOrderTotals,
  filterWorkOrdersByStatus,
  reconcileVariance,
  validateWorkOrder,
} from '../constants/subcontractorWorkOrders';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';

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

const emptyEquipmentLine = () => ({
  description: '',
  sku: '',
  quantity: '',
  cost: '',
  reimbursable: true,
});

const emptyForm = () => ({
  principal: DEFAULT_PRINCIPAL,
  workOrderNumber: '',
  completionNumber: '',
  siteName: '',
  siteAddress: '',
  siteCity: '',
  jobType: DEFAULT_SUBCONTRACTOR_JOB_TYPE,
  status: DEFAULT_SUBCONTRACTOR_STATUS,
  scheduledDate: '',
  completedDate: '',
  hoursWorked: '',
  hourlyRate: '',
  travelPay: '',
  notes: '',
  paidAmount: '',
  paidDate: '',
  reconciliationNotes: '',
  equipmentLines: [emptyEquipmentLine()],
});

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

function formFromOrder(order) {
  const lines = Array.isArray(order.equipmentLines) && order.equipmentLines.length > 0
    ? order.equipmentLines.map((line) => ({
      description: line.description || '',
      sku: line.sku || '',
      quantity: line.quantity ?? '',
      cost: line.cost ?? '',
      reimbursable: line.reimbursable !== false,
    }))
    : [emptyEquipmentLine()];
  return {
    principal: order.principal || DEFAULT_PRINCIPAL,
    workOrderNumber: order.workOrderNumber || '',
    completionNumber: order.completionNumber || '',
    siteName: order.siteName || '',
    siteAddress: order.siteAddress || '',
    siteCity: order.siteCity || '',
    jobType: order.jobType || DEFAULT_SUBCONTRACTOR_JOB_TYPE,
    status: order.status || DEFAULT_SUBCONTRACTOR_STATUS,
    scheduledDate: toDateInput(order.scheduledDate),
    completedDate: toDateInput(order.completedDate),
    hoursWorked: order.hoursWorked ?? '',
    hourlyRate: order.hourlyRate ?? '',
    travelPay: order.travelPay ?? '',
    notes: order.notes || '',
    paidAmount: order.paidAmount ?? '',
    paidDate: toDateInput(order.paidDate),
    reconciliationNotes: order.reconciliationNotes || '',
    equipmentLines: lines,
  };
}

export default function SubcontractorJobs() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const loadOrders = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/subcontractor-work-orders`, authHeaders());
    setOrders(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadOrders();
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
    () => filterWorkOrdersByStatus(orders, statusFilter),
    [orders, statusFilter]
  );

  const liveTotals = useMemo(() => computeWorkOrderTotals(form), [form]);
  const liveVariance = useMemo(
    () => reconcileVariance(liveTotals.amountDue, form.paidAmount),
    [liveTotals.amountDue, form.paidAmount]
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLine = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      equipmentLines: prev.equipmentLines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  };

  const addEquipmentLine = () => {
    setForm((prev) => ({ ...prev, equipmentLines: [...prev.equipmentLines, emptyEquipmentLine()] }));
  };

  const removeEquipmentLine = (index) => {
    setForm((prev) => {
      const next = prev.equipmentLines.filter((_, lineIndex) => lineIndex !== index);
      return { ...prev, equipmentLines: next.length ? next : [emptyEquipmentLine()] };
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
  };

  const saveOrder = async (event) => {
    event.preventDefault();
    setFormError('');
    const checked = validateWorkOrder(form);
    if (checked.error) {
      setFormError(checked.error);
      return;
    }
    try {
      if (editingId) {
        await axios.put(
          `${API_BASE_URL}/api/subcontractor-work-orders/${editingId}`,
          checked.value,
          authHeaders()
        );
      } else {
        await axios.post(`${API_BASE_URL}/api/subcontractor-work-orders`, checked.value, authHeaders());
      }
      resetForm();
      await loadOrders();
    } catch (err) {
      setFormError(err.response?.data?.msg || 'Failed to save work order');
    }
  };

  const editOrder = (order) => {
    setEditingId(order._id);
    setForm(formFromOrder(order));
    setFormError('');
  };

  const deleteOrder = async (order) => {
    if (!window.confirm(`Delete work order ${order.workOrderNumber}?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/subcontractor-work-orders/${order._id}`, authHeaders());
      if (editingId === order._id) resetForm();
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete work order');
    }
  };

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
      <div className="hidden lg:flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Subcontractor</h1>
        <Link to="/dashboard" className="btn-staff text-sm">
          Dashboard
        </Link>
      </div>
      <div className="lg:hidden mb-4">
        <h1 className="text-2xl font-bold">Subcontractor</h1>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Brinks work-order tracker. These tickets are not Christian Security customer jobs
        and do not post into the Direct/Indirect ledger.
      </p>
      {error ? <p className="text-red-700 mb-4">{error}</p> : null}

      <div className="card-surface p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Work orders</h2>
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
        </div>
        {visibleOrders.length === 0 ? (
          <p className="text-slate-600">No Brinks work orders yet.</p>
        ) : (
          <div className="space-y-3">
            {visibleOrders.map((order) => (
              <div
                key={order._id}
                data-testid={`work-order-${order._id}`}
                className="border border-slate-200 rounded-lg p-3"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                  <div>
                    <p className="font-semibold">{order.workOrderNumber}</p>
                    <p className="text-sm text-slate-600">{order.principal || DEFAULT_PRINCIPAL}</p>
                    {order.siteName ? <p className="text-sm">{order.siteName}</p> : null}
                    {order.siteCity ? <p className="text-sm text-slate-600">{order.siteCity}</p> : null}
                    <p className="text-sm capitalize">{order.jobType} · {order.status}</p>
                    <p className="text-sm">
                      Completion #: <span>{order.completionNumber || '—'}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Amount due</p>
                    <p className="text-lg font-semibold">{money(order.amountDue)}</p>
                    {order.paidAmount != null && order.paidAmount !== '' ? (
                      <>
                        <p className="text-sm text-slate-600 mt-1">Paid by Brinks</p>
                        <p className="font-semibold">{money(order.paidAmount)}</p>
                        <p className="text-sm text-slate-600">Variance</p>
                        <p className="font-semibold">{signedMoney(order.variance)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 mt-1">Not reconciled</p>
                    )}
                    <div className="flex gap-2 justify-end mt-2">
                      <button type="button" className="btn-staff text-sm" onClick={() => editOrder(order)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger text-sm" onClick={() => deleteOrder(order)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="card-surface p-4 md:p-6" onSubmit={saveOrder}>
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? 'Edit work order' : 'New work order'}
        </h2>
        {formError ? <p role="alert" className="text-red-700 mb-3">{formError}</p> : null}
        <AlignedFormGrid className="mb-4">
          <AlignedFormField label="Principal" htmlFor="wo-principal" className="col-span-12 md:col-span-3">
            <input
              id="wo-principal"
              value={form.principal}
              onChange={(event) => updateField('principal', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Work order / ticket number" htmlFor="wo-number" className="col-span-12 md:col-span-3">
            <input
              id="wo-number"
              value={form.workOrderNumber}
              onChange={(event) => updateField('workOrderNumber', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Completion / close number" htmlFor="wo-completion" className="col-span-12 md:col-span-3">
            <input
              id="wo-completion"
              value={form.completionNumber}
              onChange={(event) => updateField('completionNumber', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Status" htmlFor="wo-status" className="col-span-12 md:col-span-3">
            <select
              id="wo-status"
              value={form.status}
              onChange={(event) => updateField('status', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            >
              {SUBCONTRACTOR_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </AlignedFormField>
          <AlignedFormField label="Site name" htmlFor="wo-site" className="col-span-12 md:col-span-4">
            <input
              id="wo-site"
              value={form.siteName}
              onChange={(event) => updateField('siteName', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Address" htmlFor="wo-address" className="col-span-12 md:col-span-5">
            <input
              id="wo-address"
              value={form.siteAddress}
              onChange={(event) => updateField('siteAddress', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="City" htmlFor="wo-city" className="col-span-12 md:col-span-3">
            <input
              id="wo-city"
              value={form.siteCity}
              onChange={(event) => updateField('siteCity', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Job type" htmlFor="wo-job-type" className="col-span-12 md:col-span-3">
            <select
              id="wo-job-type"
              value={form.jobType}
              onChange={(event) => updateField('jobType', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            >
              {SUBCONTRACTOR_JOB_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </AlignedFormField>
          <AlignedFormField label="Scheduled date" htmlFor="wo-scheduled" className="col-span-12 md:col-span-3">
            <input
              id="wo-scheduled"
              type="date"
              value={form.scheduledDate}
              onChange={(event) => updateField('scheduledDate', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Completed date" htmlFor="wo-completed" className="col-span-12 md:col-span-3">
            <input
              id="wo-completed"
              type="date"
              value={form.completedDate}
              onChange={(event) => updateField('completedDate', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Hours worked" htmlFor="wo-hours" className="col-span-12 md:col-span-3">
            <input
              id="wo-hours"
              type="number"
              min="0"
              step="0.25"
              value={form.hoursWorked}
              onChange={(event) => updateField('hoursWorked', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Hourly rate" htmlFor="wo-rate" className="col-span-12 md:col-span-3">
            <input
              id="wo-rate"
              type="number"
              min="0"
              step="0.01"
              value={form.hourlyRate}
              onChange={(event) => updateField('hourlyRate', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Travel pay" htmlFor="wo-travel" className="col-span-12 md:col-span-3">
            <input
              id="wo-travel"
              type="number"
              min="0"
              step="0.01"
              value={form.travelPay}
              onChange={(event) => updateField('travelPay', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
        </AlignedFormGrid>

        <h3 className="font-medium mb-2">Reimbursable equipment</h3>
        {form.equipmentLines.map((line, index) => (
          <AlignedFormGrid key={`eq-${index}`} className="mb-2">
            <AlignedFormField label="Equipment description" htmlFor={`wo-eq-desc-${index}`} className="col-span-12 md:col-span-4">
              <input
                id={`wo-eq-desc-${index}`}
                value={line.description}
                onChange={(event) => updateLine(index, 'description', event.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              />
            </AlignedFormField>
            <AlignedFormField label="SKU" htmlFor={`wo-eq-sku-${index}`} className="col-span-6 md:col-span-2">
              <input
                id={`wo-eq-sku-${index}`}
                value={line.sku}
                onChange={(event) => updateLine(index, 'sku', event.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              />
            </AlignedFormField>
            <AlignedFormField label="Quantity" htmlFor={`wo-eq-qty-${index}`} className="col-span-6 md:col-span-2">
              <input
                id={`wo-eq-qty-${index}`}
                type="number"
                min="0"
                step="1"
                value={line.quantity}
                onChange={(event) => updateLine(index, 'quantity', event.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              />
            </AlignedFormField>
            <AlignedFormField label="Cost" htmlFor={`wo-eq-cost-${index}`} className="col-span-6 md:col-span-2">
              <input
                id={`wo-eq-cost-${index}`}
                type="number"
                min="0"
                step="0.01"
                value={line.cost}
                onChange={(event) => updateLine(index, 'cost', event.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              />
            </AlignedFormField>
            <div className="col-span-6 md:col-span-2 flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={line.reimbursable}
                  onChange={(event) => updateLine(index, 'reimbursable', event.target.checked)}
                />
                Reimbursable
              </label>
              <button type="button" className="text-red-700 text-sm underline" onClick={() => removeEquipmentLine(index)}>
                Remove
              </button>
            </div>
          </AlignedFormGrid>
        ))}
        <button type="button" className="btn-staff text-sm mb-4" onClick={addEquipmentLine}>
          Add equipment line
        </button>

        <AlignedFormField label="Notes" htmlFor="wo-notes" className="mb-4">
          <textarea
            id="wo-notes"
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            rows={3}
          />
        </AlignedFormField>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="border border-slate-200 rounded p-3">
            <p className="text-sm text-slate-600">Labor pay</p>
            <p className="font-semibold">{money(liveTotals.laborPay)}</p>
          </div>
          <div className="border border-slate-200 rounded p-3">
            <p className="text-sm text-slate-600">Travel</p>
            <p className="font-semibold">{money(liveTotals.travelPay)}</p>
          </div>
          <div className="border border-slate-200 rounded p-3">
            <p className="text-sm text-slate-600">Equipment</p>
            <p className="font-semibold">{money(liveTotals.equipmentTotal)}</p>
          </div>
          <div className="border border-slate-200 rounded p-3">
            <p className="text-sm text-slate-600">Amount due from Brinks</p>
            <p data-testid="amount-due" className="font-semibold">{money(liveTotals.amountDue)}</p>
          </div>
        </div>

        <h3 className="font-medium mb-1">Brinks reconciliation</h3>
        <p className="text-sm text-slate-600 mb-3">
          Amount due is what the work adds up to. Paid by Brinks is what they actually remitted.
          Variance is paid minus due (negative is a short).
        </p>
        <AlignedFormGrid className="mb-4">
          <AlignedFormField label="Paid by Brinks" htmlFor="wo-paid" className="col-span-12 md:col-span-4">
            <input
              id="wo-paid"
              type="number"
              min="0"
              step="0.01"
              value={form.paidAmount}
              onChange={(event) => updateField('paidAmount', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <AlignedFormField label="Paid date" htmlFor="wo-paid-date" className="col-span-12 md:col-span-4">
            <input
              id="wo-paid-date"
              type="date"
              value={form.paidDate}
              onChange={(event) => updateField('paidDate', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </AlignedFormField>
          <div className="col-span-12 md:col-span-4 border border-slate-200 rounded p-3">
            <p className="text-sm text-slate-600">Variance</p>
            <p data-testid="reconcile-variance" className="font-semibold">
              {liveVariance == null ? '—' : signedMoney(liveVariance)}
            </p>
          </div>
          <AlignedFormField label="Reconciliation notes" htmlFor="wo-reconcile-notes" className="col-span-12">
            <textarea
              id="wo-reconcile-notes"
              value={form.reconciliationNotes}
              onChange={(event) => updateField('reconciliationNotes', event.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              rows={2}
              placeholder="Travel cut, equipment denied, rate change…"
            />
          </AlignedFormField>
        </AlignedFormGrid>

        <div className="flex gap-2">
          <button type="submit" className="btn-staff">
            Save work order
          </button>
          {editingId ? (
            <button type="button" className="btn-staff" onClick={resetForm}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
