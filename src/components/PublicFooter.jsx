import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { COMPANY_NAME } from '../constants/companyContact';

/**
 * Public footer on marketing, bid, login, and other logged-out pages.
 * Your Privacy Choices sits beside the privacy policy link and opens a
 * dialog. Opting out calls updateUserPrivacyPreferences(true).
 */
export default function PublicFooter() {
  const [open, setOpen] = useState(false);
  const [optedOut, setOptedOut] = useState(() => {
    try {
      return localStorage.getItem('privacyOptOut') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function optOut() {
    if (typeof window.updateUserPrivacyPreferences === 'function') {
      window.updateUserPrivacyPreferences(true);
    }
    setOptedOut(true);
  }

  return (
    <footer className="border-t border-slate-200 bg-slate-100 px-4 py-8 md:px-8 text-sm text-slate-600">
      <div className="max-w-6xl mx-auto flex flex-col gap-2 md:items-center md:text-center">
        <p>© {new Date().getFullYear()} {COMPANY_NAME}. ID 2622 Alarm Contracting Company.</p>
        <p className="text-slate-500">
          <Link to="/login" className="font-medium text-slate-700 hover:text-emerald-700">
            Customer &amp; staff sign in
          </Link>
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          <Link to="/privacy-policy" className="font-medium text-slate-700 hover:text-emerald-700">
            Privacy policy
          </Link>
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-medium text-slate-700 hover:text-emerald-700"
          >
            Your Privacy Choices
          </button>
        </p>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-choices-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 text-left text-slate-800 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="privacy-choices-title" className="text-xl font-bold text-slate-900">
              Your Privacy Choices
            </h2>
            <p className="mt-3 leading-relaxed">
              Opt out of targeted data sharing on this browser. That tells Google to deny analytics
              and ad consent, including personalized advertising.
            </p>
            {optedOut ? (
              <p className="mt-4 font-medium text-slate-900">
                You opted out of targeted data sharing on this browser.
              </p>
            ) : (
              <button
                type="button"
                onClick={optOut}
                className="mt-5 inline-flex min-h-[48px] items-center rounded-lg bg-slate-900 px-4 font-semibold text-white hover:bg-slate-800"
              >
                Opt out of targeted data sharing
              </button>
            )}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-medium text-slate-700 hover:text-emerald-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </footer>
  );
}
