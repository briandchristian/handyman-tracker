import { Link, useLocation } from 'react-router-dom';
import {
  COMPANY_NAME,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
} from '../constants/companyContact';

/**
 * Sticky public header for /, /bid, and /login.
 * Phone: compact brand + Call, then Home / Bid / Sign in.
 * Desktop (md+): one row — logo, name, nav, full phone.
 */
export default function PublicNav() {
  const { pathname } = useLocation();

  const linkClass = (path) =>
    `min-h-[44px] inline-flex items-center justify-center px-3 rounded font-semibold text-sm ${
      pathname === path
        ? 'bg-slate-900 text-white'
        : 'text-slate-800 hover:bg-slate-100'
    }`;

  return (
    <header
      data-testid="public-nav"
      className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80"
    >
      <div
        data-testid="public-nav-bar"
        className="flex flex-col md:flex-row md:items-center md:justify-between md:max-w-6xl md:mx-auto md:px-6"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 md:px-0 md:py-3 md:gap-6">
          <Link to="/" className="flex items-center gap-2 min-w-0 min-h-[44px]">
            <img
              src="/logo.png"
              alt="Christian Security Services Logo"
              className="h-12 w-12 object-contain flex-shrink-0"
            />
            <span className="text-xs sm:text-sm md:text-base font-bold text-gray-900 uppercase leading-tight truncate">
              {COMPANY_NAME}
            </span>
          </Link>
          <a
            href={COMPANY_PHONE_TEL}
            className="flex-shrink-0 min-h-[44px] inline-flex items-center px-3 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 md:hidden"
          >
            Call
            <span className="sr-only"> {COMPANY_PHONE_DISPLAY}</span>
          </a>
        </div>
        <nav
          className="flex items-stretch justify-around border-t border-gray-100 px-1 md:border-0 md:justify-end md:gap-2 md:px-0"
          aria-label="Public"
        >
          <Link to="/" className={linkClass('/')}>
            Home
          </Link>
          <Link to="/bid" className={linkClass('/bid')}>
            Bid
          </Link>
          <Link to="/login" className={linkClass('/login')}>
            Sign in
          </Link>
          <a
            href={COMPANY_PHONE_TEL}
            className="hidden md:inline-flex min-h-[44px] items-center px-4 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700"
          >
            Call {COMPANY_PHONE_DISPLAY}
          </a>
        </nav>
      </div>
    </header>
  );
}
