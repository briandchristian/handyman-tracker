/**
 * Jobs, bids, and projects on one customer.
 * A job is a single ticket with charge lines. Amount due is computed on save.
 * A bid is a quote and does not open a job. A project only groups tickets.
 */
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { PROJECT_WORK_TYPES, DEFAULT_PROJECT_WORK_TYPE } from '../constants/projectWorkTypes';
import {
  BID_STATUSES,
  DEFAULT_BID_STATUS,
  DEFAULT_SERVICE_JOB_STATUS,
  SERVICE_JOB_STATUSES,
  computeServiceJobTotals,
  planRollup,
  serviceJobMatchesStatus,
} from '../constants/customerWork';
import { formatJobLabel } from '../constants/jobIdentity';
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

const emptyChargeLine = () => ({ description: '', quantity: '', price: '' });
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
    notes: '',
    paidAmount: '',
    paidDate: '',
    planId: '',
    bidId: '',
    chargeLines: [emptyChargeLine()],
  };
}

function jobFromRecord(job) {
  const lines = Array.isArray(job.chargeLines) && job.chargeLines.length > 0
    ? job.chargeLines.map((line) => ({
      description: line.description || '',
      quantity: line.quantity ?? '',
      price: line.price ?? '',
    }))
    : [emptyChargeLine()];
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
    notes: job.notes || '',
    paidAmount: job.paidAmount ?? '',
    paidDate: toDateInput(job.paidDate),
    planId: job.planId || '',
    bidId: job.bidId || '',
    chargeLines: lines,
  };
}

const emptyBid = () => ({
  name: '',
  description: '',
  status: DEFAULT_BID_STATUS,
  quotedAmount: '',
  notes: '',
  planId: '',
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
    planId: bid.planId || '',
    lines,
  };
}

const emptyPlan = () => ({ name: '', description: '', targetDate: '' });

function labelFor(records, id, fallback) {
  if (!id) return '';
  const match = (records || []).find((record) => String(record._id) === String(id));
  return match ? fallback(match) : '';
}

const fieldClass = 'w-full p-2 border border-slate-300 rounded bg-white text-slate-900';

export default function CustomerWork({ customer, onSaved }) {
  const { pathname } = useLocation();
  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
  const jobs = customer.serviceJobs || [];
  const bids = customer.bids || [];
  const plans = customer.plans || [];

  const [statusFilter, setStatusFilter] = useState('');
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [jobForm, setJobForm] = useState(() => emptyJob(customer));
  const [editingJobId, setEditingJobId] = useState(null);
  const [jobError, setJobError] = useState('');

  const [bidEditor, setBidEditor] = useState(() => (
    sectionIsOpen(sectionToggleKey(pathname, 'New bid')) ? 'new' : null
  ));
  const [bidForm, setBidForm] = useState(emptyBid);
  const [bidError, setBidError] = useState('');

  const [planEditor, setPlanEditor] = useState(() => (
    sectionIsOpen(sectionToggleKey(pathname, 'New project')) ? 'new' : null
  ));
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [planError, setPlanError] = useState('');

  const visibleJobs = useMemo(
    () => jobs.filter((job) => serviceJobMatchesStatus(job, statusFilter)),
    [jobs, statusFilter]
  );

  const liveTotals = useMemo(() => computeServiceJobTotals(jobForm), [jobForm]);
  const liveVariance = jobForm.paidAmount === '' || jobForm.paidAmount == null
    ? null
    : Math.round(((Number(jobForm.paidAmount) || 0) - liveTotals.amountDue) * 100) / 100;

  const updateJob = (field, value) => setJobForm((prev) => ({ ...prev, [field]: value }));
  const updateCharge = (index, field, value) => {
    setJobForm((prev) => ({
      ...prev,
      chargeLines: prev.chargeLines.map((line, lineIndex) => (
        lineIndex === index ? { ...line, [field]: value } : line
      )),
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
    const payload = { ...jobForm, paidAmount: jobForm.paidAmount === '' ? null : jobForm.paidAmount };
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
      quotedAmount: bidForm.quotedAmount === '' ? null : bidForm.quotedAmount,
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

  const openNewPlan = () => {
    setPlanEditor('new');
    setPlanForm(emptyPlan());
    setPlanError('');
  };

  const editPlan = (plan) => {
    setPlanEditor(plan._id);
    setPlanForm({
      name: plan.name || '',
      description: plan.description || '',
      targetDate: toDateInput(plan.targetDate),
    });
    setPlanError('');
  };

  const savePlan = async (event) => {
    event.preventDefault();
    setPlanError('');
    try {
      if (planEditor && planEditor !== 'new') {
        await axios.put(`${API_BASE_URL}/api/customers/${customer._id}/plans/${planEditor}`, planForm, auth);
      } else {
        await axios.post(`${API_BASE_URL}/api/customers/${customer._id}/plans`, planForm, auth);
      }
      setPlanEditor(null);
      setPlanForm(emptyPlan());
      await onSaved();
    } catch (err) {
      setPlanError(err.response?.data?.msg || 'Failed to save project');
    }
  };

  const deletePlan = async (plan) => {
    if (!window.confirm(`Delete project ${plan.name}? Jobs on it stay as their own tickets.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/customers/${customer._id}/plans/${plan._id}`, auth);
      if (planEditor === plan._id) setPlanEditor(null);
      await onSaved();
    } catch (err) {
      setPlanError(err.response?.data?.msg || 'Failed to delete project');
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Jobs are single tickets with line items. Bids are quotes and stay separate.
        A project groups tickets when the work needs a plan.
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
              const projectName = labelFor(plans, job.planId, (plan) => plan.name);
              const bidLabel = labelFor(bids, job.bidId, (bid) => bid.quoteNumber || bid.name);
              return (
                <article key={job._id} data-testid={`job-ticket-${job._id}`} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{formatJobLabel(job)}</h3>
                      <p className="text-sm text-slate-600 capitalize">{job.workType} · {job.status}</p>
                      {job.siteName ? <p className="text-sm">{job.siteName}</p> : null}
                      {projectName ? <p className="text-sm text-slate-600">Project: {projectName}</p> : null}
                      {bidLabel ? <p className="text-sm text-slate-600">Related bid: {bidLabel}</p> : null}
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
                        <button type="button" className="btn-row btn-row-secondary" onClick={() => editJob(job)}>Edit</button>
                        <button type="button" className="btn-row btn-row-danger" onClick={() => deleteJob(job)}>Delete</button>
                      </div>
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
        <form aria-label="Job ticket" onSubmit={saveJob}>
          {editingJobId ? (
            <p className="text-sm text-slate-600 mb-3">
              {jobs.find((job) => job._id === editingJobId)?.jobNumber}
            </p>
          ) : null}
          {jobError ? <p role="alert" className="text-red-700 mb-3">{jobError}</p> : null}
          <AlignedFormGrid className="mb-3">
            <AlignedFormField label="Job name" htmlFor="job-name" className="col-span-12 md:col-span-5">
              <input id="job-name" value={jobForm.name} onChange={(event) => updateJob('name', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Work type" htmlFor="job-work-type" className="col-span-12 md:col-span-4">
              <select id="job-work-type" value={jobForm.workType} onChange={(event) => updateJob('workType', event.target.value)} className={fieldClass}>
                {PROJECT_WORK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </AlignedFormField>
            <AlignedFormField label="Ticket status" htmlFor="job-status" className="col-span-12 md:col-span-2">
              <select id="job-status" value={jobForm.status} onChange={(event) => updateJob('status', event.target.value)} className={fieldClass}>
                {SERVICE_JOB_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </AlignedFormField>
            <AlignedFormField label="Site name" htmlFor="job-site" className="col-span-12 md:col-span-4">
              <input id="job-site" value={jobForm.siteName} onChange={(event) => updateJob('siteName', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Site address" htmlFor="job-address" className="col-span-12 md:col-span-5">
              <input id="job-address" value={jobForm.siteAddress} onChange={(event) => updateJob('siteAddress', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="City" htmlFor="job-city" className="col-span-12 md:col-span-3">
              <input id="job-city" value={jobForm.siteCity} onChange={(event) => updateJob('siteCity', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Scheduled date" htmlFor="job-scheduled" className="col-span-12 md:col-span-3">
              <input id="job-scheduled" type="date" value={jobForm.scheduledDate} onChange={(event) => updateJob('scheduledDate', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Completed date" htmlFor="job-completed" className="col-span-12 md:col-span-3">
              <input id="job-completed" type="date" value={jobForm.completedDate} onChange={(event) => updateJob('completedDate', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Hours worked" htmlFor="job-hours" className="col-span-12 md:col-span-2">
              <input id="job-hours" type="number" min="0" step="0.25" value={jobForm.hoursWorked} onChange={(event) => updateJob('hoursWorked', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Hourly rate" htmlFor="job-rate" className="col-span-12 md:col-span-2">
              <input id="job-rate" type="number" min="0" step="0.01" value={jobForm.hourlyRate} onChange={(event) => updateJob('hourlyRate', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Travel" htmlFor="job-travel" className="col-span-12 md:col-span-2">
              <input id="job-travel" type="number" min="0" step="0.01" value={jobForm.travelPay} onChange={(event) => updateJob('travelPay', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Project" htmlFor="job-plan" className="col-span-12 md:col-span-6">
              <select id="job-plan" value={jobForm.planId} onChange={(event) => updateJob('planId', event.target.value)} className={fieldClass}>
                <option value="">No project</option>
                {plans.map((plan) => (
                  <option key={plan._id} value={plan._id}>{plan.planNumber ? `${plan.planNumber} · ${plan.name}` : plan.name}</option>
                ))}
              </select>
            </AlignedFormField>
            <AlignedFormField label="Related bid" htmlFor="job-bid" className="col-span-12 md:col-span-6">
              <select id="job-bid" value={jobForm.bidId} onChange={(event) => updateJob('bidId', event.target.value)} className={fieldClass}>
                <option value="">No related bid</option>
                {bids.map((bid) => (
                  <option key={bid._id} value={bid._id}>{bid.quoteNumber ? `${bid.quoteNumber} · ${bid.name}` : bid.name}</option>
                ))}
              </select>
            </AlignedFormField>
          </AlignedFormGrid>

          <h4 className="font-medium mb-2">Charge lines</h4>
          {jobForm.chargeLines.map((line, index) => (
            <AlignedFormGrid key={`charge-${index}`} className="mb-2">
              <AlignedFormField label="Charge description" htmlFor={`charge-desc-${index}`} className="col-span-12 md:col-span-6">
                <input id={`charge-desc-${index}`} value={line.description} onChange={(event) => updateCharge(index, 'description', event.target.value)} className={fieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Charge quantity" htmlFor={`charge-qty-${index}`} className="col-span-6 md:col-span-2">
                <input id={`charge-qty-${index}`} type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateCharge(index, 'quantity', event.target.value)} className={fieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Price" htmlFor={`charge-price-${index}`} className="col-span-6 md:col-span-2">
                <input id={`charge-price-${index}`} type="number" min="0" step="0.01" value={line.price} onChange={(event) => updateCharge(index, 'price', event.target.value)} className={fieldClass} />
              </AlignedFormField>
              <div className="col-span-12 md:col-span-2">
                <button
                  type="button"
                  className="btn-row btn-row-danger"
                  onClick={() => setJobForm((prev) => {
                    const next = prev.chargeLines.filter((_, lineIndex) => lineIndex !== index);
                    return { ...prev, chargeLines: next.length ? next : [emptyChargeLine()] };
                  })}
                >
                  Remove line
                </button>
              </div>
            </AlignedFormGrid>
          ))}
          <button
            type="button"
            className="btn-secondary mb-4"
            onClick={() => setJobForm((prev) => ({ ...prev, chargeLines: [...prev.chargeLines, emptyChargeLine()] }))}
          >
            Add line
          </button>

          <AlignedFormGrid className="mb-3">
            <AlignedFormField label="Paid amount" htmlFor="job-paid" className="col-span-12 md:col-span-3">
              <input id="job-paid" type="number" min="0" step="0.01" value={jobForm.paidAmount} onChange={(event) => updateJob('paidAmount', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Paid date" htmlFor="job-paid-date" className="col-span-12 md:col-span-3">
              <input id="job-paid-date" type="date" value={jobForm.paidDate} onChange={(event) => updateJob('paidDate', event.target.value)} className={fieldClass} />
            </AlignedFormField>
            <AlignedFormField label="Notes" htmlFor="job-notes" className="col-span-12 md:col-span-6">
              <input id="job-notes" value={jobForm.notes} onChange={(event) => updateJob('notes', event.target.value)} className={fieldClass} />
            </AlignedFormField>
          </AlignedFormGrid>
          <p className="text-sm text-slate-700 mb-3">
            Labor {money(liveTotals.laborPay)} · Lines {money(liveTotals.linesTotal)} · Amount due {money(liveTotals.amountDue)}
            {liveVariance == null ? ' · Not reconciled' : ` · Variance ${signedMoney(liveVariance)}`}
          </p>
          <div className="flex gap-2">
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
            {bids.map((bid) => (
              <article key={bid._id} data-testid={`bid-row-${bid._id}`} className="border border-slate-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{bid.quoteNumber ? `${bid.quoteNumber} · ${bid.name}` : bid.name}</h3>
                    <p className="text-sm text-slate-600 capitalize">{bid.status}</p>
                    {labelFor(plans, bid.planId, (plan) => plan.name)
                      ? <p className="text-sm text-slate-600">Project: {labelFor(plans, bid.planId, (plan) => plan.name)}</p>
                      : null}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm text-slate-600">Quoted</p>
                    <p className="text-lg font-semibold">{money(bid.quotedAmount)}</p>
                    <div className="flex gap-2 sm:justify-end mt-2">
                      <button type="button" className="btn-row btn-row-secondary" onClick={() => editBid(bid)}>Edit</button>
                      <button type="button" className="btn-row btn-row-danger" onClick={() => deleteBid(bid)}>Delete</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
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
                <input id="bid-name" value={bidForm.name} onChange={(event) => setBidForm({ ...bidForm, name: event.target.value })} className={fieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Bid status" htmlFor="bid-status" className="col-span-12 md:col-span-3">
                <select id="bid-status" value={bidForm.status} onChange={(event) => setBidForm({ ...bidForm, status: event.target.value })} className={fieldClass}>
                  {BID_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </AlignedFormField>
              <AlignedFormField label="Quoted amount" htmlFor="bid-quoted" className="col-span-12 md:col-span-2">
                <input id="bid-quoted" type="number" min="0" step="0.01" value={bidForm.quotedAmount} onChange={(event) => setBidForm({ ...bidForm, quotedAmount: event.target.value })} className={fieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Description" htmlFor="bid-description" className="col-span-12 md:col-span-8">
                <input id="bid-description" value={bidForm.description} onChange={(event) => setBidForm({ ...bidForm, description: event.target.value })} className={fieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Project" htmlFor="bid-plan" className="col-span-12 md:col-span-4">
                <select id="bid-plan" value={bidForm.planId} onChange={(event) => setBidForm({ ...bidForm, planId: event.target.value })} className={fieldClass}>
                  <option value="">No project</option>
                  {plans.map((plan) => (
                    <option key={plan._id} value={plan._id}>{plan.planNumber ? `${plan.planNumber} · ${plan.name}` : plan.name}</option>
                  ))}
                </select>
              </AlignedFormField>
            </AlignedFormGrid>
            {bidForm.lines.map((line, index) => (
              <AlignedFormGrid key={`bid-line-${index}`} className="mb-2">
                <AlignedFormField label="Bid line description" htmlFor={`bid-line-desc-${index}`} className="col-span-12 md:col-span-6">
                  <input id={`bid-line-desc-${index}`} value={line.description} onChange={(event) => updateBidLine(index, 'description', event.target.value)} className={fieldClass} />
                </AlignedFormField>
                <AlignedFormField label="Bid quantity" htmlFor={`bid-line-qty-${index}`} className="col-span-6 md:col-span-2">
                  <input id={`bid-line-qty-${index}`} type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateBidLine(index, 'quantity', event.target.value)} className={fieldClass} />
                </AlignedFormField>
                <AlignedFormField label="Estimate" htmlFor={`bid-line-est-${index}`} className="col-span-6 md:col-span-2">
                  <input id={`bid-line-est-${index}`} type="number" min="0" step="0.01" value={line.estimate} onChange={(event) => updateBidLine(index, 'estimate', event.target.value)} className={fieldClass} />
                </AlignedFormField>
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

      <SectionToggle
        title="Projects"
        actions={<button type="button" className="btn-secondary" onClick={openNewPlan}>Add project</button>}
      >
        {plans.length === 0 ? (
          <p className="text-slate-600">No projects. A single job does not need one.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {plans.map((plan) => {
              const rollup = planRollup(plan._id, { jobs, bids });
              return (
                <article key={plan._id} data-testid={`plan-row-${plan._id}`} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{plan.planNumber ? `${plan.planNumber} · ${plan.name}` : plan.name}</h3>
                      {plan.description ? <p className="text-sm text-slate-600">{plan.description}</p> : null}
                      <p className="text-sm text-slate-600">{rollup.jobCount} job tickets · {rollup.bidCount} bids</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-sm">Quoted {money(rollup.quoted)}</p>
                      <p className="text-sm">Due {money(rollup.amountDue)}</p>
                      <p className="text-sm">Paid {money(rollup.paid)}</p>
                      <div className="flex gap-2 sm:justify-end mt-2">
                        <button type="button" className="btn-row btn-row-secondary" onClick={() => editPlan(plan)}>Edit</button>
                        <button type="button" className="btn-row btn-row-danger" onClick={() => deletePlan(plan)}>Delete</button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {planEditor ? (
          <SectionToggle
            nested
            title={planEditor === 'new' ? 'New project' : 'Edit project'}
            open
            onOpenChange={(next) => { if (!next) setPlanEditor(null); }}
          >
          <form aria-label="Project" onSubmit={savePlan}>
            {planEditor !== 'new' ? (
              <p className="text-sm text-slate-600 mb-3">
                {plans.find((plan) => plan._id === planEditor)?.planNumber}
              </p>
            ) : null}
            {planError ? <p role="alert" className="text-red-700 mb-3">{planError}</p> : null}
            <AlignedFormGrid className="mb-3">
              <AlignedFormField label="Project name" htmlFor="plan-name" className="col-span-12 md:col-span-4">
                <input id="plan-name" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} className={fieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Project description" htmlFor="plan-description" className="col-span-12 md:col-span-5">
                <input id="plan-description" value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} className={fieldClass} />
              </AlignedFormField>
              <AlignedFormField label="Target date" htmlFor="plan-target" className="col-span-12 md:col-span-3">
                <input id="plan-target" type="date" value={planForm.targetDate} onChange={(event) => setPlanForm({ ...planForm, targetDate: event.target.value })} className={fieldClass} />
              </AlignedFormField>
            </AlignedFormGrid>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Save project</button>
              <button type="button" className="btn-secondary" onClick={() => setPlanEditor(null)}>Cancel</button>
            </div>
          </form>
          </SectionToggle>
        ) : null}
      </SectionToggle>
    </div>
  );
}
