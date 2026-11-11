/**
 * Jobs and bids on one customer.
 * A job is a single ticket. Each line has a price, and Paid is the optional cost.
 * A bid stays a quote until Import into job copies it onto a job.
 * A bid that a job already carries is shown in green with the job number.
 * That job reports the bid's quoted amount.
 * Notes on a job are a list, separate from the job form, so saving the job leaves them in place.
 * Create PO copies the job lines onto a draft purchase order. Cost is the supplier price.
 * Generate bid prints the shared bid document from these lines and the quoted amount.
 * Quick pick stores a line's description, SKU, price, and paid amount for the next job.
 * The list keeps a dragged order. The dropdown stays in name order.
 * Keep in inventory leaves the purchase on the shelf. Use on this job records the purchase, then uses it.
 * The line supplier is who that part was bought from.
 * Entering Line paid fills Price with that cost plus 30%. A price typed by hand stays until Line paid changes.
 * A bid line can take a quick pick. The price becomes the estimate, and paid stays off the quote.
 * Each bid line can be removed. Removing the last one leaves a blank line.
 * Quoted amount is the sum of each line, quantity times its estimate.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { PROJECT_WORK_TYPES, DEFAULT_PROJECT_WORK_TYPE } from '../constants/projectWorkTypes';
import {
  BID_STATUSES,
  DEFAULT_BID_STATUS,
  DEFAULT_SERVICE_JOB_STATUS,
  SERVICE_JOB_STATUSES,
  computeServiceJobTotals,
  jobDraftFromBid,
  normalizeServiceJobNotes,
  serviceJobMatchesStatus,
} from '../constants/customerWork';
import { formatJobLabel } from '../constants/jobIdentity';
import { purchaseOrderDraftFromJob } from '../utils/purchaseOrders';
import { applyQuickPick, applyQuickPickToBid, compareQuickPicks, moveQuickPick, normalizeQuickPick, orderQuickPicks, quickPickAvailability, quickPickLabel, quickPickStock } from '../utils/quickPicks';
import { priceFromPaid } from '../utils/linePrice';
import QuickPickList from './QuickPickList';
import {
  bidLineAmount,
  bidLinesTotal,
  buildCustomerBidDocument,
  openBidDocument,
  quotedAmountForBid,
} from '../utils/bidDocument';
import { sectionIsOpen, sectionToggleKey } from '../constants/sectionToggles';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';
import SectionToggle from './SectionToggle';

const money = (value) =>
  `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const signedMoney = (value) => {
  const amount = Number(value) || 0;
  if (amount < 0) return `-${money(Math.abs(amount))}`;
  return money(amount);
};

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const emptyLine = () => ({
  description: '',
  sku: '',
  quantity: '',
  price: '',
  paid: '',
  inventoryDisposition: '',
  supplierId: '',
  inventoryItemId: '',
});
const emptyBidLine = () => ({ description: '', quantity: '', estimate: '' });

function emptyJob(customer) {
  return {
    name: '',
    siteName: '',
    siteAddress: customer?.address || '',
    siteCity: '',
    workType: DEFAULT_PROJECT_WORK_TYPE,
    status: DEFAULT_SERVICE_JOB_STATUS,
    scheduledDate: '',
    completedDate: '',
    hoursWorked: '',
    hourlyRate: '',
    travelPay: '',
    paidAmount: '',
    paidDate: '',
    bidId: '',
    chargeLines: [emptyLine()],
  };
}

function formLine(line, price) {
  const disposition = line.inventoryDisposition === 'stock' || line.inventoryDisposition === 'used' || line.inventoryDisposition === 'draw'
    ? line.inventoryDisposition
    : (line.inventoryItemId ? 'used' : '');
  const supplierId = line.supplierId?._id || line.supplierId || '';
  const inventoryItemId = line.inventoryItemId?._id || line.inventoryItemId || '';
  return {
    description: line.description || '',
    sku: line.sku || '',
    quantity: line.quantity ?? '',
    price: price ?? '',
    paid: line.paid ?? '',
    inventoryDisposition: disposition,
    supplierId: supplierId ? String(supplierId) : '',
    inventoryItemId: inventoryItemId ? String(inventoryItemId) : '',
  };
}

function linesFromJob(job) {
  const charges = (Array.isArray(job.chargeLines) ? job.chargeLines : [])
    .map((line) => formLine(line, line.price ?? ''));
  const legacy = (Array.isArray(job.parts) ? job.parts : [])
    .map((line) => formLine(line, line.sold ?? ''));
  const lines = [...charges, ...legacy];
  return lines.length ? lines : [emptyLine()];
}

function jobFromRecord(job) {
  return {
    name: job.name || '',
    siteName: job.siteName || '',
    siteAddress: job.siteAddress || '',
    siteCity: job.siteCity || '',
    workType: job.workType || DEFAULT_PROJECT_WORK_TYPE,
    status: job.status || DEFAULT_SERVICE_JOB_STATUS,
    scheduledDate: toDateInput(job.scheduledDate),
    completedDate: toDateInput(job.completedDate),
    hoursWorked: job.hoursWorked ?? '',
    hourlyRate: job.hourlyRate ?? '',
    travelPay: job.travelPay ?? '',
    paidAmount: job.paidAmount ?? '',
    paidDate: toDateInput(job.paidDate),
    bidId: job.bidId || '',
    chargeLines: linesFromJob(job),
  };
}

const emptyBid = () => ({
  name: '',
  description: '',
  status: DEFAULT_BID_STATUS,
  quotedAmount: '',
  notes: '',
  lines: [emptyBidLine()],
});

function bidFromRecord(bid) {
  const lines = Array.isArray(bid.lines) && bid.lines.length > 0
    ? bid.lines.map((line) => ({
      description: line.description || '',
      quantity: line.quantity ?? '',
      estimate: line.estimate ?? '',
    }))
    : [emptyBidLine()];
  return {
    name: bid.name || '',
    description: bid.description || '',
    status: bid.status || DEFAULT_BID_STATUS,
    quotedAmount: bid.quotedAmount ?? '',
    notes: bid.notes || '',
    lines,
  };
}

const fieldClass = 'field';
const compactFieldClass = 'w-full p-2 border border-slate-300 rounded bg-white text-slate-900';

function JobField({ label, htmlFor, className = '', children }) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function JobSection({ title, children }) {
  return (
    <section className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export default function CustomerWork({ customer, onSaved }) {
  const { pathname } = useLocation();
  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
  const jobs = customer.serviceJobs || [];
  const bids = customer.bids || [];

  const [statusFilter, setStatusFilter] = useState('');
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [jobForm, setJobForm] = useState(() => emptyJob(customer));
  const [editingJobId, setEditingJobId] = useState(null);
  const [jobError, setJobError] = useState('');
  const [noteDrafts, setNoteDrafts] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteError, setNoteError] = useState('');
  const [poJobId, setPoJobId] = useState(null);
  const [poSuppliers, setPoSuppliers] = useState([]);
  const [poSupplier, setPoSupplier] = useState('');
  const [poError, setPoError] = useState('');
  const [poResult, setPoResult] = useState(null);
  const [quickPicks, setQuickPicks] = useState([]);
  const [quickPickMessage, setQuickPickMessage] = useState('');
  const [quickPickLineNotice, setQuickPickLineNotice] = useState(null);
  const [lineSuppliers, setLineSuppliers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [bidEditor, setBidEditor] = useState(() => (
    sectionIsOpen(sectionToggleKey(pathname, 'New bid')) ? 'new' : null
  ));
  const [bidForm, setBidForm] = useState(emptyBid);
  const [bidError, setBidError] = useState('');
  const [monitoringByBid, setMonitoringByBid] = useState({});

  const visibleJobs = useMemo(
    () => jobs.filter((job) => serviceJobMatchesStatus(job, statusFilter)),
    [jobs, statusFilter]
  );

  const quickPicksOpen = jobFormOpen || Boolean(bidEditor);
  useEffect(() => {
    if (!quickPicksOpen) return undefined;
    let cancelled = false;
    axios.get(`${API_BASE_URL}/api/quick-picks`, auth)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.quickPicks || []);
        setQuickPicks(Array.isArray(list) ? orderQuickPicks(list) : []);
      })
      .catch(() => {
        if (!cancelled) setQuickPicks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [quickPicksOpen]);

  useEffect(() => {
    if (!jobFormOpen) return undefined;
    let cancelled = false;
    axios.get(`${API_BASE_URL}/api/suppliers`, auth)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.suppliers || []);
        setLineSuppliers(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setLineSuppliers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [jobFormOpen]);

  useEffect(() => {
    if (!jobFormOpen) return undefined;
    let cancelled = false;
    axios.get(`${API_BASE_URL}/api/inventory`, auth)
      .then((res) => {
        if (!cancelled) setInventoryItems(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setInventoryItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [jobFormOpen]);

  const liveTotals = useMemo(() => computeServiceJobTotals(jobForm), [jobForm]);
  const liveVariance = jobForm.paidAmount === '' || jobForm.paidAmount == null
    ? null
    : Math.round(((Number(jobForm.paidAmount) || 0) - liveTotals.amountDue) * 100) / 100;

  const reservedForPick = (pick, lines) => (Array.isArray(lines) ? lines : []).reduce((sum, line) => {
    if (line.inventoryDisposition !== 'draw') return sum;
    const lineSku = String(line.sku || '').trim().toLowerCase();
    const pickSku = String(pick?.sku || '').trim().toLowerCase();
    const same = lineSku || pickSku
      ? lineSku === pickSku
      : String(line.description || '').trim().toLowerCase() === String(pick?.description || '').trim().toLowerCase();
    return same ? sum + (Number(line.quantity) || 0) : sum;
  }, 0);

  const addQuickPickToBid = (id) => {
    const pick = quickPicks.find((item) => item._id === id);
    if (!pick) return;
    setBidForm((prev) => ({ ...prev, lines: applyQuickPickToBid(prev.lines, pick) }));
  };

  const addQuickPick = (id) => {
    const pick = quickPicks.find((item) => item._id === id);
    if (!pick) return;
    setJobForm((prev) => {
      const availability = quickPickAvailability(pick, inventoryItems, reservedForPick(pick, prev.chargeLines));
      const draw = availability.status === 'in' && availability.available > 0;
      const chargeLines = applyQuickPick(prev.chargeLines, pick).map((line) => ({
        inventoryDisposition: '',
        supplierId: '',
        inventoryItemId: '',
        ...line,
      }));
      const index = chargeLines.length - 1;
      if (draw) {
        chargeLines[index] = {
          ...chargeLines[index],
          inventoryDisposition: 'draw',
          inventoryItemId: availability.item?._id || '',
        };
      }
      return { ...prev, chargeLines };
    });
    setQuickPickMessage('');
  };

  const addPickToInventory = async (pick) => {
    setQuickPickMessage('');
    try {
      await axios.post(`${API_BASE_URL}/api/inventory`, {
        name: String(pick.description || pick.sku || '').trim(),
        sku: String(pick.sku || '').trim(),
        description: pick.description || '',
        currentStock: 0,
        lastPrice: Number(pick.paid) || 0,
        unit: 'each',
      }, auth);
      const res = await axios.get(`${API_BASE_URL}/api/inventory`, auth);
      setInventoryItems(Array.isArray(res.data) ? res.data : []);
      setQuickPickMessage(`${pick.description || pick.sku} added to inventory`);
    } catch (err) {
      setQuickPickMessage(err.response?.data?.msg || 'Failed to add to inventory');
    }
  };

  const saveLineToQuickPick = async (line, index) => {
    const checked = normalizeQuickPick(line);
    if (!checked.ok) {
      setQuickPickLineNotice({ index, ok: false, text: checked.error });
      return;
    }
    setQuickPickMessage('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/quick-picks`, {
        description: line.description,
        sku: line.sku,
        price: line.price,
        paid: line.paid,
      }, auth);
      const saved = res.data;
      setQuickPicks((prev) => orderQuickPicks([...prev.filter((item) => item._id !== saved._id), saved]));
      setQuickPickLineNotice({ index, id: saved._id, ok: true, text: 'Saved to Quick Pick' });
    } catch (err) {
      setQuickPickLineNotice({
        index,
        ok: false,
        text: err.response?.data?.msg || 'Failed to save quick pick',
      });
    }
  };

  const reorderQuickPicks = async (fromId, toId, place) => {
    const previous = quickPicks;
    const next = moveQuickPick(previous, fromId, toId, place);
    if (next.every((pick, index) => String(pick._id) === String(previous[index]?._id))) return;
    setQuickPicks(next);
    try {
      await axios.put(`${API_BASE_URL}/api/quick-picks/order`, { ids: next.map((pick) => pick._id) }, auth);
    } catch (err) {
      setQuickPicks(previous);
      setQuickPickMessage(err.response?.data?.msg || 'Failed to save quick pick order');
    }
  };

  const removeQuickPick = async (pick) => {
    const name = String(pick.description || pick.sku || 'this part').trim();
    if (!window.confirm(`Remove ${name} from quick pick?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/quick-picks/${pick._id}`, auth);
      setQuickPicks((prev) => prev.filter((item) => item._id !== pick._id));
      setQuickPickMessage('');
    } catch (err) {
      setQuickPickMessage(err.response?.data?.msg || 'Failed to remove quick pick');
    }
  };

  const updateJob = (field, value) => setJobForm((prev) => ({ ...prev, [field]: value }));
  const updateCharge = (index, field, value) => {
    setJobForm((prev) => ({
      ...prev,
      chargeLines: prev.chargeLines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, [field]: value };
        if (field === 'paid') {
          const price = priceFromPaid(value);
          if (price != null) next.price = price;
        }
        return next;
      }),
    }));
  };

  const resetJob = () => {
    setEditingJobId(null);
    setJobForm(emptyJob(customer));
    setJobError('');
    setJobFormOpen(false);
  };

  const saveJob = async (event) => {
    event.preventDefault();
    setJobError('');
    const payload = {
      ...jobForm,
      parts: [],
      paidAmount: jobForm.paidAmount === '' ? null : jobForm.paidAmount,
    };
    delete payload.notes;
    const missingSupplier = payload.chargeLines.some((line) => (
      (line.inventoryDisposition === 'stock' || line.inventoryDisposition === 'used')
      && !String(line.supplierId || '').trim()
      && !String(line.inventoryItemId || '').trim()
    ));
    if (missingSupplier) {
      setJobError('Choose a supplier');
      return;
    }
    try {
      if (editingJobId) {
        await axios.put(
          `${API_BASE_URL}/api/customers/${customer._id}/service-jobs/${editingJobId}`,
          payload,
          auth
        );
      } else {
        await axios.post(`${API_BASE_URL}/api/customers/${customer._id}/service-jobs`, payload, auth);
      }
      resetJob();
      await onSaved();
    } catch (err) {
      setJobError(err.response?.data?.msg || 'Failed to save job');
    }
  };

  const addJobNote = async (job) => {
    const text = String(noteDrafts[job._id] || '').trim();
    if (!text) return;
    setNoteError('');
    try {
      await axios.post(
        `${API_BASE_URL}/api/customers/${customer._id}/service-jobs/${job._id}/notes`,
        { text },
        auth
      );
      setNoteDrafts((prev) => ({ ...prev, [job._id]: '' }));
      await onSaved();
    } catch (err) {
      setNoteError(err.response?.data?.msg || 'Failed to add note');
    }
  };

  const saveJobNote = async (job, noteId) => {
    const text = String(editingNote?.text || '').trim();
    if (!text) return;
    setNoteError('');
    try {
      await axios.put(
        `${API_BASE_URL}/api/customers/${customer._id}/service-jobs/${job._id}/notes/${noteId}`,
        { text },
        auth
      );
      setEditingNote(null);
      await onSaved();
    } catch (err) {
      setNoteError(err.response?.data?.msg || 'Failed to save note');
    }
  };

  const deleteJobNote = async (job, noteId) => {
    if (!window.confirm('Delete this note?')) return;
    setNoteError('');
    try {
      await axios.delete(
        `${API_BASE_URL}/api/customers/${customer._id}/service-jobs/${job._id}/notes/${noteId}`,
        auth
      );
      if (editingNote?.jobId === job._id && editingNote?.noteId === noteId) setEditingNote(null);
      await onSaved();
    } catch (err) {
      setNoteError(err.response?.data?.msg || 'Failed to delete note');
    }
  };

  const openPurchaseOrder = async (job) => {
    setPoJobId(job._id);
    setPoSupplier('');
    setPoError('');
    setPoResult(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/suppliers`, auth);
      const list = Array.isArray(res.data) ? res.data : (res.data?.suppliers || []);
      setPoSuppliers(list);
    } catch (err) {
      setPoSuppliers([]);
      setPoError(err.response?.data?.msg || 'Failed to load suppliers');
    }
  };

  const createPurchaseOrder = async (job) => {
    if (!poSupplier) {
      setPoError('Choose a supplier');
      return;
    }
    const draft = purchaseOrderDraftFromJob(job, {
      supplierId: poSupplier,
      jobLabel: formatJobLabel(job),
      customerName: customer.name,
    });
    if (!draft.items.length) {
      setPoError('Add a line with a quantity before creating a purchase order');
      return;
    }
    setPoError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/purchase-orders`, draft, auth);
      setPoResult({ jobId: job._id, poNumber: res.data?.poNumber || 'Purchase order' });
      setPoJobId(null);
    } catch (err) {
      setPoError(err.response?.data?.msg || 'Failed to create purchase order');
    }
  };

  const editJob = (job) => {
    setEditingJobId(job._id);
    setJobForm(jobFromRecord(job));
    setJobError('');
    setJobFormOpen(true);
  };

  const deleteJob = async (job) => {
    const label = formatJobLabel(job);
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/customers/${customer._id}/service-jobs/${job._id}`, auth);
      if (editingJobId === job._id) resetJob();
      await onSaved();
    } catch (err) {
      setJobError(err.response?.data?.msg || 'Failed to delete job');
    }
  };

  const openNewBid = () => {
    setBidEditor('new');
    setBidForm(emptyBid());
    setBidError('');
  };

  const editBid = (bid) => {
    setBidEditor(bid._id);
    setBidForm(bidFromRecord(bid));
    setBidError('');
  };

  const saveBid = async (event) => {
    event.preventDefault();
    setBidError('');
    const payload = {
      ...bidForm,
      quotedAmount: bidLinesTotal(bidForm.lines),
    };
    try {
      if (bidEditor && bidEditor !== 'new') {
        await axios.put(`${API_BASE_URL}/api/customers/${customer._id}/bids/${bidEditor}`, payload, auth);
      } else {
        await axios.post(`${API_BASE_URL}/api/customers/${customer._id}/bids`, payload, auth);
      }
      setBidEditor(null);
      setBidForm(emptyBid());
      await onSaved();
    } catch (err) {
      setBidError(err.response?.data?.msg || 'Failed to save bid');
    }
  };

  const generateCustomerBid = async (bid) => {
    setBidError('');
    try {
      await openBidDocument(buildCustomerBidDocument({
        customer,
        bid,
        includeMonitoringAgreement: Boolean(monitoringByBid[bid._id]),
      }));
    } catch (err) {
      console.error('Error generating bid:', err);
      setBidError('Failed to generate bid');
    }
  };

  const importBidIntoJob = async (bid) => {
    setBidError('');
    try {
      await axios.post(
        `${API_BASE_URL}/api/customers/${customer._id}/service-jobs`,
        jobDraftFromBid(bid),
        auth
      );
      if (bid.status !== 'accepted') {
        const form = bidFromRecord(bid);
        await axios.put(
          `${API_BASE_URL}/api/customers/${customer._id}/bids/${bid._id}`,
          {
            ...form,
            status: 'accepted',
            quotedAmount: form.quotedAmount === '' ? null : form.quotedAmount,
          },
          auth
        );
      }
      await onSaved();
    } catch (err) {
      setBidError(err.response?.data?.msg || 'Failed to import bid');
    }
  };

  const deleteBid = async (bid) => {
    if (!window.confirm(`Delete ${bid.quoteNumber || bid.name}?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/customers/${customer._id}/bids/${bid._id}`, auth);
      if (bidEditor === bid._id) setBidEditor(null);
      await onSaved();
    } catch (err) {
      setBidError(err.response?.data?.msg || 'Failed to delete bid');
    }
  };

  const updateBidLine = (index, field, value) => {
    setBidForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) => (
        lineIndex === index ? { ...line, [field]: value } : line
      )),
    }));
  };

  const removeBidLine = (index) => {
    setBidForm((prev) => {
      const lines = prev.lines.filter((_, lineIndex) => lineIndex !== index);
      return { ...prev, lines: lines.length ? lines : [emptyBidLine()] };
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Jobs are single tickets with line items. Bids are quotes and stay separate.
      </p>

      <SectionToggle title="Jobs">
        <div className="flex justify-end mb-4">
          <AlignedFormField label="Job status" htmlFor="job-status-filter">
            <select
              id="job-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full sm:w-48 p-2 border border-slate-300 rounded bg-white text-slate-900"
            >
              <option value="">All</option>
              {SERVICE_JOB_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </AlignedFormField>
        </div>
        {visibleJobs.length === 0 ? (
          <p className="text-slate-600 mb-4">
            {jobs.length === 0 ? 'No job tickets yet.' : 'No jobs match this status.'}
          </p>
        ) : (
          <div className="space-y-3 mb-6">
            {visibleJobs.map((job) => {
              const relatedBid = (bids || []).find((bid) => job.bidId && String(bid._id) === String(job.bidId));
              const bidLabel = relatedBid ? (relatedBid.quoteNumber || relatedBid.name) : '';
              return (
                <article key={job._id} data-testid={`job-ticket-${job._id}`} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-md">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{formatJobLabel(job)}</h3>
                      <p className="text-sm text-slate-600 capitalize">{job.workType} · {job.status}</p>
                      {job.siteName ? <p className="text-sm">{job.siteName}</p> : null}
                      {relatedBid ? (
                        <p className="text-sm text-slate-600">Quoted {money(quotedAmountForBid(relatedBid))} · {bidLabel}</p>
                      ) : null}
                    </div>
                    <div className="md:text-right">
                      <p className="text-sm text-slate-600">Amount due</p>
                      <p className="text-lg font-semibold">{money(job.amountDue)}</p>
                      {job.paidAmount != null && job.paidAmount !== '' ? (
                        <>
                          <p className="text-sm text-slate-600 mt-1">Paid</p>
                          <p className="font-semibold">{money(job.paidAmount)}</p>
                          <p className="text-sm text-slate-600">Variance</p>
                          <p className="font-semibold">{signedMoney(job.variance)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500 mt-1">Not reconciled</p>
                      )}
                      <div className="flex gap-2 md:justify-end mt-2">
                        {purchaseOrderDraftFromJob(job).items.length > 0 ? (
                          <button type="button" className="btn-row btn-row-secondary" onClick={() => openPurchaseOrder(job)}>Create PO</button>
                        ) : null}
                        <button type="button" className="btn-row btn-row-secondary" onClick={() => editJob(job)}>Edit</button>
                        <button type="button" className="btn-row btn-row-danger" onClick={() => deleteJob(job)}>Delete</button>
                      </div>
                    </div>
                  </div>
                  {poJobId === job._id ? (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <h4 className="font-medium mb-2">Purchase order</h4>
                      <p className="text-sm text-slate-600 mb-2">
                        {purchaseOrderDraftFromJob(job).items.length} lines. Cost is the supplier price. A blank cost stays zero until you set it on the order.
                      </p>
                      {poError ? <p role="alert" className="text-red-700 mb-2">{poError}</p> : null}
                      <div className="flex flex-wrap gap-2 items-end">
                        <label className="text-sm text-slate-700">
                          PO supplier
                          <select
                            aria-label="PO supplier"
                            value={poSupplier}
                            onChange={(event) => setPoSupplier(event.target.value)}
                            className={`${compactFieldClass} mt-1`}
                          >
                            <option value="">Choose a supplier</option>
                            {poSuppliers.map((supplier) => (
                              <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="btn-primary" onClick={() => createPurchaseOrder(job)}>Create purchase order</button>
                        <button type="button" className="btn-secondary" onClick={() => setPoJobId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : null}
                  {poResult?.jobId === job._id ? (
                    <p className="text-sm text-emerald-800 mt-2">
                      Draft{' '}
                      <Link to="/purchase-orders" className="underline font-medium">{poResult.poNumber}</Link>
                    </p>
                  ) : null}
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <h4 className="font-medium mb-2">Notes</h4>
                    {noteError ? <p role="alert" className="text-red-700 mb-2">{noteError}</p> : null}
                    {normalizeServiceJobNotes(job.notes).length === 0 ? (
                      <p className="text-sm text-slate-600 mb-2">No notes yet.</p>
                    ) : (
                      <ul className="space-y-2 mb-3">
                        {normalizeServiceJobNotes(job.notes).map((note, index) => {
                          const noteId = String(note._id || index);
                          const editing = editingNote?.jobId === job._id && editingNote?.noteId === noteId;
                          return (
                            <li key={noteId} className="border-l-4 border-blue-400 pl-3 py-1">
                              {editing ? (
                                <div className="space-y-2">
                                  <textarea
                                    aria-label="Edit note text"
                                    rows={3}
                                    value={editingNote.text}
                                    onChange={(event) => setEditingNote((prev) => ({ ...prev, text: event.target.value }))}
                                    className={compactFieldClass}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button type="button" className="btn-row btn-row-primary" onClick={() => saveJobNote(job, noteId)}>Save note</button>
                                    <button type="button" className="btn-row btn-row-secondary" onClick={() => setEditingNote(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="whitespace-pre-wrap">{note.text}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <button
                                      type="button"
                                      className="btn-row btn-row-secondary"
                                      onClick={() => setEditingNote({ jobId: job._id, noteId, text: note.text })}
                                    >
                                      Edit note
                                    </button>
                                    <button type="button" className="btn-row btn-row-danger" onClick={() => deleteJobNote(job, noteId)}>Delete note</button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="flex gap-2 flex-wrap items-end">
                      <textarea
                        aria-label={`Note for ${job.jobNumber || job.name}`}
                        rows={2}
                        placeholder="Add a note..."
                        value={noteDrafts[job._id] || ''}
                        onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [job._id]: event.target.value }))}
                        className={`${compactFieldClass} flex-1 min-w-[200px]`}
                      />
                      <button type="button" className="btn-primary" onClick={() => addJobNote(job)}>Add note</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <SectionToggle
          nested
          title={editingJobId ? 'Edit job' : 'New job'}
          open={jobFormOpen}
          onOpenChange={setJobFormOpen}
        >
        <form aria-label="Job ticket" onSubmit={saveJob} className="card-surface space-y-6 p-4 text-slate-900 md:p-6">
          {editingJobId ? (
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              {jobs.find((job) => job._id === editingJobId)?.jobNumber}
            </p>
          ) : null}
          {jobError ? <p role="alert" className="text-red-700">{jobError}</p> : null}
          <JobSection title="Job">
            <JobField label="Job name" htmlFor="job-name">
              <input id="job-name" value={jobForm.name} onChange={(event) => updateJob('name', event.target.value)} className={fieldClass} />
            </JobField>
            <div className="grid gap-3 md:grid-cols-2">
              <JobField label="Work type" htmlFor="job-work-type">
                <select id="job-work-type" value={jobForm.workType} onChange={(event) => updateJob('workType', event.target.value)} className={fieldClass}>
                  {PROJECT_WORK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </JobField>
              <JobField label="Ticket status" htmlFor="job-status">
                <select id="job-status" value={jobForm.status} onChange={(event) => updateJob('status', event.target.value)} className={fieldClass}>
                  {SERVICE_JOB_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </JobField>
            </div>
            <JobField label="Related bid" htmlFor="job-bid">
              <select id="job-bid" value={jobForm.bidId} onChange={(event) => updateJob('bidId', event.target.value)} className={fieldClass}>
                <option value="">No related bid</option>
                {bids.map((bid) => (
                  <option key={bid._id} value={bid._id}>{bid.quoteNumber ? `${bid.quoteNumber} · ${bid.name}` : bid.name}</option>
                ))}
              </select>
            </JobField>
          </JobSection>

          <JobSection title="Site">
            <JobField label="Site name" htmlFor="job-site">
              <input id="job-site" value={jobForm.siteName} onChange={(event) => updateJob('siteName', event.target.value)} className={fieldClass} />
            </JobField>
            <div className="grid gap-3 md:grid-cols-2">
              <JobField label="Site address" htmlFor="job-address">
                <input id="job-address" value={jobForm.siteAddress} onChange={(event) => updateJob('siteAddress', event.target.value)} className={fieldClass} />
              </JobField>
              <JobField label="City" htmlFor="job-city">
                <input id="job-city" value={jobForm.siteCity} onChange={(event) => updateJob('siteCity', event.target.value)} className={fieldClass} />
              </JobField>
            </div>
          </JobSection>

          <JobSection title="Schedule">
            <div className="grid gap-3 md:grid-cols-2">
              <JobField label="Scheduled date" htmlFor="job-scheduled">
                <input id="job-scheduled" type="date" value={jobForm.scheduledDate} onChange={(event) => updateJob('scheduledDate', event.target.value)} className={fieldClass} />
              </JobField>
              <JobField label="Completed date" htmlFor="job-completed">
                <input id="job-completed" type="date" value={jobForm.completedDate} onChange={(event) => updateJob('completedDate', event.target.value)} className={fieldClass} />
              </JobField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <JobField label="Hours worked" htmlFor="job-hours">
                <input id="job-hours" type="number" min="0" step="0.25" value={jobForm.hoursWorked} onChange={(event) => updateJob('hoursWorked', event.target.value)} className={fieldClass} />
              </JobField>
              <JobField label="Hourly rate" htmlFor="job-rate">
                <input id="job-rate" type="number" min="0" step="0.01" value={jobForm.hourlyRate} onChange={(event) => updateJob('hourlyRate', event.target.value)} className={fieldClass} />
              </JobField>
              <JobField label="Travel" htmlFor="job-travel">
                <input id="job-travel" type="number" min="0" step="0.01" value={jobForm.travelPay} onChange={(event) => updateJob('travelPay', event.target.value)} className={fieldClass} />
              </JobField>
            </div>
          </JobSection>

          <JobSection title="Lines">
            <p className="text-sm leading-relaxed text-slate-600">
              Price is what you charge. Leave Paid blank until you buy the item.
              Add to line fills an empty line, or adds another line when this one already has a part.
              In stock is used from the shelf when you save. Out of stock and parts not in inventory can still be added.
            </p>
            <JobField label="Quick pick" htmlFor="job-quick-pick">
              <select
                id="job-quick-pick"
                value=""
                onChange={(event) => {
                  if (event.target.value) addQuickPick(event.target.value);
                }}
                className={fieldClass}
              >
                <option value="">Add a saved part</option>
                {[...quickPicks].sort(compareQuickPicks).map((pick) => {
                  const availability = quickPickAvailability(pick, inventoryItems, reservedForPick(pick, jobForm.chargeLines));
                  return (
                    <option key={pick._id} value={pick._id}>{`${quickPickLabel(pick)} · ${availability.cue}`}</option>
                  );
                })}
              </select>
            </JobField>
            {quickPickMessage ? <p className="text-sm font-medium text-slate-800">{quickPickMessage}</p> : null}
            <QuickPickList
              picks={quickPicks}
              onMove={reorderQuickPicks}
              itemClassName={(pick) => (
                quickPickLineNotice?.ok && quickPickLineNotice.id === pick._id
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-emerald-200 bg-white'
              )}
            >
              {(pick) => {
                const stock = quickPickStock(pick, inventoryItems);
                const availability = quickPickAvailability(pick, inventoryItems, reservedForPick(pick, jobForm.chargeLines));
                const cueClass = availability.cue === 'Out of stock'
                  ? 'font-semibold text-amber-700'
                  : availability.cue === 'Not in inventory'
                    ? 'font-semibold text-slate-500'
                    : 'font-semibold text-emerald-700';
                const justSaved = quickPickLineNotice?.ok && quickPickLineNotice.id === pick._id;
                return (
                  <>
                    <span className="min-w-0">
                      {quickPickLabel(pick)}
                      <span className={`ml-2 ${cueClass}`}>{availability.cue}</span>
                      {justSaved ? <span className="ml-2 font-semibold text-emerald-800">Saved</span> : null}
                    </span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="btn-row btn-row-primary"
                        aria-label={`Add ${String(pick.description || pick.sku || 'part').trim()} to the line`}
                        onClick={() => addQuickPick(pick._id)}
                      >
                        Add to line
                      </button>
                      {stock.status === 'missing' ? (
                        <button type="button" className="btn-row btn-row-accent" onClick={() => addPickToInventory(pick)}>
                          Add to inventory
                        </button>
                      ) : null}
                      <button type="button" className="btn-row btn-row-danger" onClick={() => removeQuickPick(pick)}>
                        Remove quick pick
                      </button>
                    </span>
                  </>
                );
              }}
            </QuickPickList>
            {jobForm.chargeLines.map((line, index) => (
              <div key={`charge-${index}`} className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-md">
                <JobField label="Line description" htmlFor={`charge-desc-${index}`}>
                  <input id={`charge-desc-${index}`} value={line.description} onChange={(event) => updateCharge(index, 'description', event.target.value)} className={fieldClass} />
                </JobField>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <JobField label="SKU" htmlFor={`charge-sku-${index}`}>
                    <input id={`charge-sku-${index}`} value={line.sku || ''} onChange={(event) => updateCharge(index, 'sku', event.target.value)} className={fieldClass} />
                  </JobField>
                  <JobField label="Line quantity" htmlFor={`charge-qty-${index}`}>
                    <input id={`charge-qty-${index}`} type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateCharge(index, 'quantity', event.target.value)} className={fieldClass} />
                  </JobField>
                  <JobField label="Price" htmlFor={`charge-price-${index}`}>
                    <input id={`charge-price-${index}`} type="number" min="0" step="0.01" value={line.price} onChange={(event) => updateCharge(index, 'price', event.target.value)} className={fieldClass} />
                  </JobField>
                  <JobField label="Line paid" htmlFor={`charge-paid-${index}`}>
                    <input id={`charge-paid-${index}`} type="number" min="0" step="0.01" value={line.paid ?? ''} onChange={(event) => updateCharge(index, 'paid', event.target.value)} className={fieldClass} />
                  </JobField>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <JobField label="Inventory" htmlFor={`charge-inventory-${index}`}>
                    <select
                      id={`charge-inventory-${index}`}
                      value={line.inventoryDisposition || ''}
                      onChange={(event) => updateCharge(index, 'inventoryDisposition', event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Not in inventory</option>
                      <option value="stock">Keep in inventory</option>
                      <option value="used">Use on this job</option>
                      <option value="draw">Use stock on hand</option>
                    </select>
                  </JobField>
                  {line.inventoryDisposition === 'stock' || line.inventoryDisposition === 'used' ? (
                    <JobField label="Supplier" htmlFor={`charge-supplier-${index}`}>
                      <select
                        id={`charge-supplier-${index}`}
                        value={line.supplierId || ''}
                        onChange={(event) => updateCharge(index, 'supplierId', event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Choose a supplier</option>
                        {lineSuppliers.map((supplier) => (
                          <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
                        ))}
                      </select>
                    </JobField>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {quickPickLineNotice?.index === index ? (
                    <p
                      role="status"
                      className={quickPickLineNotice.ok
                        ? 'mr-auto rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800'
                        : 'mr-auto text-sm font-semibold text-red-700'}
                    >
                      {quickPickLineNotice.text}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="btn-row btn-row-secondary"
                    onClick={() => saveLineToQuickPick(line, index)}
                  >
                    Save to Quick Pick
                  </button>
                  <button
                    type="button"
                    className="btn-row btn-row-danger"
                    onClick={() => setJobForm((prev) => {
                      const next = prev.chargeLines.filter((_, lineIndex) => lineIndex !== index);
                      return { ...prev, chargeLines: next.length ? next : [emptyLine()] };
                    })}
                  >
                    Remove line
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setJobForm((prev) => ({ ...prev, chargeLines: [...prev.chargeLines, emptyLine()] }))}
            >
              Add line
            </button>
          </JobSection>

          <JobSection title="Payment">
            <div className="grid gap-3 md:grid-cols-2">
              <JobField label="Paid amount" htmlFor="job-paid">
                <input id="job-paid" type="number" min="0" step="0.01" value={jobForm.paidAmount} onChange={(event) => updateJob('paidAmount', event.target.value)} className={fieldClass} />
              </JobField>
              <JobField label="Paid date" htmlFor="job-paid-date">
                <input id="job-paid-date" type="date" value={jobForm.paidDate} onChange={(event) => updateJob('paidDate', event.target.value)} className={fieldClass} />
              </JobField>
            </div>
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-700">
              Labor {money(liveTotals.laborPay)} · Lines {money(liveTotals.linesTotal)} · Cost {money(liveTotals.lineCost)} · Amount due {money(liveTotals.amountDue)}
              {liveVariance == null ? ' · Not reconciled' : ` · Variance ${signedMoney(liveVariance)}`}
            </p>
          </JobSection>
          <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
            <button type="submit" className="btn-primary">{editingJobId ? 'Save job' : 'Add job'}</button>
            {editingJobId ? (
              <button type="button" className="btn-secondary" onClick={resetJob}>Cancel</button>
            ) : null}
          </div>
        </form>
        </SectionToggle>
      </SectionToggle>

      <SectionToggle
        title="Bids"
        actions={<button type="button" className="btn-secondary" onClick={openNewBid}>Add bid</button>}
      >
        {bids.length === 0 ? (
          <p className="text-slate-600">No bids yet. A bid can be declined without becoming a job.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {bids.map((bid) => {
              const importedJob = jobs.find((job) => job.bidId && String(job.bidId) === String(bid._id));
              return (
              <article key={bid._id} data-testid={`bid-row-${bid._id}`} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h3 className={`font-semibold ${importedJob ? 'text-green-700' : ''}`}>
                      {bid.quoteNumber ? `${bid.quoteNumber} · ${bid.name}` : bid.name}
                    </h3>
                    {importedJob ? (
                      <p className="text-sm text-green-700">On job {formatJobLabel(importedJob)}</p>
                    ) : null}
                    <p className="text-sm text-slate-600 capitalize">{bid.status}</p>
                    {bid.description ? <p className="text-sm text-slate-600">{bid.description}</p> : null}
                    {(bid.lines || []).length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {bid.lines.map((line, index) => (
                          <li key={`${bid._id}-line-${index}`} className="rounded-2xl border border-emerald-200 bg-white px-3 py-2 shadow-md">
                            {line.description || 'Line'} · Qty {line.quantity ?? 0} · Est {money(line.estimate)} · {money(bidLineAmount(line))}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm text-slate-600">Quoted</p>
                    <p className="text-lg font-semibold">{money(quotedAmountForBid(bid))}</p>
                    <p className="text-sm text-slate-600">Lines {money(bid.linesTotal ?? bidLinesTotal(bid.lines))}</p>
                    <div className="flex flex-wrap gap-2 sm:justify-end mt-2">
                      <button type="button" className="btn-row btn-row-primary" onClick={() => generateCustomerBid(bid)}>Generate bid</button>
                      <button type="button" className="btn-row btn-row-secondary" onClick={() => importBidIntoJob(bid)}>Import into job</button>
                      <button type="button" className="btn-row btn-row-secondary" onClick={() => editBid(bid)}>Edit</button>
                      <button type="button" className="btn-row btn-row-danger" onClick={() => deleteBid(bid)}>Delete</button>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 sm:justify-end mt-2">
                      <input
                        type="checkbox"
                        checked={Boolean(monitoringByBid[bid._id])}
                        onChange={(event) => setMonitoringByBid((prev) => ({
                          ...prev,
                          [bid._id]: event.target.checked,
                        }))}
                      />
                      Include monitoring agreement
                    </label>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}
        {bidEditor ? (
          <SectionToggle
            nested
            title={bidEditor === 'new' ? 'New bid' : 'Edit bid'}
            open
            onOpenChange={(next) => { if (!next) setBidEditor(null); }}
          >
          <form aria-label="Bid" onSubmit={saveBid}>
            {bidEditor !== 'new' ? (
              <p className="text-sm text-slate-600 mb-3">
                {bids.find((bid) => bid._id === bidEditor)?.quoteNumber}
              </p>
            ) : null}
            {bidError ? <p role="alert" className="text-red-700 mb-3">{bidError}</p> : null}
            <AlignedFormGrid className="mb-3">
              <AlignedFormField label="Bid name" htmlFor="bid-name" className="col-span-12 md:col-span-5">
                <input id="bid-name" value={bidForm.name} onChange={(event) => setBidForm({ ...bidForm, name: event.target.value })} className={compactFieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Bid status" htmlFor="bid-status" className="col-span-12 md:col-span-3">
                <select id="bid-status" value={bidForm.status} onChange={(event) => setBidForm({ ...bidForm, status: event.target.value })} className={compactFieldClass}>
                  {BID_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </AlignedFormField>
              <AlignedFormField label="Quoted amount" htmlFor="bid-quoted" className="col-span-12 md:col-span-2">
                <input
                  id="bid-quoted"
                  type="number"
                  readOnly
                  value={bidLinesTotal(bidForm.lines)}
                  className={`${compactFieldClass} bg-slate-50`}
                />
              </AlignedFormField>
              <AlignedFormField label="Description" htmlFor="bid-description" className="col-span-12">
                <input id="bid-description" value={bidForm.description} onChange={(event) => setBidForm({ ...bidForm, description: event.target.value })} className={compactFieldClass} />
              </AlignedFormField>
            </AlignedFormGrid>
            <p className="mb-2 text-sm leading-relaxed text-slate-600">
              Add to line fills an empty bid line, or adds another line when this one already has a part.
              The price on the quick pick becomes the estimate.
            </p>
            <AlignedFormField label="Bid quick pick" htmlFor="bid-quick-pick" className="mb-3">
              <select
                id="bid-quick-pick"
                value=""
                onChange={(event) => {
                  if (event.target.value) addQuickPickToBid(event.target.value);
                }}
                className={compactFieldClass}
              >
                <option value="">Add a saved part</option>
                {[...quickPicks].sort(compareQuickPicks).map((pick) => (
                  <option key={pick._id} value={pick._id}>{quickPickLabel(pick)}</option>
                ))}
              </select>
            </AlignedFormField>
            <QuickPickList
              picks={quickPicks}
              onMove={reorderQuickPicks}
              label="Bid quick picks"
              className="mb-3"
            >
              {(pick) => (
                <>
                  <span className="min-w-0">{quickPickLabel(pick)}</span>
                  <button
                    type="button"
                    className="btn-row btn-row-primary shrink-0"
                    aria-label={`Add ${String(pick.description || pick.sku || 'part').trim()} to the bid line`}
                    onClick={() => addQuickPickToBid(pick._id)}
                  >
                    Add to line
                  </button>
                </>
              )}
            </QuickPickList>
            {bidForm.lines.map((line, index) => (
              <AlignedFormGrid key={`bid-line-${index}`} className="mb-2">
                <AlignedFormField label="Bid line description" htmlFor={`bid-line-desc-${index}`} className="col-span-12 md:col-span-6">
                  <input id={`bid-line-desc-${index}`} value={line.description} onChange={(event) => updateBidLine(index, 'description', event.target.value)} className={compactFieldClass} />
                </AlignedFormField>
                <AlignedFormField label="Bid quantity" htmlFor={`bid-line-qty-${index}`} className="col-span-6 md:col-span-2">
                  <input id={`bid-line-qty-${index}`} type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateBidLine(index, 'quantity', event.target.value)} className={compactFieldClass} />
                </AlignedFormField>
                <AlignedFormField label="Estimate" htmlFor={`bid-line-est-${index}`} className="col-span-6 md:col-span-2">
                  <input id={`bid-line-est-${index}`} type="number" min="0" step="0.01" value={line.estimate} onChange={(event) => updateBidLine(index, 'estimate', event.target.value)} className={compactFieldClass} />
                </AlignedFormField>
                <div className="col-span-12 flex items-end justify-end md:col-span-2">
                  <button type="button" className="btn-row btn-row-danger" onClick={() => removeBidLine(index)}>
                    Remove bid line
                  </button>
                </div>
              </AlignedFormGrid>
            ))}
            <button
              type="button"
              className="btn-secondary mb-3"
              onClick={() => setBidForm((prev) => ({ ...prev, lines: [...prev.lines, emptyBidLine()] }))}
            >
              Add bid line
            </button>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Save bid</button>
              <button type="button" className="btn-secondary" onClick={() => setBidEditor(null)}>Cancel</button>
            </div>
          </form>
          </SectionToggle>
        ) : null}
      </SectionToggle>
    </div>
  );
}
