import { render, screen, waitFor } from '@testing-library/react';
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

  test('leaves Dashboard and Logout to the staff header', async () => {
    render(
      <BrowserRouter>
        <InstallationHistory />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Installation & Service History')).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-footer')).not.toBeInTheDocument();
  });
});

