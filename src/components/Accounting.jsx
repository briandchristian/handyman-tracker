/**
 * Staff accounting overview: AR, AP, tax, Direct vs Indirect costs, and job contribution.
 * Source documents stay on jobs, expenses, labor, and imported checking lines — this page summarizes them.
 * A checking line stays off the P&L until it is categorized or reconciled to a record already entered.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { COST_CENTERS } from '../constants/costCenters';
import { checkingCategoryChoices } from '../../server/lib/checkingCategories.js';
import { LABOR_WORK_TYPES, INDIRECT_LABOR_WORK_TYPES } from '../constants/laborWorkTypes';
import { PROJECT_WORK_TYPES, jobMatchesWorkTypeFilter, projectWorkTypeLabel } from '../constants/projectWorkTypes';
import { asCalendarDay, currentMonthRange, rangeFromSearch } from '../../server/lib/dateRange.js';
import { buildPeriodLedgerRows, filterPeriodLedgerRows } from '../utils/periodLedger';
import { formatCustomerLabel, formatJobLabel } from '../constants/jobIdentity';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';
import SectionToggle from './SectionToggle';

const money = (value) =>
  `$${(Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const bankMoney = (value) => {
  const amount = Number(value) || 0;
  const body = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-$${body}` : `$${body}`;
};

const rateLabel = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return money(value);
};

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

function asList(data) {
  return Array.isArray(data) ? data : [];
}

export default function Accounting() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultRange = currentMonthRange();
  const initialRange = rangeFromSearch(searchParams, defaultRange);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [costCenters, setCostCenters] = useState(COST_CENTERS);
  const [customers, setCustomers] = useState([]);
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [expenseForm, setExpenseForm] = useState({
    date: defaultRange.from,
    amount: '',
    payee: '',
    description: '',
    costCenterCode: 'OFFICE',
    job: '',
  });
  const [laborForm, setLaborForm] = useState({
    date: defaultRange.from,
    hours: '',
    hourlyCost: '',
    workType: 'bidding',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [laborEntries, setLaborEntries] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [checkingLines, setCheckingLines] = useState([]);
  const [checkingDrafts, setCheckingDrafts] = useState({});
  const [importNote, setImportNote] = useState('');
  const [importError, setImportError] = useState('');
  const [ledgerClass, setLedgerClass] = useState('');

  const loadSummary = async (range = { from, to }) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const qs = params.toString();
    const res = await axios.get(
      `${API_BASE_URL}/api/accounting/summary${qs ? `?${qs}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setSummary(res.data);
  };

  const rangeQuery = (range) => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const loadLedger = async (range = { from, to }) => {
    const headers = authHeaders();
    const qs = rangeQuery(range);
    const [expenseRes, laborRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/expenses${qs}`, headers).catch(() => ({ data: [] })),
      axios.get(`${API_BASE_URL}/api/labor-entries${qs}`, headers).catch(() => ({ data: [] })),
    ]);
    setExpenses(asList(expenseRes.data));
    setLaborEntries(asList(laborRes.data));
  };

  const loadChecking = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/accounting/checking-lines`, authHeaders());
      setCheckingLines(asList(res.data));
    } catch {
      setCheckingLines([]);
    }
  };

  const loadPeriod = async (range = { from, to }) => {
    await Promise.all([loadSummary(range), loadLedger(range), loadChecking()]);
  };

  const loadAux = async () => {
    const headers = authHeaders();
    const [centersRes, customersRes, workOrdersRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/cost-centers`, headers).catch(() => ({ data: COST_CENTERS })),
      axios.get(`${API_BASE_URL}/api/customers`, headers).catch(() => ({ data: [] })),
      axios.get(`${API_BASE_URL}/api/subcontractor-work-orders`, headers).catch(() => ({ data: [] })),
    ]);
    const centers = asList(centersRes.data);
    setCostCenters(centers.length ? centers : COST_CENTERS);
    setCustomers(asList(customersRes.data));
    setWorkOrders(asList(workOrdersRes.data));
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    Promise.all([loadPeriod({ from, to }), loadAux()]).catch((err) => {
      if (!token) setError('Failed to load accounting');
      else setError(err.response?.data?.msg || 'Failed to load accounting');
    });
    // Load once on mount with the default month; later changes use Apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Job profit only: blank/missing workType is installation, same as the Type column.
  const jobs = useMemo(() => {
    const list = asList(summary?.jobs);
    if (!workTypeFilter) return list;
    return list.filter((job) => jobMatchesWorkTypeFilter(job.workType, workTypeFilter));
  }, [summary, workTypeFilter]);

  const customerJobOptions = useMemo(() => {
    const options = [];
    customers.forEach((customer) => {
      const labelFor = (job) => `${formatJobLabel(job)} (${formatCustomerLabel(customer)})`;
      (customer.projects || []).forEach((project) => {
        options.push({
          value: `${customer._id}:${project._id}`,
          label: labelFor(project),
        });
      });
      (customer.serviceJobs || []).forEach((job) => {
        if (!job?._id) return;
        options.push({
          value: `${customer._id}:${job._id}`,
          label: labelFor(job),
        });
      });
    });
    return options;
  }, [customers]);

  const subcontractorJobOptions = useMemo(() => workOrders.map((order) => ({
    value: `subcontractor:${order._id}`,
    label: `${order.workOrderNumber || 'Work order'}${order.siteName ? ` · ${order.siteName}` : ''} (${order.principal || 'Subcontractor'})`,
  })), [workOrders]);

  const ledgerJobs = useMemo(() => {
    const fromSummary = asList(summary?.jobs).map((job) => ({
      customerId: job.customerId,
      projectId: job.projectId,
      customerName: job.customerName,
      projectName: job.projectName,
      jobNumber: job.jobNumber,
    }));
    if (fromSummary.length) return fromSummary;
    const fromCustomers = [];
    customers.forEach((customer) => {
      (customer.projects || []).forEach((project) => {
        fromCustomers.push({
          customerId: customer._id,
          projectId: project._id,
          customerName: customer.name,
          projectName: project.name,
          jobNumber: project.jobNumber,
        });
      });
      (customer.serviceJobs || []).forEach((job) => {
        fromCustomers.push({
          customerId: customer._id,
          projectId: job._id,
          customerName: customer.name,
          projectName: job.name,
          jobNumber: job.jobNumber,
        });
      });
    });
    return fromCustomers;
  }, [summary, customers]);

  const ledgerRows = useMemo(
    () => filterPeriodLedgerRows(
      buildPeriodLedgerRows({ expenses, laborEntries, jobs: ledgerJobs }),
      ledgerClass
    ),
    [expenses, laborEntries, ledgerJobs, ledgerClass]
  );

  const deleteLedgerRow = async (row) => {
    setFormError('');
    try {
      const path = row.source === 'time' ? `/api/labor-entries/${row.sourceId}` : `/api/expenses/${row.sourceId}`;
      await axios.delete(`${API_BASE_URL}${path}`, authHeaders());
      await loadPeriod({ from, to });
    } catch (err) {
      setFormError(err.response?.data?.msg || 'Failed to delete ledger row');
    }
  };

  // iOS date inputs can blur empty; keep the last YYYY-MM-DD and persist it in ?from=&to=.
  const commitCalendarDay = (value, setter) => {
    const day = asCalendarDay(value);
    if (day) setter(day);
  };

  const applyRange = async () => {
    setError('');
    const range = {
      from: asCalendarDay(from) || defaultRange.from,
      to: asCalendarDay(to) || defaultRange.to,
    };
    setFrom(range.from);
    setTo(range.to);
    setSearchParams({ from: range.from, to: range.to }, { replace: true });
    try {
      await loadPeriod(range);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load accounting');
    }
  };

  const checkingCategories = useMemo(() => {
    const specials = checkingCategoryChoices().filter((item) => item.effect !== 'expense');
    const centers = (costCenters.length ? costCenters : COST_CENTERS).map((center) => ({
      code: center.code,
      name: center.name,
    }));
    const known = new Set(centers.map((center) => center.code));
    COST_CENTERS.forEach((center) => {
      if (!known.has(center.code)) centers.push({ code: center.code, name: center.name });
    });
    return [...centers, ...specials];
  }, [costCenters]);

  const checkingReview = checkingLines.filter((line) => (
    line.status === 'uncategorized' || line.status === 'suggested'
  ));

  const checkingDraft = (line) => checkingDrafts[line._id] || {
    categoryCode: line.categoryCode || 'OFFICE',
    job: line.subcontractorWorkOrderId
      ? `subcontractor:${line.subcontractorWorkOrderId}`
      : (line.customerId && line.projectId ? `${line.customerId}:${line.projectId}` : ''),
    note: line.note || '',
    inventoryLineIds: (line.inventoryLineIds || []).map(String),
  };

  const importChecking = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      event.target.value = '';
    } catch {
      // A file input can only be cleared to an empty string.
    }
    setImportError('');
    setImportNote('');
    try {
      const csv = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read CSV'));
        reader.readAsText(file);
      });
      const res = await axios.post(
        `${API_BASE_URL}/api/accounting/checking-import`,
        { csv },
        authHeaders()
      );
      const data = res.data || {};
      setImportNote(
        `Imported ${data.imported || 0}. Already stored ${data.duplicates || 0}. Possible matches ${data.suggested || 0}.`
      );
      await loadPeriod({ from, to });
    } catch (err) {
      setImportError(err.response?.data?.msg || 'Failed to import checking CSV');
    }
  };

  const saveCheckingCategory = async (line) => {
    setImportError('');
    const draft = checkingDraft(line);
    const payload = { categoryCode: draft.categoryCode, note: draft.note || '' };
    if (draft.categoryCode === 'SALES') payload.inventoryLineIds = draft.inventoryLineIds || [];
    if (String(draft.job).startsWith('subcontractor:')) {
      payload.subcontractorWorkOrderId = draft.job.slice('subcontractor:'.length);
    } else if (draft.job) {
      const [customerId, projectId] = draft.job.split(':');
      payload.customerId = customerId;
      payload.projectId = projectId;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/accounting/checking-lines/${line._id}`, payload, authHeaders());
      await loadPeriod({ from, to });
    } catch (err) {
      setImportError(err.response?.data?.msg || 'Failed to categorize checking line');
    }
  };

  const saveCheckingNote = async (line) => {
    setImportError('');
    const draft = checkingDraft(line);
    try {
      await axios.put(
        `${API_BASE_URL}/api/accounting/checking-lines/${line._id}`,
        { note: draft.note || '' },
        authHeaders()
      );
      await loadPeriod({ from, to });
    } catch (err) {
      setImportError(err.response?.data?.msg || 'Failed to save note');
    }
  };

  const confirmCheckingMatch = async (line) => {
    setImportError('');
    try {
      await axios.put(
        `${API_BASE_URL}/api/accounting/checking-lines/${line._id}`,
        { confirmMatch: true },
        authHeaders()
      );
      await loadPeriod({ from, to });
    } catch (err) {
      setImportError(err.response?.data?.msg || 'Failed to reconcile checking line');
    }
  };

  const submitExpense = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      const payload = {
        date: expenseForm.date,
        amount: Number(expenseForm.amount),
        payee: expenseForm.payee,
        description: expenseForm.description,
        costCenterCode: expenseForm.costCenterCode,
      };
      if (String(expenseForm.job).startsWith('subcontractor:')) {
        payload.subcontractorWorkOrderId = expenseForm.job.slice('subcontractor:'.length);
      } else if (expenseForm.job) {
        const [customerId, projectId] = expenseForm.job.split(':');
        payload.customerId = customerId;
        payload.projectId = projectId;
      }
      await axios.post(`${API_BASE_URL}/api/expenses`, payload, authHeaders());
      setExpenseForm({ ...expenseForm, amount: '', payee: '', description: '', job: '' });
      await loadPeriod({ from, to });
    } catch (err) {
      setFormError(err.response?.data?.msg || 'Failed to save expense');
    }
  };

  const submitLabor = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      const payload = {
        date: laborForm.date,
        hours: Number(laborForm.hours),
        workType: laborForm.workType,
        notes: laborForm.notes,
      };
      if (laborForm.hourlyCost !== '') payload.hourlyCost = Number(laborForm.hourlyCost);
      await axios.post(`${API_BASE_URL}/api/labor-entries`, payload, authHeaders());
      setLaborForm({ ...laborForm, hours: '', notes: '' });
      await loadPeriod({ from, to });
    } catch (err) {
      setFormError(err.response?.data?.msg || 'Failed to save time');
    }
  };

  if (error && !summary) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
        <h1 className="text-2xl font-bold mb-4">Accounting</h1>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
        <h1 className="text-2xl font-bold mb-4">Accounting</h1>
        <p>Loading...</p>
      </div>
    );
  }

  const direct = summary.direct || { materials: 0, labor: 0, expenses: 0, total: 0 };
  const indirect = summary.indirect || { total: 0, byCostCenter: [] };
  const period = summary.period || {};

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Accounting</h1>
      </div>

      <SectionToggle title="Period" className="mb-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="text-sm text-slate-600">
            From
            <input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(e) => commitCalendarDay(e.target.value, setFrom)}
              className="mt-1 block w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </label>
          <label className="text-sm text-slate-600">
            To
            <input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(e) => commitCalendarDay(e.target.value, setTo)}
              className="mt-1 block w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
            />
          </label>
          <button type="button" onClick={applyRange} className="btn-staff">
            Apply range
          </button>
        </div>
        {error ? <p className="text-red-700 text-sm mt-2">{error}</p> : null}
      </SectionToggle>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="card-surface p-4">
          <p className="text-sm text-slate-600">Accounts receivable</p>
          <p className="text-2xl font-bold">{money(summary.ar.balance)}</p>
          <p className="text-sm text-slate-600 mt-1">
            Billed {money(summary.ar.billed)} · Paid {money(summary.ar.paid)}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-sm text-slate-600">Accounts payable</p>
          <p className="text-2xl font-bold">{money(summary.ap.balance)}</p>
          <p className="text-sm text-slate-600 mt-1">
            Unpaid received POs {money(summary.ap.receivedUnpaid)} · Paid{' '}
            {money(summary.ap.paid)}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-sm text-slate-600">Tax collected</p>
          <p className="text-2xl font-bold">{money(summary.taxCollected)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="card-surface p-4">
          <p className="text-sm text-slate-600">Direct costs</p>
          <p className="text-2xl font-bold">{money(direct.total)}</p>
          <p className="text-sm text-slate-600 mt-1">
            Materials {money(direct.materials)} · Labor {money(direct.labor)} · Expenses{' '}
            {money(direct.expenses)}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-sm text-slate-600">Indirect costs</p>
          <p className="text-2xl font-bold">{money(indirect.total)}</p>
          <p className="text-sm text-slate-600 mt-1">Period overhead (not allocated onto jobs)</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-sm text-slate-600">Contribution</p>
          <p className="text-2xl font-bold">{money(period.contribution)}</p>
          <p className="text-sm text-slate-600 mt-1">
            Revenue {money(period.revenue)} · Overhead / hour {rateLabel(period.overheadRatePerHour)}
          </p>
        </div>
      </div>

      <SectionToggle title="Checking account" className="mb-6">
        <p className="text-sm text-slate-600 mb-4">
          Import the checking-account CSV, starting with the full history from when the account opened.
          Later exports skip lines already stored. A line that matches an expense or supplier payment
          already entered can be reconciled so it is not counted twice. Cost centers file expenses.
          Other income, a customer payment already on a job, a transfer, and an owner draw are separate,
          because a cost center cannot describe those. A purchase filed as Inventory stays on the shelf.
          When you file the deposit as Sales and check that purchase, the income is recorded and the
          purchase cost becomes cost of goods sold. A line stays off the P&amp;L until you categorize it or reconcile it.
        </p>
        <AlignedFormField label="Checking CSV" htmlFor="checking-csv" className="max-w-md">
          <input
            id="checking-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={importChecking}
            className="w-full text-sm"
          />
        </AlignedFormField>
        {importNote ? <p className="text-sm text-slate-700 mt-3">{importNote}</p> : null}
        {importError ? <p role="alert" className="text-red-700 mt-3">{importError}</p> : null}
        <p className="text-sm text-slate-600 mt-4">
          {checkingLines.length === 0
            ? 'No checking lines yet.'
            : `${checkingReview.length} still need a category. ${checkingLines.length - checkingReview.length} categorized or reconciled.`}
        </p>
        <div className="space-y-3 mt-4">
          {[...checkingReview, ...checkingLines.filter((line) => (
            line.status === 'categorized' && line.categoryCode === 'SALES'
          ))].map((line) => {
            const draft = checkingDraft(line);
            const soldElsewhere = new Set();
            checkingLines.forEach((other) => {
              if (String(other._id) === String(line._id) || other.categoryCode !== 'SALES') return;
              (other.inventoryLineIds || []).forEach((id) => soldElsewhere.add(String(id)));
            });
            const inventoryLots = checkingLines.filter((lot) => (
              lot.status === 'categorized'
              && lot.categoryCode === 'INVENTORY'
              && Number(lot.amount) < 0
              && !soldElsewhere.has(String(lot._id))
            ));
            const selectedIds = new Set((draft.inventoryLineIds || []).map(String));
            const goodsCost = inventoryLots.reduce((sum, lot) => (
              selectedIds.has(String(lot._id)) ? sum + Math.abs(Number(lot.amount) || 0) : sum
            ), 0);
            return (
              <article key={line._id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{line.description || 'Checking line'}</h3>
                    <p className="text-sm text-slate-600">
                      {asCalendarDay(line.postedDate)}
                      {' · '}
                      <span className={Number(line.amount) < 0 ? 'text-red-700' : 'text-green-700'}>
                        {bankMoney(line.amount)}
                      </span>
                    </p>
                    {line.suggestion?.label ? (
                      <p className="text-sm text-slate-700 mt-1">{line.suggestion.label}</p>
                    ) : null}
                    <label className="block text-sm text-slate-600 mt-2">
                      Note
                      <input
                        aria-label={`Note for ${line.description || 'checking line'}`}
                        value={draft.note}
                        onChange={(event) => setCheckingDrafts((prev) => ({
                          ...prev,
                          [line._id]: { ...draft, note: event.target.value },
                        }))}
                        className="mt-1 block w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
                      />
                    </label>
                    <button type="button" className="btn-row btn-row-secondary mt-2" onClick={() => saveCheckingNote(line)}>
                      Save note
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <label className="text-sm text-slate-600">
                      Category
                      <select
                        aria-label={`Category for ${line.description || 'checking line'}`}
                        value={draft.categoryCode}
                        onChange={(event) => setCheckingDrafts((prev) => ({
                          ...prev,
                          [line._id]: { ...draft, categoryCode: event.target.value },
                        }))}
                        className="mt-1 block w-full sm:w-56 p-2 border border-slate-300 rounded bg-white text-slate-900"
                      >
                        {checkingCategories.map((category) => (
                          <option key={category.code} value={category.code}>{category.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-600">
                      Job
                      <select
                        aria-label={`Job for ${line.description || 'checking line'}`}
                        value={draft.job}
                        onChange={(event) => setCheckingDrafts((prev) => ({
                          ...prev,
                          [line._id]: { ...draft, job: event.target.value },
                        }))}
                        className="mt-1 block w-full sm:w-56 p-2 border border-slate-300 rounded bg-white text-slate-900"
                      >
                        <option value="">Overhead — no job</option>
                        {customerJobOptions.length ? (
                          <optgroup label="Customer jobs">
                            {customerJobOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </optgroup>
                        ) : null}
                        {subcontractorJobOptions.length ? (
                          <optgroup label="Subcontractor">
                            {subcontractorJobOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </label>
                    {draft.categoryCode === 'SALES' ? (
                      <fieldset className="text-sm text-slate-600 sm:min-w-56">
                        <legend>Inventory sold</legend>
                        {inventoryLots.length === 0 ? (
                          <p className="mt-1">No inventory purchases are waiting to be sold.</p>
                        ) : inventoryLots.map((lot) => (
                          <label key={lot._id} className="mt-1 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(String(lot._id))}
                              onChange={(event) => {
                                const id = String(lot._id);
                                const nextIds = event.target.checked
                                  ? [...selectedIds, id]
                                  : [...selectedIds].filter((value) => value !== id);
                                setCheckingDrafts((prev) => ({
                                  ...prev,
                                  [line._id]: { ...draft, inventoryLineIds: nextIds },
                                }));
                              }}
                            />
                            {`${lot.description || 'Inventory'} · ${money(Math.abs(Number(lot.amount) || 0))}`}
                          </label>
                        ))}
                        <p className="mt-1">Cost of goods sold {money(goodsCost)}</p>
                      </fieldset>
                    ) : null}
                    <button type="button" className="btn-row btn-row-primary" onClick={() => saveCheckingCategory(line)}>
                      Save category
                    </button>
                    {line.suggestion?.id ? (
                      <button type="button" className="btn-row btn-row-secondary" onClick={() => confirmCheckingMatch(line)}>
                        Use existing
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </SectionToggle>

      <SectionToggle title="Period P&L lite" className="mb-6">
        <p className="text-sm text-slate-600 mb-4">
          Overhead rate is for future bid markup. Jobs are not auto-burdened.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-slate-600">Revenue</p>
            <p className="font-semibold">{money(period.revenue)}</p>
          </div>
          <div>
            <p className="text-slate-600">Other income</p>
            <p className="font-semibold">{money(period.otherIncome)}</p>
          </div>
          <div>
            <p className="text-slate-600">Subcontractor income</p>
            <p className="font-semibold">{money(period.subcontractorIncome)}</p>
          </div>
          <div>
            <p className="text-slate-600">Sales</p>
            <p className="font-semibold">{money(period.sales)}</p>
          </div>
          <div>
            <p className="text-slate-600">Cost of goods sold</p>
            <p className="font-semibold">{money(period.cogs)}</p>
          </div>
          <div>
            <p className="text-slate-600">Inventory on hand</p>
            <p className="font-semibold">{money(summary.inventory?.onHand)}</p>
          </div>
          <div>
            <p className="text-slate-600">Direct (period)</p>
            <p className="font-semibold">{money(direct.total)}</p>
          </div>
          <div>
            <p className="text-slate-600">Indirect (period)</p>
            <p className="font-semibold">{money(indirect.total)}</p>
          </div>
          <div>
            <p className="text-slate-600">Overhead rate on direct cost</p>
            <p className="font-semibold">
              {period.overheadRateOnCost == null ? '—' : `${(Number(period.overheadRateOnCost) * 100).toFixed(0)}%`}
            </p>
          </div>
        </div>
      </SectionToggle>

      {asList(indirect.byCostCenter).length > 0 ? (
        <SectionToggle title="Indirect by cost center" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3">Cost center</th>
                  <th className="py-2 pr-3">Expenses</th>
                  <th className="py-2 pr-3">Labor</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {indirect.byCostCenter.map((row) => (
                  <tr key={row.code} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{row.name || row.code}</td>
                    <td className="py-2 pr-3">{money(row.expenses)}</td>
                    <td className="py-2 pr-3">{money(row.labor)}</td>
                    <td className="py-2 font-semibold">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionToggle>
      ) : null}

      <SectionToggle title="Period ledger" className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p className="text-sm text-slate-600">
              Source documents for this date range. Totals above are the roll-up; this is the line-item sub-ledger.
            </p>
          </div>
          <label className="text-sm text-slate-600">
            Class
            <select
              aria-label="Ledger class"
              value={ledgerClass}
              onChange={(e) => setLedgerClass(e.target.value)}
              className="ml-2 p-2 border border-slate-300 rounded bg-white text-slate-900"
            >
              <option value="">All</option>
              <option value="indirect">Indirect</option>
              <option value="direct">Direct</option>
            </select>
          </label>
        </div>
        {ledgerRows.length === 0 ? (
          <p className="text-slate-600">No expenses or time in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Class</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Hours</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Payee / notes</th>
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row) => (
                  <tr key={`${row.source}-${row.id}`} className="border-b border-slate-100">
                    <td className="py-2 pr-3 whitespace-nowrap">{row.date}</td>
                    <td className="py-2 pr-3">{row.source === 'time' ? 'Time' : 'Expense'}</td>
                    <td className="py-2 pr-3 capitalize">{row.costClass}</td>
                    <td className="py-2 pr-3">{row.category}</td>
                    <td className="py-2 pr-3">{row.hours == null ? '—' : `${row.hours} hrs`}</td>
                    <td className="py-2 pr-3">{money(row.amount)}</td>
                    <td className="py-2 pr-3">
                      {row.payee ? <span>{row.payee}</span> : null}
                      {row.payee && row.notes ? ' — ' : null}
                      {row.notes ? <span>{row.notes}</span> : null}
                      {!row.payee && !row.notes ? '—' : null}
                    </td>
                    <td className="py-2 pr-3">{row.job || '—'}</td>
                    <td className="py-2">
                      {row.sourceId ? (
                        <button
                          type="button"
                          className="text-red-700 underline"
                          onClick={() => deleteLedgerRow(row)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionToggle>

      <SectionToggle title="Job profit" className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <p className="text-sm text-slate-600">
              Billed is invoice revenue. Quoted is the bid and is not used in profit or material cost.
              Hours and the hourly rate on a customer service job count as labor.
              Material cost is qty × what you paid. Parts sold is qty × what you charged and is included in
              billed revenue. Profit is billed minus material cost. Subcontractor labor stays off this
              list; their parts are included. A labor-only job with no material lines should show $0 material cost.
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Work type filters this Job profit table only. Period ledger and P&L stay for the full
              date range. Types are Installation, Service, and Consultation — not bid or job status.
            </p>
          </div>
          <label className="text-sm text-slate-600">
            Work type
            <select
              aria-label="Filter by work type"
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="ml-2 p-2 border border-slate-300 rounded bg-white text-slate-900"
            >
              <option value="">All</option>
              {PROJECT_WORK_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {jobs.length === 0 ? (
          <p className="text-slate-600">
            {workTypeFilter
              ? `No ${projectWorkTypeLabel(workTypeFilter)} jobs in this Job profit list.`
              : 'No jobs yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Quoted</th>
                  <th className="py-2 pr-3">Billed</th>
                  <th className="py-2 pr-3">Parts sold</th>
                  <th className="py-2 pr-3">Material cost</th>
                  <th className="py-2 pr-3">Labor</th>
                  <th className="py-2 pr-3">Direct expenses</th>
                  <th className="py-2 pr-3">Profit</th>
                  <th className="py-2">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, index) => (
                  <tr key={`${job.projectId || job.projectName}-${index}`} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{job.customerLabel || formatCustomerLabel({
                      name: job.customerName,
                      accountNumber: job.accountNumber,
                    })}</td>
                    <td className="py-2 pr-3">{job.jobLabel || formatJobLabel({ name: job.projectName, jobNumber: job.jobNumber })}</td>
                    <td className="py-2 pr-3">{projectWorkTypeLabel(job.workType)}</td>
                    <td className="py-2 pr-3">{job.status}</td>
                    <td className="py-2 pr-3">{money(job.quoted)}</td>
                    <td className="py-2 pr-3">{money(job.billed)}</td>
                    <td className="py-2 pr-3">{money(job.partsSold)}</td>
                    <td className="py-2 pr-3">{money(job.materialCost)}</td>
                    <td className="py-2 pr-3">{money(job.laborCost)}</td>
                    <td className="py-2 pr-3">{money(job.directExpenseCost)}</td>
                    <td className="py-2 pr-3">{money(job.profit)}</td>
                    <td className="py-2 font-semibold">{money(job.contribution ?? job.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionToggle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <SectionToggle title="Record expense" defaultOpen={false}>
        <form onSubmit={submitExpense}>
          <p className="text-sm text-slate-600 mb-4">
            Leave job blank for overhead (office, bidding, fuel pool, consumables). Attach a job to make it Direct.
          </p>
          <AlignedFormGrid testId="accounting-expense-grid">
            <AlignedFormField label="Date" htmlFor="expense-date" className="col-span-12 md:col-span-4">
              <input
                id="expense-date"
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
                required
              />
            </AlignedFormField>
            <AlignedFormField label="Amount" htmlFor="expense-amount" className="col-span-12 md:col-span-4">
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
                required
              />
            </AlignedFormField>
            <AlignedFormField label="Cost center" htmlFor="expense-center" className="col-span-12 md:col-span-4">
              <select
                id="expense-center"
                value={expenseForm.costCenterCode}
                onChange={(e) => setExpenseForm({ ...expenseForm, costCenterCode: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              >
                {(costCenters.length ? costCenters : COST_CENTERS).map((center) => (
                  <option key={center.code} value={center.code}>
                    {center.name}
                  </option>
                ))}
              </select>
            </AlignedFormField>
            <AlignedFormField label="Payee" htmlFor="expense-payee" className="col-span-12 md:col-span-6">
              <input
                id="expense-payee"
                value={expenseForm.payee}
                onChange={(e) => setExpenseForm({ ...expenseForm, payee: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              />
            </AlignedFormField>
            <AlignedFormField label="Job (optional)" htmlFor="expense-job" className="col-span-12 md:col-span-6">
              <select
                id="expense-job"
                value={expenseForm.job}
                onChange={(e) => setExpenseForm({ ...expenseForm, job: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              >
                <option value="">Overhead — no job</option>
                {customerJobOptions.length ? (
                  <optgroup label="Customer jobs">
                    {customerJobOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </optgroup>
                ) : null}
                {subcontractorJobOptions.length ? (
                  <optgroup label="Subcontractor">
                    {subcontractorJobOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </AlignedFormField>
            <AlignedFormField label="Description" htmlFor="expense-description" className="col-span-12">
              <input
                id="expense-description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              />
            </AlignedFormField>
          </AlignedFormGrid>
          <button type="submit" className="mt-3 bg-slate-900 text-white px-4 py-2 rounded">
            Save expense
          </button>
        </form>
        </SectionToggle>

        <SectionToggle title="Record overhead time" defaultOpen={false}>
        <form onSubmit={submitLabor}>
          <p className="text-sm text-slate-600 mb-4">
            Bidding and admin hours are Indirect. Job install/service hours are logged on the project.
          </p>
          <AlignedFormGrid testId="accounting-labor-grid">
            <AlignedFormField label="Date" htmlFor="labor-date" className="col-span-12 md:col-span-4">
              <input
                id="labor-date"
                type="date"
                value={laborForm.date}
                onChange={(e) => setLaborForm({ ...laborForm, date: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
                required
              />
            </AlignedFormField>
            <AlignedFormField label="Hours" htmlFor="labor-hours" className="col-span-12 md:col-span-4">
              <input
                id="labor-hours"
                type="number"
                step="0.25"
                min="0.25"
                value={laborForm.hours}
                onChange={(e) => setLaborForm({ ...laborForm, hours: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
                required
              />
            </AlignedFormField>
            <AlignedFormField label="Hourly cost" htmlFor="labor-rate" className="col-span-12 md:col-span-4">
              <input
                id="labor-rate"
                type="number"
                step="0.01"
                min="0"
                placeholder="Uses staff rate if blank"
                value={laborForm.hourlyCost}
                onChange={(e) => setLaborForm({ ...laborForm, hourlyCost: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              />
            </AlignedFormField>
            <AlignedFormField label="Work type" htmlFor="labor-type" className="col-span-12 md:col-span-6">
              <select
                id="labor-type"
                value={laborForm.workType}
                onChange={(e) => setLaborForm({ ...laborForm, workType: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              >
                {LABOR_WORK_TYPES.filter((type) => INDIRECT_LABOR_WORK_TYPES.includes(type.value)).map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </AlignedFormField>
            <AlignedFormField label="Notes" htmlFor="labor-notes" className="col-span-12 md:col-span-6">
              <input
                id="labor-notes"
                value={laborForm.notes}
                onChange={(e) => setLaborForm({ ...laborForm, notes: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900"
              />
            </AlignedFormField>
          </AlignedFormGrid>
          <button type="submit" className="mt-3 bg-slate-900 text-white px-4 py-2 rounded">
            Save time
          </button>
        </form>
        </SectionToggle>
      </div>
      {formError ? <p className="text-red-700 mb-4">{formError}</p> : null}
    </div>
  );
}
