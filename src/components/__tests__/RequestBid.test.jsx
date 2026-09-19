/**
 * Request a Bid page — public lead form at /bid (Meta conversion landing).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import RequestBid from '../RequestBid';

jest.mock('axios');

describe('RequestBid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders bid form only (no admin login)', () => {
    render(
      <MemoryRouter>
        <RequestBid />
      </MemoryRouter>
    );

    expect(screen.getByText('Request a Bid')).toBeInTheDocument();
    expect(screen.queryByText('Admin Login')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-nav')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/');
  });

  test('centers the bid column on desktop while phone layout stays unchanged', () => {
    render(
      <MemoryRouter>
        <RequestBid />
      </MemoryRouter>
    );

    const main = screen.getByTestId('bid-page-main');
    expect(main).toHaveClass('mx-auto');
    expect(main.className).not.toMatch(/md:mx-0/);
    expect(screen.getByTestId('bid-form-card')).toHaveClass('md:text-center');

    expect(screen.getByTestId('bid-submit-bar')).toHaveClass('sticky');
  });

  test('keeps submit sticky and hides the large header on phones', () => {
    render(
      <MemoryRouter>
        <RequestBid />
      </MemoryRouter>
    );

    expect(screen.getByTestId('bid-submit-bar')).toHaveClass('sticky');
    expect(screen.getByTestId('bid-company-header')).toHaveClass('hidden');
    expect(screen.getByTestId('bid-company-header')).toHaveClass('md:block');
  });

  test('submits bid and fires Meta Lead on success without alert()', async () => {
    const fbq = jest.fn();
    window.fbq = fbq;
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    axios.post.mockResolvedValue({ data: { msg: 'Bid request submitted successfully!' } });

    render(
      <MemoryRouter>
        <RequestBid />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('Your Name *'), 'John Doe');
    await userEvent.type(screen.getByPlaceholderText('Email *'), 'john@example.com');
    await userEvent.type(screen.getByPlaceholderText(/Phone/), '9312797879');
    await userEvent.type(screen.getByPlaceholderText('Project Name *'), 'Alarm install');
    await userEvent.type(screen.getByPlaceholderText('Project Description *'), 'New build');
    await userEvent.click(screen.getByRole('button', { name: /submit bid request/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customer-bid'),
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '931-279-7879',
        })
      );
      expect(fbq).toHaveBeenCalledWith('track', 'Lead');
      expect(screen.getByTestId('form-status')).toHaveTextContent(
        /bid request submitted successfully/i
      );
    });
    expect(alertSpy).not.toHaveBeenCalled();

    delete window.fbq;
    alertSpy.mockRestore();
  });

  test('shows an inline error when the server rejects the bid', async () => {
    axios.post.mockRejectedValue({
      response: { data: { msg: 'Invalid email format' } },
    });

    render(
      <MemoryRouter>
        <RequestBid />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('Your Name *'), 'John');
    await userEvent.type(screen.getByPlaceholderText('Email *'), 'bad');
    await userEvent.type(screen.getByPlaceholderText(/Phone/), '9312797879');
    await userEvent.type(screen.getByPlaceholderText('Project Name *'), 'Alarm');
    await userEvent.type(screen.getByPlaceholderText('Project Description *'), 'Install');
    await userEvent.click(screen.getByRole('button', { name: /submit bid request/i }));

    await waitFor(() => {
      expect(screen.getByTestId('form-status')).toHaveTextContent(/invalid email format/i);
    });
  });
});
