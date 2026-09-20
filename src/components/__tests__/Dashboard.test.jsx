/**
 * Tests for Dashboard Component
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      // Use getAllByText since Project 1 and Customer 1 appear in both mobile and desktop views
      const projectElements = screen.getAllByText('Project 1');
      expect(projectElements.length).toBeGreaterThan(0);
      const customerElements = screen.getAllByText('Customer 1');
      expect(customerElements.length).toBeGreaterThan(0);
    });
  });

  test('should render navigation links', async () => {
    axios.get.mockResolvedValue({ data: [] });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Subcontractor')).toBeInTheDocument();
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

  test('should show logout button in bottom footer', async () => {
    axios.get.mockResolvedValue({ data: mockCustomers });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    const footer = screen.getByTestId('page-footer');
    expect(within(footer).getByText('Logout')).toBeInTheDocument();
  });

  test('should use compact centered page layout', async () => {
    axios.get.mockResolvedValue({ data: mockCustomers });
    const { container } = render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    });

    const root = container.firstChild;
    expect(root.className).toContain('max-w-6xl');
    expect(root.className).toContain('mx-auto');
  });

  test('status cards filter the list and search narrows it', async () => {
    axios.get.mockResolvedValue({
      data: [
        {
          _id: '1',
          name: 'Ada',
          projects: [
            { _id: 'p1', name: 'Alarm A', status: 'Pending', createdAt: '2024-01-01' },
            { _id: 'p2', name: 'CCTV', status: 'Scheduled', createdAt: '2024-02-01' },
            { _id: 'p3', name: 'Fire', status: 'Completed', createdAt: '2024-03-01' },
          ],
        },
      ],
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alarm A').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('CCTV')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /scheduled/i }));
    expect(screen.getAllByText('CCTV').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alarm A')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /total jobs/i }));
    await userEvent.type(screen.getByRole('searchbox'), 'fire');
    expect(screen.getAllByText('Fire').length).toBeGreaterThan(0);
    expect(screen.queryByText('CCTV')).not.toBeInTheDocument();
  });
});

