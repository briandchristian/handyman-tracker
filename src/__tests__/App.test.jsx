/**
 * Tests for App Component
 * Testing: Routing, Protected routes, Token-based navigation
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

jest.mock('../components/Login', () => {
  return function MockLogin() {
    return <div data-testid="login-component">Login Component</div>;
  };
});

jest.mock('../components/MarketingHome', () => {
  return function MockMarketingHome() {
    return <div data-testid="marketing-home-component">Marketing Home</div>;
  };
});

jest.mock('../components/RequestBid', () => {
  return function MockRequestBid() {
    return <div data-testid="request-bid-component">Request Bid</div>;
  };
});

jest.mock('../components/Dashboard', () => {
  return function MockDashboard() {
    return <div data-testid="dashboard-component">Dashboard Component</div>;
  };
});

jest.mock('../components/Customers', () => {
  return function MockCustomers() {
    return <div data-testid="customers-component">Customers Component</div>;
  };
});

jest.mock('../components/ProjectDetails', () => {
  return function MockProjectDetails() {
    return <div data-testid="project-details-component">Project Details Component</div>;
  };
});

jest.mock('../components/UserManagement', () => {
  return function MockUserManagement() {
    return <div data-testid="user-management-component">User Management Component</div>;
  };
});

jest.mock('../components/Suppliers', () => {
  return function MockSuppliers() {
    return <div data-testid="suppliers-component">Suppliers Component</div>;
  };
});

jest.mock('../components/PurchaseOrders', () => {
  return function MockPurchaseOrders() {
    return <div data-testid="purchase-orders-component">Purchase Orders Component</div>;
  };
});

jest.mock('../components/Inventory', () => {
  return function MockInventory() {
    return <div data-testid="inventory-component">Inventory Component</div>;
  };
});

jest.mock('../components/Accounting', () => {
  return function MockAccounting() {
    return <div data-testid="accounting-component">Accounting Component</div>;
  };
});

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Public routes', () => {
    test('should render marketing home on / without token', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('marketing-home-component')).toBeInTheDocument();
    });

    test('should render marketing home on / even with token', () => {
      localStorage.setItem('token', 'fake-jwt-token');

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('marketing-home-component')).toBeInTheDocument();
    });

    test('should render RequestBid on /bid without token', () => {
      render(
        <MemoryRouter initialEntries={['/bid']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('request-bid-component')).toBeInTheDocument();
    });

    test('should render Login on /login without token', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });
  });

  describe('Routing without authentication', () => {
    test('should redirect to /login when accessing /dashboard without token', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    test('should redirect to /login when accessing /customers without token', () => {
      render(
        <MemoryRouter initialEntries={['/customers']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });
  });

  describe('Routing with authentication', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'fake-jwt-token');
    });

    test('should render Dashboard on /dashboard with token', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('dashboard-component')).toBeInTheDocument();
    });

    test('should render Customers component on /customers with token', () => {
      render(
        <MemoryRouter initialEntries={['/customers']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('customers-component')).toBeInTheDocument();
    });

    test('should allow access to /login even with token', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });
  });

  describe('Protected route behavior', () => {
    test('should protect staff routes except public pages', () => {
      const protectedRoutes = [
        '/dashboard',
        '/customers',
        '/projects/123/456',
        '/admin/users',
        '/suppliers',
        '/purchase-orders',
        '/inventory',
        '/accounting',
      ];

      protectedRoutes.forEach((route) => {
        const { unmount } = render(
          <MemoryRouter initialEntries={[route]}>
            <App />
          </MemoryRouter>
        );

        expect(screen.getByTestId('login-component')).toBeInTheDocument();
        unmount();
      });
    });

    test('should allow access to staff routes with valid token', () => {
      localStorage.setItem('token', 'valid-token');

      const authenticatedRoutes = [
        { path: '/dashboard', testId: 'dashboard-component' },
        { path: '/customers', testId: 'customers-component' },
        { path: '/projects/123/456', testId: 'project-details-component' },
        { path: '/admin/users', testId: 'user-management-component' },
        { path: '/suppliers', testId: 'suppliers-component' },
        { path: '/purchase-orders', testId: 'purchase-orders-component' },
        { path: '/inventory', testId: 'inventory-component' },
        { path: '/accounting', testId: 'accounting-component' },
      ];

      authenticatedRoutes.forEach(({ path, testId }) => {
        const { unmount } = render(
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        );

        expect(screen.getByTestId(testId)).toBeInTheDocument();
        unmount();
      });
    });
  });
});
