/**
 * Phase 2: Customer My Info page – view info, edit profile only (does not change Customer Management).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import CustomerMyInfo from '../CustomerMyInfo';

jest.mock('axios');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn()
}));

describe('CustomerMyInfo', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    useNavigate.mockReturnValue(mockNavigate);
    localStorage.setItem('token', 'fake-token');
    jest.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('should fetch and display customer info', async () => {
    axios.get.mockResolvedValue({
      data: {
        customer: { name: 'Jane Doe', email: 'jane@example.com', phone: '555-1111', address: '123 Main St', projects: [] },
        profile: { phone: '555-9999', address: 'Preferred Addr' }
      }
    });

    render(
      <MemoryRouter>
        <CustomerMyInfo />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/customer/me'), expect.any(Object));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('555-1111')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('555-9999')).toBeInTheDocument();
      expect(screen.getByText('Preferred Addr')).toBeInTheDocument();
    });
  });

  test('should allow editing profile and save via PUT /api/customer/me', async () => {
    axios.get.mockResolvedValue({
      data: {
        customer: { name: 'Bob', email: 'bob@example.com', phone: '', address: '', projects: [] },
        profile: { phone: '', address: '' }
      }
    });
    axios.put.mockResolvedValue({
      data: { profile: { phone: '555-NEW', address: 'New Addr' } }
    });

    render(
      <MemoryRouter>
        <CustomerMyInfo />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Edit preferred contact')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Edit preferred contact'));
    const phoneInput = screen.getByPlaceholderText('Preferred phone');
    const addressInput = screen.getByPlaceholderText('Preferred address');
    await userEvent.type(phoneInput, '555-NEW');
    await userEvent.type(addressInput, 'New Addr');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/customer/me'),
        { phone: '555-NEW', address: 'New Addr' },
        expect.any(Object)
      );
    });
  });

  test('should redirect to login when no token', async () => {
    localStorage.removeItem('token');
    render(
      <MemoryRouter>
        <CustomerMyInfo />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    }, { timeout: 1000 });
  });

  test('should show Request for Service / New Bid section with prefilled name and email', async () => {
    axios.get.mockResolvedValue({
      data: {
        customer: { name: 'Jane Doe', email: 'jane@example.com', phone: '', address: '', projects: [] },
        profile: { phone: '555-1234', address: '123 Main St' }
      }
    });

    render(
      <MemoryRouter>
        <CustomerMyInfo />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Request for Service / New Bid')).toBeInTheDocument());
    expect(screen.getByText('Request for Service / New Bid')).toBeInTheDocument();
    expect(screen.getByText(/Your name and email are already on file/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Service \/ New Bid/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe the work you need')).toBeInTheDocument();
  });

  test('should show completion timestamp for completed projects', async () => {
    const completedDate = '2025-01-15T12:00:00.000Z';
    axios.get.mockResolvedValue({
      data: {
        customer: {
          name: 'Jane',
          email: 'jane@example.com',
          phone: '',
          address: '',
          projects: [
            { name: 'Bathroom Fix', status: 'Pending' },
            { name: 'Deck Build', status: 'Completed', completedAt: completedDate }
          ]
        },
        profile: { phone: '', address: '' }
      }
    });

    render(
      <MemoryRouter>
        <CustomerMyInfo />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/Jan 15, 2025/)).toBeInTheDocument());
    expect(screen.getByText(/Bathroom Fix — Pending/)).toBeInTheDocument();
    expect(screen.getByText(/Deck Build — Completed/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2025/)).toBeInTheDocument();
  });
});
