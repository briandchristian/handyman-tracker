/**
 * Customer directory. Contact edits and job add/edit/remove live on the customer page.
 * A customer created from the public Request a Bid page keeps that source on the card.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';
import { CUSTOMER_KINDS, customerKindLabel } from '../constants/customerPeople';
import SectionToggle from './SectionToggle';

function jobCountLabel(count) {
  if (!count) return 'No jobs';
  return count === 1 ? '1 job' : `${count} jobs`;
}

/** Same check as job removal: materials, a bid worksheet, payments, or a bid amount. */
function projectHasRecordedWork(project) {
  return (project?.materials?.length || 0) > 0
    || (project?.bidMaterials?.length || 0) > 0
    || (project?.payments?.length || 0) > 0
    || Number(project?.paidToDate) > 0
    || Number(project?.bidAmount) > 0;
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    accountNumber: '',
    kind: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/customers`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    setCustomers(res.data);
  };

  const addCustomer = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/customers`, newCustomer, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setNewCustomer({ name: '', email: '', phone: '', address: '', accountNumber: '', kind: '' });
      fetchCustomers();
    } catch (err) {
      console.error('Error adding customer:', err);
      alert('Failed to add customer: ' + (err.response?.data?.msg || err.message));
    }
  };

  const deleteCustomer = async (customer) => {
    const label = customer.name || 'this customer';
    const hasRecordedWork = (customer.projects || []).some(projectHasRecordedWork);
    const message = hasRecordedWork
      ? `This customer has a job with materials, a bid worksheet, payments, or a bid amount. Remove ${label} anyway?`
      : `Remove ${label}?`;
    if (!window.confirm(message)) return;
    await axios.delete(`${API_BASE_URL}/api/customers/${customer._id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchCustomers();
  };

  const formatPhoneNumber = (value) => {
    const phoneNumber = value.replace(/\D/g, '');
    if (phoneNumber.length <= 3) return phoneNumber;
    if (phoneNumber.length <= 6) return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const query = searchQuery.trim().toLowerCase();
  const visibleCustomers = customers.filter((customer) => {
    if (!query) return true;
    return [customer.name, customer.email, customer.phone, customer.accountNumber]
      .concat((customer.people || []).flatMap((person) => [person.name, person.role, person.email, person.phone]))
      .some((value) => String(value || '').toLowerCase().includes(query));
  });

  return (
    <div className="p-4 md:p-6 text-black min-h-screen flex flex-col max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl text-black">Customers</h1>
      </div>

      <div className="flex-1 overflow-auto mb-6">
        <SectionToggle title="Customer Management">
            <SectionToggle title="Add New Customer" defaultOpen={false} nested>
                <AlignedFormGrid testId="add-customer-grid">
                  <AlignedFormField label="Name" htmlFor="new-customer-name" className="col-span-12 md:col-span-3">
                    <input
                      id="new-customer-name"
                      placeholder="Name"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Email" htmlFor="new-customer-email" className="col-span-12 md:col-span-3">
                    <input
                      id="new-customer-email"
                      placeholder="Email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Phone" htmlFor="new-customer-phone" className="col-span-12 sm:col-span-6 md:col-span-2">
                    <input
                      id="new-customer-phone"
                      placeholder="Phone (XXX-XXX-XXXX)"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: formatPhoneNumber(e.target.value) })}
                      maxLength="12"
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Address" htmlFor="new-customer-address" className="col-span-12 sm:col-span-6 md:col-span-2">
                    <input
                      id="new-customer-address"
                      placeholder="Address"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Account number" htmlFor="new-customer-account" className="col-span-12 sm:col-span-6 md:col-span-2">
                    <input
                      id="new-customer-account"
                      placeholder="Auto or CS number"
                      value={newCustomer.accountNumber}
                      onChange={(e) => setNewCustomer({ ...newCustomer, accountNumber: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Customer type" htmlFor="new-customer-kind" className="col-span-12 sm:col-span-6 md:col-span-2">
                    <select
                      id="new-customer-kind"
                      value={newCustomer.kind}
                      onChange={(e) => setNewCustomer({ ...newCustomer, kind: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    >
                      <option value="">Choose</option>
                      {CUSTOMER_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>{kind.label}</option>
                      ))}
                    </select>
                  </AlignedFormField>
                  <div className="col-span-12 md:col-span-2">
                    <button onClick={addCustomer} className="w-full bg-green-500 text-white px-4 py-3 md:py-2 rounded hover:bg-green-600 text-base md:text-sm font-medium">
                      Add Customer
                    </button>
                  </div>
                </AlignedFormGrid>
            </SectionToggle>

            <div className="mb-3 mt-4">
              <label className="block text-gray-700 mb-2 font-medium text-base md:text-sm" htmlFor="customer-directory-search">
                Find a customer
              </label>
              <input
                id="customer-directory-search"
                type="search"
                placeholder="Search name, email, phone, or account"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-4 md:p-3 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
              />
            </div>

            <SectionToggle title="Customer List" nested>
            <div className="space-y-3">
              {visibleCustomers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {query ? 'No customers match this search' : 'No customers yet'}
                </p>
              ) : visibleCustomers.map((cust) => (
                <article key={cust._id} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-lg font-semibold">
                        <Link to={`/customers/${cust._id}`} className="text-emerald-700 underline">{cust.name}</Link>
                      </h3>
                      <p className="text-sm text-black">Account: {cust.accountNumber || '—'}</p>
                      {customerKindLabel(cust.kind) ? (
                        <p className="text-sm font-medium text-slate-700">{customerKindLabel(cust.kind)}</p>
                      ) : null}
                      {cust.kind === 'business' && (cust.people || []).length > 0 ? (
                        <p className="text-sm text-slate-600">
                          {(cust.people || []).length === 1 ? '1 person' : `${cust.people.length} people`}
                        </p>
                      ) : null}
                      <p className="text-sm text-black">{cust.email}</p>
                      <p className="text-sm text-black">{cust.phone}</p>
                      <p className="text-sm text-black">{cust.address || '—'}</p>
                      {cust.obtainedVia === 'hero-bid' && (
                        <p className="text-sm font-medium text-emerald-800">Obtained from the Request a Bid page</p>
                      )}
                      <p className="text-sm text-slate-600">{jobCountLabel(cust.projects?.length || 0)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link to={`/customers/${cust._id}`} className="btn-row btn-row-secondary">Open</Link>
                      <button onClick={() => deleteCustomer(cust)} className="btn-row btn-row-danger">Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            </SectionToggle>
        </SectionToggle>
      </div>
    </div>
  );
}
