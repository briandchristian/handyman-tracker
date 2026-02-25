/**
 * Phase 2: Customer-only page to view their info and edit personal profile only.
 * Profile (phone, address) is stored separately and does not change Customer Management.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';

export default function CustomerMyInfo() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [profile, setProfile] = useState({ phone: '', address: '' });
  const [editProfile, setEditProfile] = useState({ phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  // Request for Service / New Bid form (same fields as Request a Bid; name/email prefilled)
  const [newBidPhone, setNewBidPhone] = useState('');
  const [newBidAddress, setNewBidAddress] = useState('');
  const [newBidProjectName, setNewBidProjectName] = useState('');
  const [newBidProjectDescription, setNewBidProjectDescription] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    axios
      .get(`${API_BASE_URL}/api/customer/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setCustomer(res.data.customer);
        const prof = res.data.profile || { phone: '', address: '' };
        setProfile(prof);
        setEditProfile(prof);
        setNewBidPhone(prof.phone || '');
        setNewBidAddress(prof.address || '');
      })
      .catch(err => {
        if (err.response?.status === 403) {
          navigate('/');
          return;
        }
        console.error(err);
        alert(err.response?.data?.msg || 'Failed to load your information.');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/customer/me`,
        { phone: editProfile.phone, address: editProfile.address },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(res.data.profile || { phone: '', address: '' });
      setEditProfile(res.data.profile || { phone: '', address: '' });
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  const handleNewBid = async () => {
    if (!newBidProjectName?.trim() || !newBidProjectDescription?.trim()) {
      alert('Project name and description are required.');
      return;
    }
    setSubmittingBid(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/customer/me/bid`,
        {
          projectName: newBidProjectName.trim(),
          projectDescription: newBidProjectDescription.trim(),
          phone: newBidPhone?.trim() || undefined,
          address: newBidAddress?.trim() || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.msg || 'Request submitted.');
      setNewBidProjectName('');
      setNewBidProjectDescription('');
      axios
        .get(`${API_BASE_URL}/api/customer/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          setCustomer(r.data.customer);
        })
        .catch(() => {});
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to submit request.');
    } finally {
      setSubmittingBid(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!customer) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">My Information</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Sign out
          </button>
        </div>
        <p className="text-gray-600 text-sm mb-4">
          Your account details below. You can only edit your preferred contact phone and address (these do not change what admins see in Customer Management).
        </p>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Account (read-only)</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Name</dt><dd className="font-medium">{customer.name}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{customer.email}</dd></div>
            <div><dt className="text-gray-500">Phone (on file)</dt><dd className="font-medium">{customer.phone || '—'}</dd></div>
            <div><dt className="text-gray-500">Address (on file)</dt><dd className="font-medium">{customer.address || '—'}</dd></div>
          </dl>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">My preferred contact (editable)</h2>
          {editing ? (
            <div className="space-y-3">
              <input
                type="tel"
                placeholder="Preferred phone"
                value={editProfile.phone}
                onChange={e => setEditProfile(p => ({ ...p, phone: e.target.value }))}
                className="block w-full p-2 border rounded text-black"
              />
              <input
                type="text"
                placeholder="Preferred address"
                value={editProfile.address}
                onChange={e => setEditProfile(p => ({ ...p, address: e.target.value }))}
                className="block w-full p-2 border rounded text-black"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={saving} className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => { setEditing(false); setEditProfile(profile); }} className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <dl className="space-y-2 text-sm mb-2">
                <div><dt className="text-gray-500">Preferred phone</dt><dd className="font-medium">{profile.phone || '—'}</dd></div>
                <div><dt className="text-gray-500">Preferred address</dt><dd className="font-medium">{profile.address || '—'}</dd></div>
              </dl>
              <button type="button" onClick={() => setEditing(true)} className="text-teal-600 hover:text-teal-800 text-sm underline">
                Edit preferred contact
              </button>
            </>
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Request for Service / New Bid</h2>
          <p className="text-gray-600 text-sm mb-3">
            Submit a new project request. Your name and email are already on file.
          </p>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-gray-500 block mb-0.5">Name</label>
                <div className="p-2 border rounded bg-gray-50 text-gray-700">{customer.name}</div>
              </div>
              <div>
                <label className="text-gray-500 block mb-0.5">Email</label>
                <div className="p-2 border rounded bg-gray-50 text-gray-700">{customer.email}</div>
              </div>
            </div>
            <div>
              <label className="text-gray-500 block mb-0.5">Phone</label>
              <input
                type="tel"
                placeholder="Phone"
                value={newBidPhone}
                onChange={e => setNewBidPhone(e.target.value)}
                className="block w-full p-2 border rounded text-black"
              />
            </div>
            <div>
              <label className="text-gray-500 block mb-0.5">Address (optional)</label>
              <input
                type="text"
                placeholder="Address"
                value={newBidAddress}
                onChange={e => setNewBidAddress(e.target.value)}
                className="block w-full p-2 border rounded text-black"
              />
            </div>
            <div>
              <label className="text-gray-500 block mb-0.5">Project Name *</label>
              <input
                type="text"
                placeholder="Project name"
                value={newBidProjectName}
                onChange={e => setNewBidProjectName(e.target.value)}
                className="block w-full p-2 border rounded text-black"
              />
            </div>
            <div>
              <label className="text-gray-500 block mb-0.5">Project Description *</label>
              <textarea
                placeholder="Describe the work you need"
                value={newBidProjectDescription}
                onChange={e => setNewBidProjectDescription(e.target.value)}
                rows={3}
                className="block w-full p-2 border rounded text-black resize-none"
              />
            </div>
            <button
              type="button"
              onClick={handleNewBid}
              disabled={submittingBid}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 font-medium"
            >
              {submittingBid ? 'Submitting...' : 'New Service / New Bid'}
            </button>
          </div>
        </section>

        {customer.projects && customer.projects.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Projects</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              {customer.projects.map((p, i) => (
                <li key={i}>
                  {p.name} — {p.status || 'Pending'}
                  {p.status === 'Completed' && p.completedAt && (
                    <span className="text-gray-500"> ({format(new Date(p.completedAt), 'MMM d, yyyy')})</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
