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

  test('leaves section links to the staff bar instead of a crowded header', async () => {
    axios.get.mockResolvedValue({ data: [] });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bid alerts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Part price' })).not.toBeInTheDocument();
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

  test('links each job back to its customer', async () => {
    axios.get.mockResolvedValue({ data: mockCustomers });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Customer 1' }).length).toBeGreaterThan(0);
    });

    screen.getAllByRole('link', { name: 'Customer 1' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/customers/1');
    });
    expect(screen.getAllByRole('link', { name: 'View Details →' })[0]).toHaveAttribute(
      'href',
      '/projects/1/p1'
    );
  });

  test('links New Customer Bid to the customer from the Request a Bid page and removes it after it is opened', async () => {
    axios.get.mockResolvedValue({
      data: [
        {
          _id: '9',
          name: 'Hero Lead',
          heroBidUnread: true,
          obtainedVia: 'hero-bid',
          projects: [{ _id: 'p9', name: 'Alarm', status: 'Pending', createdAt: '2024-01-02' }],
        },
        ...mockCustomers,
      ],
    });
    axios.put.mockResolvedValue({ data: { heroBidUnread: false } });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    const notices = await screen.findByTestId('hero-bid-notices');
    const notice = within(notices).getByRole('link', { name: 'New Customer Bid!' });
    expect(notice).toHaveAttribute('href', '/customers/9');
    expect(within(notices).getByText('Hero Lead')).toBeInTheDocument();

    await userEvent.click(notice);

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/9/hero-bid-notice'),
        expect.any(Object),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
    expect(screen.queryByRole('link', { name: 'New Customer Bid!' })).not.toBeInTheDocument();
  });

  test('does not show New Customer Bid when no hero bid is unread', async () => {
    axios.get.mockResolvedValue({ data: mockCustomers });

    render(<BrowserRouter><Dashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getAllByText('Customer 1').length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('link', { name: 'New Customer Bid!' })).not.toBeInTheDocument();
  });
});

