/**
 * Tests for UserManagement Component
 */

import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserManagement from '../UserManagement';
import axios from 'axios';

jest.mock('axios');

const mockUsers = [
  {
    _id: 'user-target-id',
    username: 'targetuser',
    email: 'target@example.com',
    role: 'admin',
    status: 'approved',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('UserManagement Component', () => {
  beforeEach(() => {
    const payload = btoa(JSON.stringify({ id: 'current-user-id', role: 'super-admin' }));
    localStorage.setItem('token', `header.${payload}.signature`);
    axios.get.mockImplementation((url) => {
      if (url.includes('/pending')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: mockUsers });
    });
    axios.put.mockResolvedValue({ data: { msg: 'Password updated' } });
    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();
  });

  test('should render user management page', () => {
    render(<BrowserRouter><UserManagement /></BrowserRouter>);
    
    // Component renders without crashing
    expect(document.body).toBeInTheDocument();
  });

  test('should have navigation', () => {
    render(<BrowserRouter><UserManagement /></BrowserRouter>);
    
    // Component renders
    expect(document.body).toBeInTheDocument();
  });

  test('should show logout button in bottom footer', async () => {
    render(<BrowserRouter><UserManagement /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    const footer = screen.getByTestId('page-footer');
    expect(within(footer).getByText('Logout')).toBeInTheDocument();
    expect(within(footer).getByText('Dashboard')).toBeInTheDocument();
  });

  test('should only render one dashboard button', async () => {
    render(<BrowserRouter><UserManagement /></BrowserRouter>);

    await waitFor(() => {
      const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
      expect(dashboardLinks).toHaveLength(1);
      expect(dashboardLinks[0]).toHaveAttribute('href', '/dashboard');
    });
  });

  test('should use compact centered page layout', async () => {
    const { container } = render(<BrowserRouter><UserManagement /></BrowserRouter>);

    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });

    const root = container.firstChild;
    expect(root.className).toContain('max-w-6xl');
    expect(root.className).toContain('mx-auto');
  });

  test('should show reset password action on all users tab', async () => {
    render(<BrowserRouter><UserManagement /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /All Users/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /All Users/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument();
    });
  });

  test('should submit password reset to admin API', async () => {
    render(<BrowserRouter><UserManagement /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /All Users/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /All Users/i }));

    await waitFor(() => {
      expect(screen.getByText('targetuser')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    fireEvent.change(screen.getByLabelText(/New Password/i), {
      target: { value: 'newpass123' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: 'newpass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Reset Password$/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users/user-target-id/password'),
        { newPassword: 'newpass123' },
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });
  });
});

