/**
 * Staff page for one customer: contact, job tickets, bids, and projects.
 * Earlier combined records stay linked. A bid is not a job.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import CustomerDetail from '../CustomerDetail';

jest.mock('axios');

const customer = {
  _id: 'c1',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '555-123-4567',
  address: '123 Main St',
  accountNumber: 'A-1001',
  projects: [
    {
      _id: 'p1',
      name: 'Kitchen Remodel',
      jobNumber: 'J-1001',
      status: 'Pending',
      bidAmount: 250,
    },
  ],
  serviceJobs: [
    {
      _id: 'j1',
      name: 'Replace keypad',
      jobNumber: 'J-2001',
      status: 'invoiced',
      workType: 'service',
      amountDue: 160,
      paidAmount: 100,
      variance: -60,
      chargeLines: [{ description: 'Keypad', quantity: 1, price: 85 }],
    },
  ],
  bids: [
    {
      _id: 'b1',
      name: 'Cameras and access',
      quoteNumber: 'Q-1001',
      status: 'declined',
      quotedAmount: 9100,
    },
  ],
  plans: [
    {
      _id: 'plan1',
      name: 'Building security',
      description: 'Phased install',
    },
  ],
};

async function renderPage() {
  const view = render(
    <MemoryRouter initialEntries={['/customers/c1']}>
      <Routes>
        <Route path="/customers/:customerId" element={<CustomerDetail />} />
      </Routes>
    </MemoryRouter>
  );
  const contact = await screen.findByRole('button', { name: 'Contact' }).catch(() => null);
  if (!contact) return view;
  for (const name of ['Contact', 'Jobs', 'Bids', 'Projects']) {
    const button = screen.queryByRole('button', { name });
    if (button?.getAttribute('aria-expanded') === 'false') fireEvent.click(button);
  }
  return view;
}

describe('CustomerDetail', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
    global.alert = jest.fn();
    global.confirm = jest.fn(() => true);
    axios.get.mockResolvedValue({ data: customer });
  });

  test('loads contact and keeps jobs, bids, and projects in separate lists', async () => {
    await renderPage();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1'),
        expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
      );
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Job number')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Quote number')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bids' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();

    const job = screen.getByTestId('job-ticket-j1');
    expect(job).toHaveTextContent('J-2001 · Replace keypad');
    expect(job).toHaveTextContent('$160.00');
    expect(job).toHaveTextContent('$100.00');
    expect(within(job).queryByRole('link', { name: 'Open' })).not.toBeInTheDocument();

    const bid = screen.getByTestId('bid-row-b1');
    expect(bid).toHaveTextContent('Q-1001 · Cameras and access');
    expect(bid).toHaveTextContent('declined');
    expect(bid).toHaveTextContent('$9,100.00');
    expect(bid).not.toHaveTextContent('Amount due');

    expect(screen.getByTestId('plan-row-plan1')).toHaveTextContent('Building security');
    await userEvent.click(screen.getByRole('button', { name: 'Earlier job records' }));
    const earlier = screen.getByTestId('earlier-job-p1');
    expect(within(earlier).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/projects/c1/p1');
  });

  test('notes when this customer was obtained from the Request a Bid page', async () => {
    axios.get.mockResolvedValue({ data: { ...customer, obtainedVia: 'hero-bid' } });
    await renderPage();
    expect(await screen.findByText('Obtained from the Request a Bid page')).toBeInTheDocument();
  });

  test('saves edited email and phone, including a cleared email', async () => {
    axios.put.mockResolvedValue({ data: customer });
    await renderPage();

    await screen.findByText('john@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Edit contact' }));

    const email = screen.getByLabelText('Email');
    await userEvent.clear(email);
    await userEvent.type(email, 'new@example.com');
    const phone = screen.getByLabelText('Phone');
    await userEvent.clear(phone);
    await userEvent.type(phone, '9312797879');

    await userEvent.click(screen.getByRole('button', { name: 'Save contact' }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1'),
        expect.objectContaining({
          name: 'John Doe',
          email: 'new@example.com',
          phone: '931-279-7879',
          address: '123 Main St',
          accountNumber: 'A-1001',
        }),
        expect.any(Object)
      );
    });
  });

  test('adds a job ticket with a charge line and does not post it as a bid', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'j2' } });
    await renderPage();

    await screen.findByText('John Doe');
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
    await userEvent.type(screen.getByLabelText('Job name'), 'Panel service');
    await userEvent.type(screen.getByLabelText('Charge description'), 'Keypad');
    await userEvent.type(screen.getByLabelText('Charge quantity'), '1');
    await userEvent.type(screen.getByLabelText('Price'), '85');
    await userEvent.click(screen.getByRole('button', { name: 'Add job' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/service-jobs'),
        expect.objectContaining({
          name: 'Panel service',
          chargeLines: [expect.objectContaining({ description: 'Keypad', quantity: '1', price: '85' })],
        }),
        expect.any(Object)
      );
    });
    expect(axios.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/bids'),
      expect.anything(),
      expect.anything()
    );
  });

  test('adds a bid without creating a job', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'b2' } });
    await renderPage();

    await screen.findByRole('heading', { name: 'Bids' });
    await userEvent.click(screen.getByRole('button', { name: 'Add bid' }));
    await userEvent.type(screen.getByLabelText('Bid name'), 'Cameras');
    await userEvent.type(screen.getByLabelText('Quoted amount'), '9100');
    await userEvent.selectOptions(screen.getByLabelText('Bid status'), 'declined');
    await userEvent.click(screen.getByRole('button', { name: 'Save bid' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/bids'),
        expect.objectContaining({
          name: 'Cameras',
          quotedAmount: '9100',
          status: 'declined',
        }),
        expect.any(Object)
      );
    });
    expect(axios.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/service-jobs'),
      expect.anything(),
      expect.anything()
    );
  });

  test('Paid filter keeps a ticket that has a recorded payment', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        serviceJobs: [
          customer.serviceJobs[0],
          {
            _id: 'j2',
            name: 'Open service',
            jobNumber: 'J-2002',
            status: 'scheduled',
            workType: 'service',
            amountDue: 40,
            paidAmount: null,
          },
        ],
      },
    });
    await renderPage();

    await screen.findByTestId('job-ticket-j2');
    await userEvent.selectOptions(screen.getByLabelText('Job status'), 'paid');

    expect(screen.getByTestId('job-ticket-j1')).toBeInTheDocument();
    expect(screen.queryByTestId('job-ticket-j2')).not.toBeInTheDocument();
  });

  test('lists people on a business and keeps them off a private individual', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        kind: 'business',
        people: [{ _id: 'person1', name: 'Ada Owner', role: 'Owner', phone: '931-279-7879' }],
      },
    });
    await renderPage();

    expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'People' }));
    expect(screen.getByText('Ada Owner')).toBeInTheDocument();
    expect(screen.getAllByText('Business').length).toBeGreaterThan(0);
  });

  test('a private individual is the person and their home', async () => {
    axios.get.mockResolvedValue({ data: { ...customer, kind: 'individual', people: [] } });
    await renderPage();

    expect(await screen.findByText('Private individual')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'People' })).not.toBeInTheDocument();
  });

  test('adds a person to a business', async () => {
    axios.get.mockResolvedValue({ data: { ...customer, kind: 'business', people: [] } });
    axios.post.mockResolvedValue({ data: { _id: 'person2', name: 'Ada Owner' } });
    await renderPage();

    await screen.findByRole('heading', { name: 'People' });
    await userEvent.click(screen.getByRole('button', { name: 'People' }));
    await userEvent.click(screen.getByRole('button', { name: 'New person' }));
    await userEvent.type(screen.getByLabelText('Person name'), 'Ada Owner');
    await userEvent.type(screen.getByLabelText('Role'), 'Owner');
    await userEvent.click(screen.getByRole('button', { name: 'Add person' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/people'),
        expect.objectContaining({ name: 'Ada Owner', role: 'Owner' }),
        expect.any(Object)
      );
    });
  });

  test('shows a not-found message when the customer does not exist', async () => {
    axios.get.mockRejectedValue({ response: { status: 404, data: { msg: 'Customer not found' } } });
    await renderPage();

    expect(await screen.findByText(/customer not found/i)).toBeInTheDocument();
  });
});
