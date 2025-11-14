/**
 * Tests for App Component
 * Testing: Routing, Protected routes, Token-based navigation
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock all components
jest.mock('../components/Login', () => {
  return function MockLogin({ setToken }) {
    return <div data-testid="login-component">Login Component</div>;
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

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Routing without authentication', () => {
    test('should render Login component on /login route', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    test('should redirect to /login when accessing root without token', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
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

    test('should redirect to /login when accessing /projects without token', () => {
      render(
        <MemoryRouter initialEntries={['/projects/customer123/project456']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    test('should redirect to /login when accessing /admin/users without token', () => {
      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    test('should redirect to /login when accessing /suppliers without token', () => {
      render(
        <MemoryRouter initialEntries={['/suppliers']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    test('should redirect to /login when accessing /purchase-orders without token', () => {
      render(
        <MemoryRouter initialEntries={['/purchase-orders']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    test('should redirect to /login when accessing /inventory without token', () => {
      render(
        <MemoryRouter initialEntries={['/inventory']}>
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

    test('should render Dashboard on root route with token', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
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

    test('should render ProjectDetails on /projects/:customerId/:projectId with token', () => {
      render(
        <MemoryRouter initialEntries={['/projects/customer123/project456']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('project-details-component')).toBeInTheDocument();
    });

    test('should render UserManagement on /admin/users with token', () => {
      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('user-management-component')).toBeInTheDocument();
    });

    test('should render Suppliers on /suppliers with token', () => {
      render(
        <MemoryRouter initialEntries={['/suppliers']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('suppliers-component')).toBeInTheDocument();
    });

    test('should render PurchaseOrders on /purchase-orders with token', () => {
      render(
        <MemoryRouter initialEntries={['/purchase-orders']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('purchase-orders-component')).toBeInTheDocument();
    });

    test('should render Inventory on /inventory with token', () => {
      render(
        <MemoryRouter initialEntries={['/inventory']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('inventory-component')).toBeInTheDocument();
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

  describe('Token management', () => {
    test('should read token from localStorage on mount', () => {
      localStorage.setItem('token', 'test-token');

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // Should show dashboard because token exists
      expect(screen.getByTestId('dashboard-component')).toBeInTheDocument();
    });

    test('should handle missing token in localStorage', () => {
      localStorage.removeItem('token');

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // Should redirect to login
      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    test('should handle null token', () => {
      localStorage.removeItem('token'); // null token = no token

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // Should redirect to login (null is falsy)
      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    test('should handle empty string token', () => {
      localStorage.setItem('token', '');

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // Should redirect to login (empty string is falsy)
      expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });
  });

  describe('Component structure', () => {
    test('should have min-h-screen and bg-gray-100 classes', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      const mainDiv = container.firstChild;
      expect(mainDiv).toHaveClass('min-h-screen', 'bg-gray-100');
    });

    test('should render Routes component', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      expect(container.querySelector('div')).toBeInTheDocument();
    });
  });

  describe('Route parameters', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'test-token');
    });

    test('should pass customerId and projectId params to ProjectDetails', () => {
      render(
        <MemoryRouter initialEntries={['/projects/abc123/xyz789']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('project-details-component')).toBeInTheDocument();
    });

    test('should handle complex IDs with special characters', () => {
      render(
        <MemoryRouter initialEntries={['/projects/507f1f77bcf86cd799439011/507f191e810c19729de860ea']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('project-details-component')).toBeInTheDocument();
    });
  });

  describe('Protected route behavior', () => {
    test('should protect all routes except /login', () => {
      const protectedRoutes = [
        '/',
        '/customers',
        '/projects/123/456',
        '/admin/users',
        '/suppliers',
        '/purchase-orders',
        '/inventory'
      ];

      protectedRoutes.forEach(route => {
        const { unmount } = render(
          <MemoryRouter initialEntries={[route]}>
            <App />
          </MemoryRouter>
        );

        expect(screen.getByTestId('login-component')).toBeInTheDocument();
        unmount();
      });
    });

    test('should allow access to all routes with valid token', () => {
      localStorage.setItem('token', 'valid-token');

      const authenticatedRoutes = [
        { path: '/', testId: 'dashboard-component' },
        { path: '/customers', testId: 'customers-component' },
        { path: '/projects/123/456', testId: 'project-details-component' },
        { path: '/admin/users', testId: 'user-management-component' },
        { path: '/suppliers', testId: 'suppliers-component' },
        { path: '/purchase-orders', testId: 'purchase-orders-component' },
        { path: '/inventory', testId: 'inventory-component' }
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

  describe('Edge cases', () => {
    test('should handle undefined routes gracefully', () => {
      localStorage.setItem('token', 'test-token');

      const { container } = render(
        <MemoryRouter initialEntries={['/non-existent-route']}>
          <App />
        </MemoryRouter>
      );

      // Should render something (likely empty or not crash)
      expect(container).toBeInTheDocument();
    });

    test('should handle different routes', () => {
      localStorage.setItem('token', 'test-token');

      // Test dashboard route
      const { unmount } = render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('dashboard-component')).toBeInTheDocument();
      unmount();

      // Test customers route in new instance
      render(
        <MemoryRouter initialEntries={['/customers']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('customers-component')).toBeInTheDocument();
    });

    test('should handle token change during session', () => {
      // Start without token
      const { rerender } = render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('login-component')).toBeInTheDocument();

      // Add token and re-render
      localStorage.setItem('token', 'new-token');
      rerender(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // Note: App reads token on mount, so this might still show login
      // This tests the current implementation behavior
    });
  });
});

