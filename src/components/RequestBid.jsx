import { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import AuthShell from './AuthShell';
import FormStatus from './FormStatus';
import { formatPhoneNumber } from '../utils/phoneFormat';

/**
 * Public bid request form at /bid — primary Meta ads landing for Lead conversion.
 * Same dark slate/emerald chrome as home/login. Sticky submit on phones.
 */
export default function RequestBid() {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [status, setStatus] = useState({ message: '', tone: 'error' });

  const handlePhoneChange = (e) => {
    setCustomerPhone(formatPhoneNumber(e.target.value));
  };

  const handleCustomerBid = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/customer-bid`, {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        address: customerAddress,
        projectName,
        projectDescription,
      });

      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Lead');
      }

      setStatus({ message: res.data.msg, tone: 'success' });
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerAddress('');
      setProjectName('');
      setProjectDescription('');
    } catch (err) {
      if (!err.response) {
        setStatus({
          message:
            'Cannot connect to the server. Check your internet connection or try again shortly.',
          tone: 'error',
        });
        console.error('Network error submitting bid:', err);
      } else {
        const errorMsg = err.response?.data?.msg || 'Failed to submit bid request';
        setStatus({ message: errorMsg, tone: 'error' });
      }
    }
  };

  return (
    <AuthShell
      eyebrow="Free estimate"
      title="Request a Bid"
      subtitle="Tell us about the job. We will follow up with a professional quote — no spam."
      contentTestId="bid-page-main"
      afterHero={
        <div
          data-testid="bid-submit-bar"
          className="sticky bottom-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:max-w-md md:mx-auto md:px-8 md:py-8 w-full"
        >
          <button type="button" onClick={handleCustomerBid} className="btn-primary w-full">
            Submit Bid Request
          </button>
        </div>
      }
    >
      <div data-testid="bid-form-card" className="card-surface p-5 md:p-6 w-full text-left text-slate-900">
        <FormStatus message={status.message} tone={status.tone} />
        <div className="space-y-3">
          <div>
            <label className="field-label" htmlFor="bid-name">
              Name
            </label>
            <input
              id="bid-name"
              type="text"
              autoComplete="name"
              placeholder="Your Name *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="bid-email">
              Email
            </label>
            <input
              id="bid-email"
              type="email"
              autoComplete="email"
              placeholder="Email *"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="bid-phone">
              Phone
            </label>
            <input
              id="bid-phone"
              type="tel"
              autoComplete="tel"
              placeholder="Phone (XXX-XXX-XXXX) *"
              value={customerPhone}
              onChange={handlePhoneChange}
              maxLength="12"
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="bid-address">
              Address <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="bid-address"
              type="text"
              autoComplete="street-address"
              placeholder="Address (optional)"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="bid-project">
              Project name
            </label>
            <input
              id="bid-project"
              type="text"
              placeholder="Project Name *"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="bid-description">
              Description
            </label>
            <textarea
              id="bid-description"
              placeholder="Project Description *"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="field h-24 resize-none"
            />
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
