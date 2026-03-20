import { render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import InstallationHistory from '../InstallationHistory';

jest.mock('axios');

describe('InstallationHistory Component', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();

    global.alert = jest.fn();

    axios.get.mockImplementation((url) => {
      if (url.includes('/api/customers')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/api/installation-history')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  test('should show logout button in bottom footer', async () => {
    render(
      <BrowserRouter>
        <InstallationHistory />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Installation & Service History')).toBeInTheDocument();
    });

    const footer = screen.getByTestId('page-footer');
    expect(within(footer).getByText('Logout')).toBeInTheDocument();
    expect(within(footer).getByText('Dashboard')).toBeInTheDocument();
  });

  test('should only render one dashboard button', async () => {
    render(
      <BrowserRouter>
        <InstallationHistory />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);
    });
  });
});

