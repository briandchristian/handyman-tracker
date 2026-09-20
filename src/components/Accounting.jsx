/**
 * Staff accounting overview: AR, AP, tax collected, and per-job profit.
 * Read-only — numbers come from billed jobs, PO receive/pay, and payments.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';

const money = (value) =>
  `$${(Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function Accounting() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios
      .get(`${API_BASE_URL}/api/accounting/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setSummary(res.data))
      .catch((err) => {
        setError(err.response?.data?.msg || 'Failed to load accounting');
      });
  }, []);

  if (error) {
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

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-slate-900">
      <div className="hidden lg:flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Accounting</h1>
        <Link to="/dashboard" className="btn-staff text-sm">
          Dashboard
        </Link>
      </div>
      <div className="lg:hidden mb-4">
        <h1 className="text-2xl font-bold">Accounting</h1>
      </div>

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

      <div className="card-surface p-4 md:p-6">
        <h2 className="text-xl font-semibold mb-4">Job profit</h2>
        {summary.jobs.length === 0 ? (
          <p className="text-slate-600">No jobs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Billed</th>
                  <th className="py-2 pr-3">Material cost</th>
                  <th className="py-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {summary.jobs.map((job, index) => (
                  <tr key={`${job.projectName}-${index}`} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{job.customerName}</td>
                    <td className="py-2 pr-3">{job.projectName}</td>
                    <td className="py-2 pr-3">{job.status}</td>
                    <td className="py-2 pr-3">{money(job.billed)}</td>
                    <td className="py-2 pr-3">{money(job.materialCost)}</td>
                    <td className="py-2 font-semibold">{money(job.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
