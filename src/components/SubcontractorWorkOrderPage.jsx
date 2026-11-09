/**
 * One Brinks work order.
 * The page shows that order. Edit opens the work-order fields, reimbursable
 * equipment, and Brinks reconciliation on this order only.
 * A reconciled order is shown in green.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import {
  DEFAULT_PRINCIPAL,
  DEFAULT_SUBCONTRACTOR_JOB_TYPE,
  DEFAULT_SUBCONTRACTOR_STATUS,
  SUBCONTRACTOR_JOB_TYPES,
  SUBCONTRACTOR_STATUSES,
  computeWorkOrderTotals,
  reconcileVariance,
  validateWorkOrder,
  workOrderIsReconciled,
} from '../constants/subcontractorWorkOrders';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';
import SectionToggle from './SectionToggle';

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

const fieldClass = 'w-full p-2 border border-slate-300 rounded bg-white text-slate-900';

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

export default function SubcontractorWorkOrderPage() {
  const { workOrderId } = useParams();
  const creating = !workOrderId;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = creating || searchParams.get('edit') === '1';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(!creating);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState(() => (creating ? emptyForm() : null));

  const loadOrders = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/subcontractor-work-orders`, authHeaders());
    setOrders(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    if (creating) return undefined;
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
  }, [creating, workOrderId]);

  const order = useMemo(
    () => orders.find((row) => String(row._id) === String(workOrderId)) || null,
    [orders, workOrderId]
  );
  const form = draft || (order ? formFromOrder(order) : emptyForm());

  const replaceForm = (next) => {
    setDraft(typeof next === 'function' ? (prev) => next(prev || form) : next);
  };

  const liveTotals = useMemo(() => computeWorkOrderTotals(form), [form]);
  const liveVariance = useMemo(
    () => reconcileVariance(liveTotals.amountDue, form.paidAmount),
    [liveTotals.amountDue, form.paidAmount]
  );

  const updateField = (field, value) => {
    replaceForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLine = (index, field, value) => {
    replaceForm((prev) => ({
      ...prev,
      equipmentLines: prev.equipmentLines.map((line, lineIndex) => (
        lineIndex === index ? { ...line, [field]: value } : line
      )),
    }));
  };

  const addEquipmentLine = () => {
    replaceForm((prev) => ({ ...prev, equipmentLines: [...prev.equipmentLines, emptyEquipmentLine()] }));
  };

  const removeEquipmentLine = (index) => {
    replaceForm((prev) => {
      const next = prev.equipmentLines.filter((_, lineIndex) => lineIndex !== index);
      return { ...prev, equipmentLines: next.length ? next : [emptyEquipmentLine()] };
    });
  };

  const closeEdit = () => {
    setFormError('');
    setDraft(null);
    if (creating) {
      navigate('/subcontractor');
      return;
    }
    setSearchParams({});
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
      if (creating) {
        const res = await axios.post(
          `${API_BASE_URL}/api/subcontractor-work-orders`,
          checked.value,
          authHeaders()
        );
        const id = res.data?._id;
        navigate(id ? `/subcontractor/${id}` : '/subcontractor');
        return;
      }
      await axios.put(
        `${API_BASE_URL}/api/subcontractor-work-orders/${workOrderId}`,
        checked.value,
        authHeaders()
      );
      await loadOrders();
      setDraft(null);
      setSearchParams({});
    } catch (err) {
      setFormError(err.response?.data?.msg || 'Failed to save work order');
    }
  };

  const deleteOrder = async () => {
    const label = order?.workOrderNumber || form.workOrderNumber || 'this work order';
    if (!window.confirm(`Delete work order ${label}?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/subcontractor-work-orders/${workOrderId}`, authHeaders());
      navigate('/subcontractor');
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete work order');
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
        <p>Loading work order...</p>
      </div>
    );
  }

  if (!creating && !order) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
        <Link to="/subcontractor" className="text-sm underline">Back to work orders</Link>
        <p className="mt-4">{error || 'Work order not found.'}</p>
      </div>
    );
  }

  const reconciled = workOrderIsReconciled(order || {});
  const title = creating ? 'New work order' : (order?.workOrderNumber || form.workOrderNumber);
  const showForm = creating || (editing && order);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
      <Link to="/subcontractor" className="text-sm underline">Back to work orders</Link>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mt-4 mb-6">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${reconciled ? 'text-green-700' : ''}`}>
            {title}
          </h1>
          {!creating && order ? (
            <p className={`text-sm mt-1 ${reconciled ? 'text-green-700' : 'text-slate-600'}`}>
              {order.principal || DEFAULT_PRINCIPAL}
              {order.siteName ? ` · ${order.siteName}` : ''}
              {order.siteCity ? ` · ${order.siteCity}` : ''}
            </p>
          ) : null}
        </div>
        {!creating ? (
          <div className="flex gap-2">
            {showForm ? null : (
              <button type="button" className="btn-staff" onClick={() => setSearchParams({ edit: '1' })}>
                Edit
              </button>
            )}
            <button type="button" className="btn-danger" onClick={deleteOrder}>
              Delete
            </button>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-red-700 mb-4">{error}</p> : null}

      {!showForm && order ? (
        <div className={reconciled ? 'text-green-700' : ''}>
          <p className="capitalize">{order.jobType} · {order.status}</p>
          <p>Completion #: {order.completionNumber || '—'}</p>
          {order.siteAddress ? <p>{order.siteAddress}</p> : null}
          <p className="mt-3">Amount due {money(order.amountDue)}</p>
          {reconciled ? (
            <>
              <p>Paid by Brinks {money(order.paidAmount)}</p>
              <p>Variance {signedMoney(order.variance)}</p>
            </>
          ) : (
            <p className="text-slate-500">Not reconciled</p>
          )}
          {order.notes ? <p className="mt-3">{order.notes}</p> : null}
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={saveOrder}>
          {formError ? <p role="alert" className="text-red-700 mb-3">{formError}</p> : null}
          <AlignedFormGrid className="mb-4">
            <AlignedFormField label="Principal" htmlFor="wo-principal" className="col-span-12 md:col-span-3">
              <input id="wo-principal" value={form.principal} onChange={(event) => updateField('principal', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Work order / ticket number" htmlFor="wo-number" className="col-span-12 md:col-span-3">
              <input id="wo-number" value={form.workOrderNumber} onChange={(event) => updateField('workOrderNumber', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Completion / close number" htmlFor="wo-completion" className="col-span-12 md:col-span-3">
              <input id="wo-completion" value={form.completionNumber} onChange={(event) => updateField('completionNumber', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Status" htmlFor="wo-status" className="col-span-12 md:col-span-3">
              <select id="wo-status" value={form.status} onChange={(event) => updateField('status', event.target.value)} className={fieldClass}>
                {SUBCONTRACTOR_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </AlignedFormField>
            <AlignedFormField label="Site name" htmlFor="wo-site" className="col-span-12 md:col-span-4">
              <input id="wo-site" value={form.siteName} onChange={(event) => updateField('siteName', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Address" htmlFor="wo-address" className="col-span-12 md:col-span-5">
              <input id="wo-address" value={form.siteAddress} onChange={(event) => updateField('siteAddress', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="City" htmlFor="wo-city" className="col-span-12 md:col-span-3">
              <input id="wo-city" value={form.siteCity} onChange={(event) => updateField('siteCity', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Job type" htmlFor="wo-job-type" className="col-span-12 md:col-span-3">
              <select id="wo-job-type" value={form.jobType} onChange={(event) => updateField('jobType', event.target.value)} className={fieldClass}>
                {SUBCONTRACTOR_JOB_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </AlignedFormField>
            <AlignedFormField label="Scheduled date" htmlFor="wo-scheduled" className="col-span-12 md:col-span-3">
              <input id="wo-scheduled" type="date" value={form.scheduledDate} onChange={(event) => updateField('scheduledDate', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Completed date" htmlFor="wo-completed" className="col-span-12 md:col-span-3">
              <input id="wo-completed" type="date" value={form.completedDate} onChange={(event) => updateField('completedDate', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Hours worked" htmlFor="wo-hours" className="col-span-12 md:col-span-3">
              <input id="wo-hours" type="number" min="0" step="0.25" value={form.hoursWorked} onChange={(event) => updateField('hoursWorked', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Hourly rate" htmlFor="wo-rate" className="col-span-12 md:col-span-3">
              <input id="wo-rate" type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(event) => updateField('hourlyRate', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Travel pay" htmlFor="wo-travel" className="col-span-12 md:col-span-3">
              <input id="wo-travel" type="number" min="0" step="0.01" value={form.travelPay} onChange={(event) => updateField('travelPay', event.target.value)} className={fieldClass} />
            </AlignedFormField>
          </AlignedFormGrid>

          <SectionToggle nested title="Reimbursable equipment">
            {form.equipmentLines.map((line, index) => (
              <AlignedFormGrid key={`eq-${index}`} className="mb-2">
                <AlignedFormField label="Equipment description" htmlFor={`wo-eq-desc-${index}`} className="col-span-12 md:col-span-4">
                  <input id={`wo-eq-desc-${index}`} value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} className={fieldClass} />
                </AlignedFormField>
                <AlignedFormField label="SKU" htmlFor={`wo-eq-sku-${index}`} className="col-span-6 md:col-span-2">
                  <input id={`wo-eq-sku-${index}`} value={line.sku} onChange={(event) => updateLine(index, 'sku', event.target.value)} className={fieldClass} />
                </AlignedFormField>
                <AlignedFormField label="Quantity" htmlFor={`wo-eq-qty-${index}`} className="col-span-6 md:col-span-2">
                  <input id={`wo-eq-qty-${index}`} type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} className={fieldClass} />
                </AlignedFormField>
                <AlignedFormField label="Cost" htmlFor={`wo-eq-cost-${index}`} className="col-span-6 md:col-span-2">
                  <input id={`wo-eq-cost-${index}`} type="number" min="0" step="0.01" value={line.cost} onChange={(event) => updateLine(index, 'cost', event.target.value)} className={fieldClass} />
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
          </SectionToggle>

          <AlignedFormField label="Notes" htmlFor="wo-notes" className="mb-4">
            <textarea id="wo-notes" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className={fieldClass} rows={3} />
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

          <SectionToggle nested title="Brinks reconciliation">
            <p className="text-sm text-slate-600 mb-3">
              Amount due is what the work adds up to. Paid by Brinks is what they actually remitted.
              Variance is paid minus due (negative is a short).
            </p>
            <AlignedFormGrid className="mb-4">
              <AlignedFormField label="Paid by Brinks" htmlFor="wo-paid" className="col-span-12 md:col-span-4">
                <input id="wo-paid" type="number" min="0" step="0.01" value={form.paidAmount} onChange={(event) => updateField('paidAmount', event.target.value)} className={fieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Paid date" htmlFor="wo-paid-date" className="col-span-12 md:col-span-4">
                <input id="wo-paid-date" type="date" value={form.paidDate} onChange={(event) => updateField('paidDate', event.target.value)} className={fieldClass} />
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
                  className={fieldClass}
                  rows={2}
                  placeholder="Travel cut, equipment denied, rate change…"
                />
              </AlignedFormField>
            </AlignedFormGrid>
          </SectionToggle>

          <div className="flex gap-2">
            <button type="submit" className="btn-staff">Save work order</button>
            <button type="button" className="btn-staff" onClick={closeEdit}>Cancel edit</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
