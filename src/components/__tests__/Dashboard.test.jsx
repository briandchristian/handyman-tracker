/**
 * Tests for Dashboard Component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import Dashboard from '../Dashboard';

jest.mock('axios');

describe('Dashboard Component', () => {
  const mockCustomers = [
    {
      _id: '1',
      name: 'Customer 1',
      projects: [
        { _id: 'p1', name: 'Project 1', status: 'Pending', createdAt: '2024-01-01' }
      ]
    }
  ];

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
  });

  test('should render dashboard and fetch projects', async () => {
    axios.get.mockResolvedValue({ data: mockCustomers });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers'),
        expect.any(Object)
      );
    });
  });

  test('should display projects from all customers', async () => {
    axios.get.mockResolvedValue({ data: mockCustomers });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Customer 1')).toBeInTheDocument();
    });
  });

  test('should render navigation links', async () => {
    axios.get.mockResolvedValue({ data: [] });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Customers')).toBeInTheDocument();
  });

  test('should handle empty projects', async () => {
    axios.get.mockResolvedValue({ data: [] });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  test('should handle fetch error', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });
});

