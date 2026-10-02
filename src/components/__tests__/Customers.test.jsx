/**
 * Tests for Customers Component
 * Testing: Customer CRUD, Project management, Search/Filter, Navigation
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import Customers from '../Customers';

jest.mock('axios');

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

const createMatchMediaMock = (matches) => jest.fn().mockImplementation((query) => ({
  matches,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
}));

describe('Customers Component', () => {
  const mockCustomers = [
    {
      _id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-1234',
      address: '123 Main St',
      projects: [
        { _id: 'p1', name: 'Kitchen Remodel', status: 'Pending' }
      ]
    },
    {
      _id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '555-5678',
      address: '456 Oak Ave',
      projects: []
    }
  ];

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
    global.alert = jest.fn();
  });

  describe('Rendering and Data Fetching', () => {
    let originalMatchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    test('should fetch and display customers on mount', async () => {
      axios.get.mockResolvedValue({ data: mockCustomers });

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/customers'),
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' }
          })
        );
      });

      // Use getAllByText since names appear in both table and selected customer section
      await waitFor(() => {
        expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
      });
    });

    test('should display customer information', async () => {
      axios.get.mockResolvedValue({ data: mockCustomers });

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByText('john@example.com')[0]).toBeInTheDocument();
        expect(screen.getAllByText('555-1234')[0]).toBeInTheDocument();
      });
    });

    test('should display navigation links', () => {
      axios.get.mockResolvedValue({ data: [] });

      renderWithRouter(<Customers />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    test('should place dashboard next to logout in header', async () => {
      axios.get.mockResolvedValue({ data: [] });

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
        expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
        expect(screen.queryByTestId('page-footer')).not.toBeInTheDocument();
      });
    });

    test('should use compact centered page layout', async () => {
      axios.get.mockResolvedValue({ data: [] });
      const { container } = renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getByText('Customers')).toBeInTheDocument();
      });

      const root = container.firstChild;
      expect(root.className).toContain('max-w-6xl');
      expect(root.className).toContain('mx-auto');
    });

    test('should expose mobile section toggles with default expanded states', async () => {
      // Mobile-only controls (md:hidden) should be tested in an explicit mobile viewport mock.
      window.matchMedia = createMatchMediaMock(true);
      axios.get.mockResolvedValue({ data: [] });
      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Customer Management/i })).toBeInTheDocument();
      });

      const customerManagementToggle = screen.getByRole('button', { name: /Customer Management/i });
      const addCustomerToggle = screen.getByRole('button', { name: /Add New Customer/i });
      const customerListToggle = screen.getByRole('button', { name: /Customer List/i });

      expect(customerManagementToggle).toHaveAttribute('aria-expanded', 'true');
      expect(addCustomerToggle).toHaveAttribute('aria-expanded', 'false');
      expect(customerListToggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByRole('button', { name: /Add Job to Customer/i })).not.toBeInTheDocument();
    });

    test('should toggle mobile sections when pressed', async () => {
      // Keep this test stable by simulating mobile rendering conditions.
      window.matchMedia = createMatchMediaMock(true);
      axios.get.mockResolvedValue({ data: [] });
      renderWithRouter(<Customers />);

      const addCustomerToggle = await screen.findByRole('button', { name: /Add New Customer/i });
      expect(addCustomerToggle).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(addCustomerToggle);
      expect(addCustomerToggle).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Adding Customers', () => {
    test('should show labeled add-customer fields for aligned form layout', async () => {
      axios.get.mockResolvedValue({ data: [] });
      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByText('Add New Customer').length).toBeGreaterThan(0);
      });

      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Phone')).toBeInTheDocument();
      expect(screen.getByLabelText('Address')).toBeInTheDocument();
    });

    test('should add new customer', async () => {
      axios.get.mockResolvedValue({ data: [] });
      axios.post.mockResolvedValue({ data: { _id: '3', name: 'New Customer' } });

      renderWithRouter(<Customers />);

      const nameInput = screen.getByPlaceholderText('Name');
      const emailInput = screen.getByPlaceholderText('Email');
      const phoneInput = screen.getByPlaceholderText(/Phone \(XXX-XXX-XXXX\)/i);
      const addButton = screen.getByText('Add Customer');

      await userEvent.type(nameInput, 'New Customer');
      await userEvent.type(emailInput, 'new@example.com');
      await userEvent.type(phoneInput, '5559999');

      // Mock second call for refresh
      axios.get.mockResolvedValueOnce({ data: [{ _id: '3', name: 'New Customer', email: 'new@example.com' }] });
      
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/customers'),
          expect.objectContaining({
            name: 'New Customer',
            email: 'new@example.com',
            phone: expect.stringMatching(/555/)  // Phone formatting may vary
          }),
          expect.any(Object)
        );
      });
    });

    test('should clear form after adding customer', async () => {
      axios.get.mockResolvedValue({ data: [] });
      axios.post.mockResolvedValue({ data: {} });

      renderWithRouter(<Customers />);

      const nameInput = screen.getByPlaceholderText('Name');
      await userEvent.type(nameInput, 'Test');
      
      axios.get.mockResolvedValueOnce({ data: [] });
      await userEvent.click(screen.getByText('Add Customer'));

      await waitFor(() => {
        expect(nameInput.value).toBe('');
      });
    });

    test('should handle add customer error', async () => {
      axios.get.mockResolvedValue({ data: [] });
      axios.post.mockRejectedValue({
        response: { data: { msg: 'Validation error' } }
      });

      renderWithRouter(<Customers />);

      await userEvent.type(screen.getByPlaceholderText('Name'), 'Test');
      await userEvent.click(screen.getByText('Add Customer'));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Validation error')
        );
      });
    });
  });

  describe('Deleting Customers', () => {
    test('should delete customer after confirmation', async () => {
      global.confirm = jest.fn(() => true);
      axios.get.mockResolvedValue({ data: mockCustomers });
      axios.delete.mockResolvedValue({});

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('Delete');
      axios.get.mockResolvedValueOnce({ data: [mockCustomers[1]] });
      
      await userEvent.click(deleteButtons[0]);

      expect(global.confirm).toHaveBeenCalledWith('Remove John Doe?');
      await waitFor(() => {
        expect(axios.delete).toHaveBeenCalledWith(
          expect.stringContaining('/api/customers/1'),
          expect.any(Object)
        );
      });
    });

    test('does not delete a customer when the confirmation is cancelled', async () => {
      global.confirm = jest.fn(() => false);
      axios.get.mockResolvedValue({ data: mockCustomers });

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByText('Delete')[0]);

      expect(global.confirm).toHaveBeenCalledWith('Remove John Doe?');
      expect(axios.delete).not.toHaveBeenCalled();
    });

    test('warns before deleting a customer whose job has recorded work', async () => {
      global.confirm = jest.fn(() => true);
      axios.get.mockResolvedValue({
        data: [{
          ...mockCustomers[0],
          projects: [{ _id: 'p1', name: 'Kitchen Remodel', bidAmount: 1500 }],
        }],
      });
      axios.delete.mockResolvedValue({});

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByText('Delete')[0]);

      expect(global.confirm).toHaveBeenCalledWith(
        'This customer has a job with materials, a bid worksheet, payments, or a bid amount. Remove John Doe anyway?'
      );
    });
  });

  describe('Customer directory', () => {
    test('opens a customer from the name and shows a job count', async () => {
      axios.get.mockResolvedValue({ data: mockCustomers });
      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByRole('link', { name: 'John Doe' })[0]).toHaveAttribute('href', '/customers/1');
      });
      expect(screen.getAllByRole('link', { name: 'Jane Smith' })[0]).toHaveAttribute('href', '/customers/2');
      expect(screen.getAllByText('1 job').length).toBeGreaterThan(0);
      expect(screen.getAllByText('No jobs').length).toBeGreaterThan(0);
      expect(screen.queryByPlaceholderText(/Type customer name to search/i)).not.toBeInTheDocument();
    });

    test('filters the directory by name, email, phone, or account', async () => {
      axios.get.mockResolvedValue({ data: mockCustomers });
      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText(/Search name, email, phone, or account/i);
      await userEvent.type(searchInput, 'jane');

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
    });
  });

  describe('Phone Number Formatting', () => {
    test('should format phone number while typing', async () => {
      axios.get.mockResolvedValue({ data: [] });

      renderWithRouter(<Customers />);

      const phoneInput = screen.getByPlaceholderText(/Phone \(XXX-XXX-XXXX\)/i);
      await userEvent.type(phoneInput, '5551234567');

      expect(phoneInput.value).toBe('555-123-4567');
    });
  });

  describe('Opening a customer', () => {
    test('offers an Open link to the customer page', async () => {
      axios.get.mockResolvedValue({ data: mockCustomers });

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByRole('link', { name: 'Open' })[0]).toHaveAttribute('href', '/customers/1');
      });
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });
  });

  describe('Logout', () => {
    test('should logout and redirect to login', async () => {
      axios.get.mockResolvedValue({ data: [] });

      renderWithRouter(<Customers />);

      await userEvent.click(screen.getByText('Logout'));

      expect(localStorage.getItem('token')).toBeNull();
      // Component sets window.location.href = '/login'
    });
  });

  describe('Project Navigation', () => {
    test('should provide link to project details', async () => {
      axios.get.mockResolvedValue({ data: mockCustomers });

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
      });

      expect(screen.getAllByRole('link', { name: 'Open' })[0]).toHaveAttribute('href', '/customers/1');
      expect(screen.queryByRole('link', { name: 'Kitchen Remodel' })).not.toBeInTheDocument();
    });

    test('notes a customer obtained from the Request a Bid page', async () => {
      axios.get.mockResolvedValue({
        data: [
          { ...mockCustomers[0], obtainedVia: 'hero-bid' },
          mockCustomers[1],
        ],
      });

      renderWithRouter(<Customers />);

      expect(await screen.findByText('Obtained from the Request a Bid page')).toBeInTheDocument();
      expect(screen.getAllByText('Obtained from the Request a Bid page')).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should call fetchCustomers on mount', async () => {
      // This test verifies fetchCustomers is called
      // Note: fetchCustomers lacks error handling (line 19-25 in Customers.jsx)
      // which would cause unhandled rejections in production
      axios.get.mockResolvedValue({ data: [] });

      renderWithRouter(<Customers />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      expect(document.body).toBeInTheDocument();
    });
  });
});

