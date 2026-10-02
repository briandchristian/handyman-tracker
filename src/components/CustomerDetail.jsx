/**
 * Staff page for one customer.
 * Contact (name, email, phone, address, account) is edited here.
 * Jobs already on the customer are listed as rows that can be opened, edited, or removed.
 * New jobs are added on this page, so staff do not search for the customer again.
 * Customers created from the public Request a Bid page show that source here.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import {
  EQUIPMENT_CATEGORY_OPTIONS,
  emptyEquipmentCategories,
  normalizeEquipmentCategories,
} from '../constants/equipmentCategories';
import { PROJECT_WORK_TYPES, DEFAULT_PROJECT_WORK_TYPE, normalizeProjectWorkType } from '../constants/projectWorkTypes';
import { formatJobLabel } from '../constants/jobIdentity';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';

const emptyJobForm = () => ({
  name: '',
  description: '',
  jobNumber: '',
  equipmentCategories: emptyEquipmentCategories(),
  workType: DEFAULT_PROJECT_WORK_TYPE,
});

function formatPhoneNumber(value) {
  const phoneNumber = String(value || '').replace(/\D/g, '');
  if (phoneNumber.length <= 3) return phoneNumber;
  if (phoneNumber.length <= 6) return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
}

function jobHasRecordedWork(project) {
  return (project.materials?.length || 0) > 0
    || (project.bidMaterials?.length || 0) > 0
    || (project.payments?.length || 0) > 0
    || Number(project.paidToDate) > 0
    || Number(project.bidAmount) > 0;
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return '—';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [contact, setContact] = useState({ name: '', email: '', phone: '', address: '', accountNumber: '' });
  const [newJob, setNewJob] = useState(emptyJobForm);
  const [editingJobId, setEditingJobId] = useState(null);
  const [editJob, setEditJob] = useState(emptyJobForm);

  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

  const loadCustomer = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers/${customerId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setCustomer(res.data);
      setError('');
    } catch (err) {
      const message = err.response?.status === 404
        ? 'Customer not found'
        : (err.response?.data?.msg || 'Failed to load customer');
      setError(message);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const startEditContact = () => {
    setContact({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      accountNumber: customer.accountNumber || '',
    });
    setEditingContact(true);
  };

  const saveContact = async () => {
    if (!contact.name.trim()) {
      alert('Please enter a customer name');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}`, {
        name: contact.name.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        address: contact.address.trim(),
        accountNumber: contact.accountNumber.trim(),
      }, auth);
      setEditingContact(false);
      await loadCustomer();
    } catch (err) {
      alert('Failed to update customer: ' + (err.response?.data?.msg || err.message));
    }
  };

  const addJob = async () => {
    if (!newJob.name.trim()) {
      alert('Please provide a job name');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/customers/${customerId}/projects`, {
        name: newJob.name.trim(),
        description: newJob.description.trim(),
        jobNumber: newJob.jobNumber.trim(),
        status: 'Pending',
        equipmentCategories: { ...newJob.equipmentCategories },
        workType: newJob.workType || DEFAULT_PROJECT_WORK_TYPE,
      }, auth);
      setNewJob(emptyJobForm());
      await loadCustomer();
    } catch (err) {
      alert('Failed to add job: ' + (err.response?.data?.msg || err.message));
    }
  };

  const startEditJob = (project) => {
    setEditingJobId(project._id);
    setEditJob({
      name: project.name || '',
      description: project.description || '',
      jobNumber: project.jobNumber || '',
      equipmentCategories: normalizeEquipmentCategories(project.equipmentCategories),
      workType: normalizeProjectWorkType(project.workType),
    });
  };

  const saveJob = async (projectId) => {
    if (!editJob.name.trim()) {
      alert('Please enter a job name');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}`, {
        name: editJob.name.trim(),
        description: editJob.description.trim(),
        jobNumber: editJob.jobNumber.trim(),
        equipmentCategories: { ...editJob.equipmentCategories },
        workType: editJob.workType || DEFAULT_PROJECT_WORK_TYPE,
      }, auth);
      setEditingJobId(null);
      setEditJob(emptyJobForm());
      await loadCustomer();
    } catch (err) {
      alert('Failed to update job: ' + (err.response?.data?.msg || err.message));
    }
  };

  const removeJob = async (project) => {
    const label = formatJobLabel(project);
    const message = jobHasRecordedWork(project)
      ? `This job has materials, a bid worksheet, payments, or a bid amount. Remove ${label} anyway?`
      : `Remove ${label}?`;
    if (!window.confirm(message)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/customers/${customerId}/projects/${project._id}`, auth);
      if (editingJobId === project._id) setEditingJobId(null);
      await loadCustomer();
    } catch (err) {
      alert('Failed to remove job: ' + (err.response?.data?.msg || err.message));
    }
  };

  const equipmentFields = (form, setForm, idPrefix) => (
    <div className="col-span-12">
      <p className="block text-sm font-medium text-gray-700 mb-2">Equipment categories</p>
      <div className="flex flex-wrap gap-4">
        {EQUIPMENT_CATEGORY_OPTIONS.map(({ key, label }) => (
          <label key={key} htmlFor={`${idPrefix}-${key}`} className="flex items-center gap-2 cursor-pointer text-black text-sm">
            <input
              id={`${idPrefix}-${key}`}
              type="checkbox"
              checked={!!form.equipmentCategories[key]}
              onChange={(e) => setForm({
                ...form,
                equipmentCategories: { ...form.equipmentCategories, [key]: e.target.checked },
              })}
              className="rounded border-gray-300"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );

  const jobFields = (form, setForm, idPrefix) => (
    <AlignedFormGrid>
      <AlignedFormField label="Job name" htmlFor={`${idPrefix}-name`} className="col-span-12 md:col-span-4">
        <input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="field"
        />
      </AlignedFormField>
      <AlignedFormField label="Job number" htmlFor={`${idPrefix}-number`} className="col-span-12 md:col-span-3">
        <input
          id={`${idPrefix}-number`}
          value={form.jobNumber}
          onChange={(e) => setForm({ ...form, jobNumber: e.target.value })}
          className="field"
        />
      </AlignedFormField>
      <AlignedFormField label="Description" htmlFor={`${idPrefix}-description`} className="col-span-12 md:col-span-5">
        <input
          id={`${idPrefix}-description`}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="field"
        />
      </AlignedFormField>
      <AlignedFormField label="Work type" htmlFor={`${idPrefix}-work-type`} className="col-span-12 md:col-span-4">
        <select
          id={`${idPrefix}-work-type`}
          value={form.workType || DEFAULT_PROJECT_WORK_TYPE}
          onChange={(e) => setForm({ ...form, workType: e.target.value })}
          className="field"
        >
          {PROJECT_WORK_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </AlignedFormField>
      {equipmentFields(form, setForm, idPrefix)}
    </AlignedFormGrid>
  );

  if (loading) {
    return <div className="p-6 max-w-6xl mx-auto text-slate-900">Loading customer...</div>;
  }

  if (error || !customer) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-slate-900">
        <p className="mb-4">{error || 'Customer not found'}</p>
        <Link to="/customers" className="btn-staff">Customers</Link>
      </div>
    );
  }

  const jobs = customer.projects || [];

  return (
    <div className="p-4 md:p-6 text-slate-900 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <Link to="/customers" className="text-sm text-emerald-700 font-medium">Customers</Link>
          <h1 className="text-2xl md:text-3xl font-bold">{customer.name}</h1>
          <p className="text-slate-600">{customer.accountNumber || 'No account number'}</p>
          {customer.obtainedVia === 'hero-bid' && (
            <p className="text-sm font-medium text-emerald-800">Obtained from the Request a Bid page</p>
          )}
        </div>
      </div>

      <section className="card-surface p-4 md:p-6 mb-6" aria-label="Contact">
        <div className="flex justify-between items-center mb-4 gap-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          {!editingContact && (
            <button type="button" onClick={startEditContact} className="btn-secondary">Edit contact</button>
          )}
        </div>
        {editingContact ? (
          <div className="space-y-3">
            <AlignedFormGrid>
              <AlignedFormField label="Name" htmlFor="contact-name" className="col-span-12 md:col-span-4">
                <input id="contact-name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="field" />
              </AlignedFormField>
              <AlignedFormField label="Email" htmlFor="contact-email" className="col-span-12 md:col-span-4">
                <input id="contact-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="field" />
              </AlignedFormField>
              <AlignedFormField label="Phone" htmlFor="contact-phone" className="col-span-12 md:col-span-4">
                <input
                  id="contact-phone"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: formatPhoneNumber(e.target.value) })}
                  maxLength="12"
                  className="field"
                />
              </AlignedFormField>
              <AlignedFormField label="Address" htmlFor="contact-address" className="col-span-12 md:col-span-8">
                <input id="contact-address" value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} className="field" />
              </AlignedFormField>
              <AlignedFormField label="Account number" htmlFor="contact-account" className="col-span-12 md:col-span-4">
                <input id="contact-account" value={contact.accountNumber} onChange={(e) => setContact({ ...contact, accountNumber: e.target.value })} className="field" />
              </AlignedFormField>
            </AlignedFormGrid>
            <div className="flex gap-2">
              <button type="button" onClick={saveContact} className="btn-primary">Save contact</button>
              <button type="button" onClick={() => setEditingContact(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base">
            <div><dt className="text-slate-500">Email</dt><dd>{customer.email || '—'}</dd></div>
            <div><dt className="text-slate-500">Phone</dt><dd>{customer.phone || '—'}</dd></div>
            <div><dt className="text-slate-500">Address</dt><dd>{customer.address || '—'}</dd></div>
            <div><dt className="text-slate-500">Account</dt><dd>{customer.accountNumber || '—'}</dd></div>
          </dl>
        )}
      </section>

      <section className="card-surface p-4 md:p-6 mb-6" aria-label="Jobs">
        <h2 className="text-xl font-semibold mb-4">Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-slate-500 mb-2">No jobs yet. Add one below.</p>
        ) : (
          <div className="space-y-3 mb-2">
            {jobs.map((project) => (
              <article key={project._id} data-testid={`job-row-${project._id}`} className="border border-slate-200 rounded-xl p-4">
                {editingJobId === project._id ? (
                  <div className="space-y-3">
                    {jobFields(editJob, setEditJob, `edit-job-${project._id}`)}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveJob(project._id)} className="btn-row btn-row-primary">Save job</button>
                      <button type="button" onClick={() => setEditingJobId(null)} className="btn-row btn-row-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold break-words">{formatJobLabel(project)}</h3>
                      <p className="text-sm text-slate-600">
                        {project.status || 'Pending'}
                        {' · '}
                        Bid {money(project.bidAmount)}
                        {project.description ? ` · ${project.description}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link to={`/projects/${customer._id}/${project._id}`} className="btn-row btn-row-secondary">Open</Link>
                      <button type="button" onClick={() => startEditJob(project)} className="btn-row btn-row-secondary">Edit</button>
                      <button type="button" onClick={() => removeJob(project)} className="btn-row btn-row-danger">Remove</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card-surface p-4 md:p-6" aria-label="Add job">
        <h2 className="text-xl font-semibold mb-4">Add job</h2>
        {jobFields(newJob, setNewJob, 'new-job')}
        <button type="button" onClick={addJob} className="btn-primary mt-3">Add job</button>
      </section>
    </div>
  );
}
