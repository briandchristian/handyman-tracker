/**
 * Installation and Service History (Phase 1 & 2)
 * - Continuous log of completed projects as historical events per customer
 * - Edit previous entries with audit trail (who/when/what)
 * - Export: single record, selected records, or all as CSV
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';

const token = () => localStorage.getItem('token');
const auth = () => ({ headers: { Authorization: `Bearer ${token()}` } });

export default function InstallationHistory() {
  const [entries, setEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerFilter, setCustomerFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ summary: '', details: '', completedAt: '' });
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers`, auth());
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const url = customerFilter
        ? `${API_BASE_URL}/api/installation-history?customerId=${customerFilter}`
        : `${API_BASE_URL}/api/installation-history`;
      const res = await axios.get(url, auth());
      setEntries(res.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [customerFilter]);

  const handleSelectAll = (checked) => {
    if (checked) setSelectedIds(new Set(entries.map(e => e._id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id, checked) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setEditForm({
      summary: entry.summary || '',
      details: entry.details || '',
      completedAt: entry.completedAt
        ? format(new Date(entry.completedAt), "yyyy-MM-dd'T'HH:mm")
        : ''
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = { summary: editForm.summary, details: editForm.details };
      if (editForm.completedAt) payload.completedAt = new Date(editForm.completedAt).toISOString();
      await axios.put(`${API_BASE_URL}/api/installation-history/${editing._id}`, payload, auth());
      setEditing(null);
      fetchHistory();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const downloadCsv = async (ids = null) => {
    try {
      const url = ids && ids.length > 0
        ? `${API_BASE_URL}/api/installation-history/export?ids=${ids.join(',')}`
        : `${API_BASE_URL}/api/installation-history/export`;
      const res = await axios.get(url, { ...auth(), responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'installation-service-history.csv';
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      alert(err.response?.data?.msg || 'Download failed');
    }
  };

  const downloadSelected = () => {
    if (selectedIds.size === 0) {
      alert('Select at least one record');
      return;
    }
    downloadCsv([...selectedIds]);
  };

  const downloadAll = () => downloadCsv(null);

  const downloadOne = (id) => downloadCsv([id]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  if (loading && entries.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <Link to="/customers" className="text-blue-600 hover:underline mb-4 inline-block">← Customers</Link>
        <p className="text-gray-600">Loading installation and service history...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 text-black max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">← Customers</Link>
        </div>
        <h1 className="text-2xl font-bold">Installation & Service History</h1>
      </div>

      <p className="text-gray-600 mb-4">
        Completed projects are logged here. You can edit entries; all admin edits are recorded. Export to CSV below.
      </p>

      <div className="flex flex-wrap gap-4 mb-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter by customer:</span>
          <select
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            className="border rounded px-2 py-1 text-black"
          >
            <option value="">All customers</option>
            {customers.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            onClick={downloadSelected}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            Download selected ({selectedIds.size})
          </button>
          <button
            onClick={downloadAll}
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm"
          >
            Download all
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">
                  <input
                    type="checkbox"
                    checked={entries.length > 0 && selectedIds.size === entries.length}
                    onChange={e => handleSelectAll(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left p-2">Customer</th>
                <th className="text-left p-2">Project</th>
                <th className="text-left p-2">Summary</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Completed at</th>
                <th className="text-left p-2">Edits</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={8} className="p-4 text-gray-500">No installation or service history yet. Complete projects to see them here.</td></tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry._id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry._id)}
                        onChange={e => handleSelectOne(entry._id, e.target.checked)}
                        aria-label={`Select ${entry.projectName}`}
                      />
                    </td>
                    <td className="p-2">{entry.customerName}</td>
                    <td className="p-2">{entry.projectName}</td>
                    <td className="p-2 max-w-[200px] truncate" title={entry.summary}>{entry.summary}</td>
                    <td className="p-2">{entry.type}</td>
                    <td className="p-2">{entry.completedAt ? format(new Date(entry.completedAt), 'PPp') : '—'}</td>
                    <td className="p-2">{entry.editHistory?.length || 0}</td>
                    <td className="p-2 flex gap-1">
                      <button onClick={() => openEdit(entry)} className="text-blue-600 hover:underline text-sm">Edit</button>
                      <button onClick={() => downloadOne(entry._id)} className="text-green-600 hover:underline text-sm">Download</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Edit history entry</h2>
              <p className="text-gray-600 text-sm mb-2">Customer: {editing.customerName} · Project: {editing.projectName}</p>
              <div className="space-y-3 mb-4">
                <label className="block">
                  <span className="text-sm font-medium">Summary</span>
                  <input
                    value={editForm.summary}
                    onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))}
                    className="block w-full border rounded px-2 py-1 text-black mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Details</span>
                  <textarea
                    value={editForm.details}
                    onChange={e => setEditForm(f => ({ ...f, details: e.target.value }))}
                    className="block w-full border rounded px-2 py-1 text-black mt-1 h-20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Completed at</span>
                  <input
                    type="datetime-local"
                    value={editForm.completedAt}
                    onChange={e => setEditForm(f => ({ ...f, completedAt: e.target.value }))}
                    className="block w-full border rounded px-2 py-1 text-black mt-1"
                  />
                </label>
              </div>
              {editing.editHistory && editing.editHistory.length > 0 && (
                <div className="mb-4 p-3 bg-gray-100 rounded">
                  <h3 className="text-sm font-semibold mb-2">Edit history (admin audit)</h3>
                  <ul className="text-xs space-y-1">
                    {editing.editHistory.map((edit, i) => (
                      <li key={i}>
                        <strong>{edit.editedByUsername}</strong> at {format(new Date(edit.editedAt), 'PPp')}: {edit.changes}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(null)} className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right page footer actions */}
      <div
        data-testid="page-footer"
        className="mt-8 flex justify-end items-center gap-3"
      >
        <Link
          to="/"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
