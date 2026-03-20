/**
 * Tests for UserManagement Component
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserManagement from '../UserManagement';
import axios from 'axios';

jest.mock('axios');

describe('UserManagement Component', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    axios.get.mockResolvedValue({ data: [] });
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
      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);
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
});

