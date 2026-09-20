import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { name: 'Customers', path: '/customers', icon: '👥' },
    { name: 'Installation History', path: '/installation-history', icon: '📜' },
    { name: 'Inventory', path: '/inventory', icon: '📦' },
    { name: 'Suppliers', path: '/suppliers', icon: '🏪' },
    { name: 'Purchase Orders', path: '/purchase-orders', icon: '📋' },
    { name: 'Accounting', path: '/accounting', icon: '💵' },
    { name: 'Subcontractor', path: '/subcontractor', icon: '🛠️' },
    { name: 'Users', path: '/admin/users', icon: '👤' },
  ];

  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    if (path !== '/dashboard' && location.pathname.startsWith(path)) return true;
    return false;
  };

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
            <nav className="p-4" aria-label="Staff">
              {navigation.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 p-4 md:p-3 rounded-lg mb-2 min-h-[44px] text-base md:text-sm ${
                    isActive(item.path)
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('userRole');
                  window.location.href = '/login';
                }}
                className="flex items-center gap-3 p-4 md:p-3 rounded-lg mt-4 w-full text-left text-red-700 hover:bg-red-50 min-h-[44px] text-base md:text-sm font-medium"
              >
                <span className="text-xl">🚪</span>
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
