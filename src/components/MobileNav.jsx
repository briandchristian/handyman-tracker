import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', path: '/', icon: '🏠' },
    { name: 'Customers', path: '/customers', icon: '👥' },
    { name: 'Inventory', path: '/inventory', icon: '📦' },
    { name: 'Suppliers', path: '/suppliers', icon: '🏪' },
    { name: 'Purchase Orders', path: '/purchase-orders', icon: '📋' },
    { name: 'Users', path: '/admin/users', icon: '👤' },
  ];

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Nav Bar - Fixed Top */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-300 shadow-md z-50">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl md:text-xl font-bold text-black">Fixit Phillips</h1>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-3 md:p-2 text-black hover:bg-gray-100 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
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

        {/* Slide-out Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu Panel */}
            <div className="fixed top-[65px] right-0 bottom-0 w-64 bg-white shadow-xl z-50 overflow-y-auto">
              <nav className="p-4">
                {navigation.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 p-4 md:p-3 rounded mb-2 min-h-[44px] text-base md:text-sm ${
                      isActive(item.path)
                        ? 'bg-blue-500 text-white font-semibold'
                        : 'text-black hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                ))}
                
                {/* Logout */}
                <button
                  onClick={() => {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                  }}
                  className="flex items-center gap-3 p-4 md:p-3 rounded mt-4 w-full text-left text-red-600 hover:bg-red-50 min-h-[44px] text-base md:text-sm font-medium"
                >
                  <span className="text-xl">🚪</span>
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          </>
        )}
      </div>

      {/* Spacer for fixed nav on mobile */}
      <div className="lg:hidden h-[65px]" />
    </>
  );
}

