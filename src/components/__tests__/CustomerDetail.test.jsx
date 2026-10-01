/**
 * Staff page for one customer: edit contact, and add, edit, open, or remove jobs.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
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
      description: 'Cameras',
      workType: 'installation',
      bidAmount: 250,
      materials: [{ item: 'Camera' }],
      payments: [],
    },
    {
      _id: 'p2',
      name: 'Panel',
      jobNumber: 'J-1002',
      status: 'Scheduled',
      description: '',
      workType: 'service',
      materials: [],
      bidMaterials: [],
      payments: [],
      paidToDate: 0,
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/customers/c1']}>
      <Routes>
        <Route path="/customers/:customerId" element={<CustomerDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CustomerDetail', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
    global.alert = jest.fn();
    global.confirm = jest.fn(() => true);
    axios.get.mockResolvedValue({ data: customer });
  });

  test('loads the customer and lists each job', async () => {
    renderPage();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1'),
        expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
      );
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
    expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByTestId('job-row-p1')).toHaveTextContent('J-1001 · Kitchen Remodel');
    expect(screen.getByTestId('job-row-p2')).toHaveTextContent('J-1002 · Panel');
    expect(within(screen.getByTestId('job-row-p1')).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/projects/c1/p1'
    );
    expect(screen.queryByText('Obtained from the Request a Bid page')).not.toBeInTheDocument();
  });

  test('notes when this customer was obtained from the Request a Bid page', async () => {
    axios.get.mockResolvedValue({ data: { ...customer, obtainedVia: 'hero-bid' } });
    renderPage();
    expect(await screen.findByText('Obtained from the Request a Bid page')).toBeInTheDocument();
  });

  test('saves edited email and phone, including a cleared email', async () => {
    axios.put.mockResolvedValue({ data: customer });
    renderPage();

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

  test('adds a job for this customer without searching again', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'p3', name: 'Alarm install' } });
    renderPage();

    await screen.findByText('John Doe');
    await userEvent.type(screen.getByLabelText('Job name'), 'Alarm install');
    await userEvent.click(screen.getByRole('checkbox', { name: /Fire Alarm/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /CCTV/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Add job' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/projects'),
        expect.objectContaining({
          name: 'Alarm install',
          status: 'Pending',
          equipmentCategories: {
            burglarAlarm: false,
            fireAlarm: true,
            accessControl: false,
            cctv: true,
            monitoring: false,
          },
        }),
        expect.any(Object)
      );
    });
  });

  test('edits a job name and work type', async () => {
    axios.put.mockResolvedValue({ data: { msg: 'Project updated' } });
    renderPage();

    const row = await screen.findByTestId('job-row-p2');
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    const name = within(row).getByLabelText('Job name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Panel service');
    await userEvent.selectOptions(within(row).getByLabelText('Work type'), 'service');
    await userEvent.click(within(row).getByRole('button', { name: 'Save job' }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/projects/p2'),
        expect.objectContaining({
          name: 'Panel service',
          jobNumber: 'J-1002',
          workType: 'service',
        }),
        expect.any(Object)
      );
    });
  });

  test('warns before removing a job that already has materials', async () => {
    axios.delete.mockResolvedValue({ data: { msg: 'Project deleted' } });
    renderPage();

    const row = await screen.findByTestId('job-row-p1');
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    expect(global.confirm).toHaveBeenCalledWith(expect.stringMatching(/materials/i));
    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/projects/p1'),
        expect.any(Object)
      );
    });
  });

  test('does not remove a job when the confirmation is cancelled', async () => {
    global.confirm.mockReturnValue(false);
    renderPage();

    const row = await screen.findByTestId('job-row-p2');
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    expect(global.confirm).toHaveBeenCalledWith('Remove J-1002 · Panel?');
    expect(axios.delete).not.toHaveBeenCalled();
  });

  test('shows a not-found message when the customer does not exist', async () => {
    axios.get.mockRejectedValue({ response: { status: 404, data: { msg: 'Customer not found' } } });
    renderPage();

    expect(await screen.findByText(/customer not found/i)).toBeInTheDocument();
  });
});
