/**
 * Staff page for bid alert emails.
 * The top section configures who receives the next alert (Email 1, Email 2, …).
 * Below that, each sent email is a selectable line. One Delete button removes
 * the lines that are checked. A line stores only what the message contained.
 * SMTP host, username, and password stay in server environment variables and
 * are never entered or displayed here.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import FormStatus from './FormStatus';
import {
  MAX_BID_ALERT_RECIPIENTS,
  parseRecipientEmails,
} from '../utils/bidAlertRecipients';
import { downloadSentBidAlertsCsv } from '../utils/bidAlertCsv';

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

function formatSentAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'MMM d, yyyy h:mm a');
}

export default function BidAlertSettings() {
  const [rows, setRows] = useState(['']);
  const [sent, setSent] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [sentStatus, setSentStatus] = useState({ message: '', tone: 'success' });
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState({ message: '', tone: 'error' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/settings/bid-alerts`, authHeaders());
        if (cancelled) return;
        const recipients = Array.isArray(res.data?.recipients) ? res.data.recipients : [];
        setRows(recipients.length ? recipients : ['']);
        setSent(Array.isArray(res.data?.sent) ? res.data.sent : []);
        setSelectedIds([]);
        setSmtpConfigured(Boolean(res.data?.smtpConfigured));
      } catch (err) {
        console.error('Error loading bid alert emails:', err);
        if (!cancelled) setLoadError('Failed to load bid alert emails.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateRow = (index, value) => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? value : row)));
  };

  const addRow = () => {
    setRows((current) => [...current, '']);
  };

  const removeRow = (index) => {
    setRows((current) => {
      if (current.length === 1) return [''];
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const handleSave = async () => {
    const parsed = parseRecipientEmails(rows);
    if (parsed.invalid.length > 0) {
      setStatus({
        message: `Invalid email: ${parsed.invalid.join(', ')}`,
        tone: 'error',
      });
      return;
    }
    if (parsed.recipients.length > MAX_BID_ALERT_RECIPIENTS) {
      setStatus({
        message: `You can save at most ${MAX_BID_ALERT_RECIPIENTS} notification emails.`,
        tone: 'error',
      });
      return;
    }

    try {
      setSaving(true);
      const res = await axios.put(
        `${API_BASE_URL}/api/settings/bid-alerts`,
        { recipients: parsed.recipients },
        authHeaders()
      );
      const saved = Array.isArray(res.data?.recipients) ? res.data.recipients : parsed.recipients;
      setRows(saved.length ? saved : ['']);
      setSmtpConfigured(Boolean(res.data?.smtpConfigured));
      setStatus({ message: res.data?.msg || 'Bid alert emails saved.', tone: 'success' });
    } catch (err) {
      setStatus({
        message: err.response?.data?.msg || 'Failed to save bid alert emails.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSent = (id) => {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const handleDeleteSent = async () => {
    if (selectedIds.length === 0 || deleting) return;
    try {
      setDeleting(true);
      const res = await axios.delete(
        `${API_BASE_URL}/api/settings/bid-alerts/sent`,
        { ...authHeaders(), data: { ids: selectedIds } }
      );
      setSent(Array.isArray(res.data?.sent) ? res.data.sent : []);
      setSelectedIds([]);
      setSentStatus({
        message: res.data?.msg || 'Sent email deleted.',
        tone: 'success',
      });
    } catch (err) {
      setSentStatus({
        message: err.response?.data?.msg || 'Failed to delete sent emails.',
        tone: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 text-slate-900 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Bid alert emails</h1>
        <p className="mt-4">Loading bid alert emails...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 md:p-8 text-slate-900 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Bid alert emails</h1>
        <FormStatus message={loadError} tone="error" />
        <Link to="/dashboard" className="btn-secondary text-sm">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="bid-alert-settings" className="p-4 md:p-8 text-slate-900 max-w-2xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Bid alert emails</h1>
        <Link to="/dashboard" className="btn-secondary text-sm">
          Dashboard
        </Link>
      </div>

      <p className="text-slate-600 mb-4">
        These addresses are emailed when someone submits Request a Bid. Add as many as you need,
        and change or remove them at any time. Save an empty list to stop the emails.
      </p>

      {smtpConfigured ? (
        <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          Email sending is configured. New bid requests will be sent to the addresses below.
        </p>
      ) : (
        <p className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
          SMTP is not configured on the server, so these addresses will not receive mail until
          SMTP_HOST and SMTP_FROM are set.
        </p>
      )}

      <h2 className="text-lg font-semibold mb-3">Notification addresses</h2>
      <div className="card-surface p-5 space-y-3">
        <FormStatus message={status.message} tone={status.tone} />
        {rows.map((value, index) => (
          <div key={index} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="field-label" htmlFor={`bid-alert-email-${index}`}>
                Email {index + 1}
              </label>
              <input
                id={`bid-alert-email-${index}`}
                aria-label={`Notification email ${index + 1}`}
                type="email"
                autoComplete="email"
                value={value}
                onChange={(event) => updateRow(index, event.target.value)}
                placeholder="name@example.com"
                className="field"
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label={`Remove notification email ${index + 1}`}
              className="btn-secondary text-sm mb-0.5"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <button type="button" onClick={addRow} className="btn-secondary text-sm">
            Add email
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mt-8 mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Sent emails</h2>
        {sent.length > 0 && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => downloadSentBidAlertsCsv(sent)}
              className="btn-secondary text-sm"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleDeleteSent}
              disabled={selectedIds.length === 0 || deleting}
              className="btn-danger text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>
      <FormStatus message={sentStatus.message} tone={sentStatus.tone} />
      {sent.length === 0 ? (
        <p className="text-slate-600">No bid alert emails have been sent.</p>
      ) : (
        <ul aria-label="Sent emails" className="card-surface divide-y divide-slate-200 overflow-hidden">
          {sent.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <li key={item.id || item.sentAt} className={selected ? 'bg-slate-50' : 'bg-white'}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSent(item.id)}
                    aria-label={`Select ${item.name}, ${item.projectName}`}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-500">{formatSentAt(item.sentAt)}</span>
                    <span className="block font-semibold text-slate-900">
                      {item.name} — {item.projectName}
                    </span>
                    <span className="block text-sm text-slate-700">
                      {item.email} · {item.phone} · {item.address}
                    </span>
                    <span className="block text-sm text-slate-700">{item.projectDescription}</span>
                    <span className="block text-sm text-slate-600">
                      Sent to {(item.recipients || []).join(', ')}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
