/**
 * Staff page for one customer.
 * Contact is edited here. Jobs, bids, and projects are separate lists.
 * Older combined records stay reachable from Earlier job records.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { formatJobLabel } from '../constants/jobIdentity';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';
import CustomerWork from './CustomerWork';
import CustomerPeople from './CustomerPeople';
import { CUSTOMER_KINDS, customerKindLabel } from '../constants/customerPeople';
import SectionToggle from './SectionToggle';

function formatPhoneNumber(value) {
  const phoneNumber = String(value || '').replace(/\D/g, '');
  if (phoneNumber.length <= 3) return phoneNumber;
  if (phoneNumber.length <= 6) return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [contact, setContact] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    accountNumber: '',
    kind: '',
  });

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
      kind: customer.kind || '',
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
        kind: contact.kind,
      }, auth);
      setEditingContact(false);
      await loadCustomer();
    } catch (err) {
      alert('Failed to update customer: ' + (err.response?.data?.msg || err.message));
    }
  };

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

  const earlier = customer.projects || [];

  return (
    <div className="p-4 md:p-6 text-slate-900 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <Link to="/customers" className="text-sm text-emerald-700 font-medium">Customers</Link>
          <h1 className="text-2xl md:text-3xl font-bold">{customer.name}</h1>
          <p className="text-slate-600">{customer.accountNumber || 'No account number'}</p>
          <p className="text-sm font-medium text-slate-700">
            {customerKindLabel(customer.kind) || 'Choose business or private individual'}
          </p>
          {customer.obtainedVia === 'hero-bid' && (
            <p className="text-sm font-medium text-emerald-800">Obtained from the Request a Bid page</p>
          )}
        </div>
      </div>

      <SectionToggle
        title="Contact"
        className="mb-6"
        actions={!editingContact ? (
          <button type="button" onClick={startEditContact} className="btn-secondary">Edit contact</button>
        ) : null}
      >
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
              <AlignedFormField label="Customer type" htmlFor="contact-kind" className="col-span-12 md:col-span-4">
                <select id="contact-kind" value={contact.kind} onChange={(e) => setContact({ ...contact, kind: e.target.value })} className="field">
                  <option value="">Choose</option>
                  {CUSTOMER_KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>{kind.label}</option>
                  ))}
                </select>
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
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd>
                {customerKindLabel(customer.kind) || '—'}
                {customer.kind === 'individual' ? ' — a person and their home' : ''}
              </dd>
            </div>
          </dl>
        )}
      </SectionToggle>

      {customer.kind === 'business' && (
        <CustomerPeople customer={customer} onSaved={loadCustomer} />
      )}

      <CustomerWork customer={customer} onSaved={loadCustomer} />

      {earlier.length > 0 && (
        <SectionToggle title="Earlier job records" defaultOpen={false} className="mt-6">
          <p className="text-sm text-slate-600 mb-4">
            These are the previous combined pages. New work is a job ticket above.
          </p>
          <div className="space-y-3">
            {earlier.map((project) => (
              <article key={project._id} data-testid={`earlier-job-${project._id}`} className="border border-slate-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{formatJobLabel(project)}</h3>
                    <p className="text-sm text-slate-600">{project.status || 'Pending'}</p>
                  </div>
                  <Link to={`/projects/${customer._id}/${project._id}`} className="btn-row btn-row-secondary">Open</Link>
                </div>
              </article>
            ))}
          </div>
        </SectionToggle>
      )}
    </div>
  );
}
