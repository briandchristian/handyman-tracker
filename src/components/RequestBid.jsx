import { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import PublicNav from './PublicNav';
import CompanyHeader from './CompanyHeader';
import FormStatus from './FormStatus';
import { formatPhoneNumber } from '../utils/phoneFormat';

/**
 * Public bid request form at /bid — primary Meta ads landing for Lead conversion.
 * Phone: no large header (nav already has branding), sticky submit, inline status.
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
    <div className="min-h-screen bg-gray-50 text-black">
      <PublicNav />
      <div
        data-testid="bid-page-main"
        className="p-4 md:p-8 pb-28 md:pb-8 max-w-[500px] mx-auto w-full"
      >
        <div data-testid="bid-company-header" className="hidden md:block">
          <CompanyHeader />
        </div>

        <div
          data-testid="bid-form-card"
          className="p-4 md:p-6 bg-white rounded-lg shadow w-full text-left md:text-center"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-2 text-gray-800">Request a Bid</h2>
          <p className="text-gray-600 mb-4 text-base md:text-sm">
            New customer? Submit your project details and we&apos;ll get back to you.
          </p>

          <FormStatus message={status.message} tone={status.tone} />

          <div className="space-y-3 text-left">
            <input
              type="text"
              placeholder="Your Name *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
            />
            <input
              type="email"
              placeholder="Email *"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
            />
            <input
              type="tel"
              placeholder="Phone (XXX-XXX-XXXX) *"
              value={customerPhone}
              onChange={handlePhoneChange}
              maxLength="12"
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
            />
            <input
              type="text"
              placeholder="Address (optional)"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
            />
            <input
              type="text"
              placeholder="Project Name *"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
            />
            <textarea
              placeholder="Project Description *"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="block p-4 md:p-2 border bg-white text-black w-full rounded h-24 resize-none text-base md:text-sm"
            />
          </div>
        </div>
      </div>

      <div
        data-testid="bid-submit-bar"
        className="sticky bottom-0 z-30 bg-white border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:max-w-[500px] md:mx-auto md:px-8 md:pt-0 w-full"
      >
        <button
          type="button"
          onClick={handleCustomerBid}
          className="bg-green-600 text-white p-4 md:p-3 rounded-lg w-full hover:bg-green-700 font-semibold text-base min-h-[48px]"
        >
          Submit Bid Request
        </button>
      </div>
    </div>
  );
}
