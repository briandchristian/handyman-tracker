/**
 * Desktop staff bar. Five daily sections stay on the bar. Part price, suppliers,
 * subcontractors, history, users, and bid alerts sit under More so the row
 * does not wrap. Links use the same outlined button as Bid alert emails.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  STAFF_NAV_ITEMS,
  isStaffNavActive,
  logoutStaff,
  staffNavLabel,
} from '../constants/staffNav';

const linkClass = (active) =>
  `btn-secondary text-sm${active ? ' ring-2 ring-slate-900' : ''}`;

export default function StaffNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const primary = STAFF_NAV_ITEMS.filter((item) => item.primary);
  const more = STAFF_NAV_ITEMS.filter((item) => !item.primary);
  const moreActive = more.some((item) => isStaffNavActive(item.path, location));

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = (event) => {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreOpen]);

  return (
    <header
      data-testid="staff-nav"
      className="hidden lg:block sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <Link
          to="/dashboard"
          className="mr-1 shrink-0 text-sm font-bold uppercase tracking-wide text-slate-900"
        >
          Christian Security
        </Link>
        <nav aria-label="Staff" className="flex flex-wrap items-center gap-2">
          {primary.map((item) => {
            const active = isStaffNavActive(item.path, location);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={linkClass(active)}
              >
                {staffNavLabel(item, { compact: true })}
              </Link>
            );
          })}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className={linkClass(moreActive)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              aria-current={moreActive ? 'page' : undefined}
              onClick={() => setMoreOpen((open) => !open)}
            >
              More
            </button>
            {moreOpen && (
              <div className="absolute left-0 z-50 mt-2 flex w-56 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {more.map((item) => {
                  const active = isStaffNavActive(item.path, location);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? 'page' : undefined}
                      className={`${linkClass(active)} w-full`}
                      onClick={() => setMoreOpen(false)}
                    >
                      {staffNavLabel(item, { compact: true })}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
        <button type="button" onClick={logoutStaff} className="btn-secondary text-sm ml-auto">
          Logout
        </button>
      </div>
    </header>
  );
}
