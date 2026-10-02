/**
 * Staff sections, in the order people move through a job.
 * Daily sections stay in the desktop bar. Occasional tools stay in More,
 * and the phone menu lists every section with its longer name.
 */

export const STAFF_NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: '🏠', primary: true },
  { name: 'Customers', path: '/customers', icon: '👥', primary: true },
  { name: 'Inventory', path: '/inventory', icon: '📦', primary: true },
  { name: 'Orders', menuName: 'Purchase Orders', path: '/purchase-orders', icon: '📋', primary: true },
  { name: 'Accounting', path: '/accounting', icon: '💵', primary: true },
  { name: 'Part price', path: '/inventory#adi-price', icon: '💲' },
  { name: 'Suppliers', path: '/suppliers', icon: '🏪' },
  { name: 'Subcontractor', path: '/subcontractor', icon: '🛠️' },
  { name: 'History', menuName: 'Installation History', path: '/installation-history', icon: '📜' },
  { name: 'Users', path: '/admin/users', icon: '👤' },
  { name: 'Bid alerts', path: '/admin/bid-alerts', icon: '✉️' },
];

/** Phone menu uses the longer label. The desktop bar uses the short one. */
export function staffNavLabel(item, { compact = false } = {}) {
  if (compact) return item.name;
  return item.menuName || item.name;
}

/** True when this destination is the page on screen. Hash links do not light up their parent. */
export function isStaffNavActive(path, location) {
  const hashIndex = path.indexOf('#');
  const pathname = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : path.slice(hashIndex);
  if (hash) {
    return location.pathname === pathname && location.hash === hash;
  }
  if (pathname === '/inventory') {
    return location.pathname === '/inventory' && !location.hash;
  }
  if (pathname === '/dashboard') {
    return location.pathname === '/dashboard';
  }
  return location.pathname === pathname || location.pathname.startsWith(`${pathname}/`);
}

export function logoutStaff() {
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  window.location.href = '/login';
}
