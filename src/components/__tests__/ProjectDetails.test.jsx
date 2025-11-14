/**
 * Tests for ProjectDetails Component
 * Testing: Project display, Status updates, Materials management, Error handling
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import ProjectDetails from '../ProjectDetails';

jest.mock('axios');

const renderWithRouter = (customerId = 'cust123', projectId = 'proj456') => {
  return render(
    <MemoryRouter initialEntries={[`/projects/${customerId}/${projectId}`]}>
      <Routes>
        <Route path="/projects/:customerId/:projectId" element={<ProjectDetails />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProjectDetails Component', () => {
  const mockCustomer = {
    _id: 'cust123',
    name: 'John Doe',
    projects: [
      {
        _id: 'proj456',
        name: 'Kitchen Remodel',
        description: 'Complete kitchen renovation',
        status: 'Pending',
        materials: [],
        bidAmount: 0,
        billAmount: 0
      }
    ]
  };

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
    global.alert = jest.fn();
  });

  describe('Loading and Display', () => {
    test('should fetch and display project details', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });

      renderWithRouter('cust123', 'proj456');

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/customers/cust123'),
          expect.any(Object)
        );
      });
    });

    test('should show loading state', () => {
      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithRouter();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test('should handle project not found', async () => {
      const customerWithoutProject = {
        ...mockCustomer,
        projects: [{ _id: 'different-id', name: 'Other Project' }]
      };
      axios.get.mockResolvedValue({ data: customerWithoutProject });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/project not found/i)).toBeInTheDocument();
      });
    });

    test('should handle authentication error', async () => {
      localStorage.removeItem('token');
      axios.get.mockResolvedValue({ data: mockCustomer });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/not authenticated/i)).toBeInTheDocument();
      });
    });
  });

  describe('Status Updates', () => {
    test('should update bid amount', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      axios.put.mockResolvedValue({ 
        data: { ...mockCustomer.projects[0], bidAmount: 5000, status: 'Bidded' }
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      const bidInput = screen.getByPlaceholderText(/Enter bid amount/i);
      await userEvent.type(bidInput, '5000');

      const bidButton = screen.getByText(/submit bid/i);
      
      // Mock the refresh call after bid update
      axios.get.mockResolvedValueOnce({ data: mockCustomer });
      
      await userEvent.click(bidButton);

      await waitFor(() => {
        expect(axios.put).toHaveBeenCalled();
      });
    });
  });

  describe('Materials Management', () => {
    test('should add material to project', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      axios.post.mockResolvedValue({
        data: [{ _id: 'm1', item: 'Lumber', quantity: 100, cost: 500 }]
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      // Find material input fields
      const itemInput = screen.getByPlaceholderText('Item');
      const quantityInput = screen.getByPlaceholderText('Quantity');
      const costInput = screen.getByPlaceholderText(/Cost \(\$\)/i);

      await userEvent.type(itemInput, 'Lumber');
      await userEvent.type(quantityInput, '100');
      await userEvent.type(costInput, '500');

      axios.get.mockResolvedValueOnce({ data: mockCustomer });
      
      const addButton = screen.getByText(/add material/i);
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    test('should have back to customers link', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/back to customers/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle network error', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    test('should handle missing projects array', async () => {
      axios.get.mockResolvedValue({ data: { ...mockCustomer, projects: null } });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/no projects/i)).toBeInTheDocument();
      });
    });
  });
});

