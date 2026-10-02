import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  STAFF_NAV_ITEMS,
  isStaffNavActive,
  logoutStaff,
  staffNavLabel,
} from '../constants/staffNav';

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Overlay/drawer stay siblings of the header: backdrop-blur makes a containing
          block, so nested position:fixed panels were clipped to the 65px bar. */}
      <header
        data-testid="mobile-nav-bar"
        className="lg:hidden fixed top-0 left-0 right-0 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md z-[80]"
      >
        <div className="flex items-center justify-between p-4 gap-2">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 uppercase pr-2 max-w-[calc(100%-56px)] whitespace-nowrap overflow-hidden text-ellipsis">
            CHRISTIAN SECURITY SERVICES
          </h1>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-3 md:p-2 text-slate-900 hover:bg-slate-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {isOpen && (
        <>
          <div
            data-testid="mobile-nav-overlay"
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-[60]"
            onClick={() => setIsOpen(false)}
          />
          <div
            data-testid="mobile-nav-drawer"
            className="lg:hidden fixed top-[65px] right-0 bottom-0 w-64 bg-white shadow-xl z-[70] overflow-y-auto"
          >
            <nav className="p-4 flex flex-col gap-2" aria-label="Staff">
              {STAFF_NAV_ITEMS.map((item) => {
                const active = isStaffNavActive(item.path, location);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`btn-secondary w-full justify-start gap-3 text-sm${
                      active ? ' ring-2 ring-slate-900' : ''
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">{item.icon}</span>
                    <span>{staffNavLabel(item)}</span>
                  </Link>
                );
              })}
              <button
                onClick={logoutStaff}
                className="btn-secondary w-full justify-start gap-3 text-sm"
              >
                <span className="text-xl" aria-hidden="true">🚪</span>
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </>
      )}

      <div className="lg:hidden h-[65px]" />
    </>
  );
}
