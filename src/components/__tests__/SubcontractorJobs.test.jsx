/**
 * Subcontractor (Brinks) work-order page: list, status filter, completion number, totals.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import SubcontractorJobs from '../SubcontractorJobs';

jest.mock('axios');

const orders = [
  {
    _id: 'wo1',
    principal: 'Brinks',
    workOrderNumber: 'BRK-1001',
    completionNumber: '',
    siteName: 'Warehouse 12',
    jobType: 'service',
    status: 'assigned',
    hoursWorked: 2,
    hourlyRate: 55,
    travelPay: 20,
    equipmentLines: [{ description: 'Motion', quantity: 2, cost: 18, reimbursable: true }],
    laborPay: 110,
    equipmentTotal: 36,
    amountDue: 166,
  },
  {
    _id: 'wo2',
    principal: 'Brinks',
    workOrderNumber: 'BRK-2002',
    completionNumber: 'CL-88',
    siteName: 'Bank lobby',
    jobType: 'install',
    status: 'completed',
    hoursWorked: 1,
    hourlyRate: 40,
    travelPay: 0,
    equipmentLines: [],
    laborPay: 40,
    equipmentTotal: 0,
    amountDue: 40,
    paidAmount: 32,
    variance: -8,
    reconciliationNotes: 'Travel not paid',
  },
];

function renderPage() {
  return render(
    <BrowserRouter>
      <SubcontractorJobs />
    </BrowserRouter>
  );
}

describe('SubcontractorJobs', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
  });

  test('shows an empty state when there are no work orders', async () => {
    axios.get.mockResolvedValue({ data: [] });
    renderPage();

    expect(await screen.findByText(/no brinks work orders/i)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /subcontractor/i }).length).toBeGreaterThan(0);
  });

  test('lists work orders with completion number and amount due', async () => {
    axios.get.mockResolvedValue({ data: orders });
    renderPage();

    expect(await screen.findByText('BRK-1001')).toBeInTheDocument();
    expect(screen.getByText('Warehouse 12')).toBeInTheDocument();
    expect(screen.getByText('BRK-2002')).toBeInTheDocument();
    expect(screen.getByText('CL-88')).toBeInTheDocument();
    expect(screen.getAllByText('$166.00').length).toBeGreaterThan(0);
    expect(screen.getByText('$32.00')).toBeInTheDocument();
    expect(screen.getByText('-$8.00')).toBeInTheDocument();
  });

  test('records what Brinks actually paid against amount due', async () => {
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({ data: { _id: 'new' } });
    renderPage();
    await screen.findByText(/no brinks work orders/i);

    await userEvent.type(screen.getByLabelText(/work order/i), 'BRK-9');
    await userEvent.clear(screen.getByLabelText(/hours/i));
    await userEvent.type(screen.getByLabelText(/hours/i), '2');
    await userEvent.clear(screen.getByLabelText(/hourly rate/i));
    await userEvent.type(screen.getByLabelText(/hourly rate/i), '50');
    await userEvent.clear(screen.getByLabelText(/travel pay/i));
    await userEvent.type(screen.getByLabelText(/travel pay/i), '25');
    expect(screen.getByTestId('amount-due')).toHaveTextContent('$125.00');

    expect(screen.getByRole('heading', { name: /brinks reconciliation/i })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/paid by brinks/i), '100');
    await userEvent.type(screen.getByLabelText(/paid date/i), '2026-09-20');
    await userEvent.type(screen.getByLabelText(/reconciliation notes/i), 'Travel cut');
    expect(screen.getByTestId('reconcile-variance')).toHaveTextContent('-$25.00');

    await userEvent.click(screen.getByRole('button', { name: /save work order/i }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/subcontractor-work-orders'),
        expect.objectContaining({
          workOrderNumber: 'BRK-9',
          amountDue: 125,
          paidAmount: 100,
          variance: -25,
          reconciliationNotes: 'Travel cut',
        }),
        expect.any(Object)
      );
    });
  });

  test('filters the list by status', async () => {
    axios.get.mockResolvedValue({ data: orders });
    renderPage();
    await screen.findByText('BRK-1001');

    await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), 'completed');
    expect(screen.queryByText('BRK-1001')).not.toBeInTheDocument();
    expect(screen.getByText('BRK-2002')).toBeInTheDocument();
    expect(screen.getByText('CL-88')).toBeInTheDocument();
  });

  test('cannot mark complete without a completion number', async () => {
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({ data: { _id: 'new' } });
    renderPage();
    await screen.findByText(/no brinks work orders/i);

    await userEvent.type(screen.getByLabelText(/work order/i), 'BRK-9');
    await userEvent.selectOptions(screen.getByLabelText(/^status$/i), 'completed');
    await userEvent.click(screen.getByRole('button', { name: /save work order/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/completion/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('saves labor, travel, and reimbursable equipment totals', async () => {
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({
      data: { _id: 'new', workOrderNumber: 'BRK-9', amountDue: 95 },
    });
    renderPage();
    await screen.findByText(/no brinks work orders/i);

    await userEvent.type(screen.getByLabelText(/work order/i), 'BRK-9');
    await userEvent.type(screen.getByLabelText(/site name/i), 'Clinic');
    await userEvent.clear(screen.getByLabelText(/hours/i));
    await userEvent.type(screen.getByLabelText(/hours/i), '2');
    await userEvent.clear(screen.getByLabelText(/hourly rate/i));
    await userEvent.type(screen.getByLabelText(/hourly rate/i), '40');
    await userEvent.clear(screen.getByLabelText(/travel pay/i));
    await userEvent.type(screen.getByLabelText(/travel pay/i), '10');
    await userEvent.type(screen.getByLabelText(/equipment description/i), 'Contact');
    await userEvent.clear(screen.getByLabelText(/quantity/i));
    await userEvent.type(screen.getByLabelText(/quantity/i), '1');
    await userEvent.clear(screen.getByLabelText(/^cost$/i));
    await userEvent.type(screen.getByLabelText(/^cost$/i), '5');

    expect(screen.getByTestId('amount-due')).toHaveTextContent('$95.00');

    await userEvent.click(screen.getByRole('button', { name: /save work order/i }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/subcontractor-work-orders'),
        expect.objectContaining({
          workOrderNumber: 'BRK-9',
          hoursWorked: 2,
          hourlyRate: 40,
          travelPay: 10,
        }),
        expect.any(Object)
      );
    });
  });

  test('loads an existing work order for edit', async () => {
    axios.get.mockResolvedValue({ data: orders });
    axios.put.mockResolvedValue({ data: { ...orders[1], notes: 'Done' } });
    renderPage();
    await screen.findByText('BRK-2002');

    const row = screen.getByTestId('work-order-wo2');
    await userEvent.click(within(row).getByRole('button', { name: /edit/i }));
    expect(screen.getByLabelText(/work order/i)).toHaveValue('BRK-2002');
    expect(screen.getByLabelText(/completion/i)).toHaveValue('CL-88');

    await userEvent.type(screen.getByLabelText(/^notes$/i), 'Done');
    await userEvent.click(screen.getByRole('button', { name: /save work order/i }));
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/subcontractor-work-orders/wo2'),
        expect.objectContaining({ workOrderNumber: 'BRK-2002', completionNumber: 'CL-88' }),
        expect.any(Object)
      );
    });

    await userEvent.click(within(screen.getByTestId('work-order-wo2')).getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel edit/i }));
    expect(screen.getByLabelText(/work order/i)).toHaveValue('');
  });

  test('adds an equipment line and deletes a work order', async () => {
    axios.get.mockResolvedValue({ data: orders });
    axios.delete.mockResolvedValue({ data: { msg: 'Work order deleted' } });
    window.confirm = jest.fn(() => true);
    renderPage();
    await screen.findByText('BRK-1001');

    await userEvent.click(screen.getByRole('button', { name: /add equipment line/i }));
    expect(screen.getAllByLabelText(/equipment description/i)).toHaveLength(2);

    await userEvent.click(within(screen.getByTestId('work-order-wo1')).getByRole('button', { name: /edit/i }));
    await userEvent.click(within(screen.getByTestId('work-order-wo1')).getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/api/subcontractor-work-orders/wo1'),
        expect.any(Object)
      );
    });
  });

  test('shows a load error', async () => {
    axios.get.mockRejectedValue({ response: { data: { msg: 'Failed to load work orders' } } });
    renderPage();
    expect(await screen.findByText(/failed to load work orders/i)).toBeInTheDocument();
  });

  test('shows save errors and skips delete when cancelled', async () => {
    axios.get.mockResolvedValue({ data: orders });
    axios.post.mockRejectedValue({ response: { data: { msg: 'Failed to save work order' } } });
    axios.delete = jest.fn();
    window.confirm = jest.fn(() => false);
    renderPage();
    await screen.findByText('BRK-1001');

    await userEvent.type(screen.getByLabelText(/work order/i), 'BRK-ERR');
    await userEvent.click(screen.getByRole('button', { name: /save work order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to save work order/i);

    await userEvent.click(within(screen.getByTestId('work-order-wo1')).getByRole('button', { name: /delete/i }));
    expect(axios.delete).not.toHaveBeenCalled();
  });

  test('edits remaining fields, removes equipment, and reports delete errors', async () => {
    axios.get.mockResolvedValue({
      data: [
        {
          _id: 'wo3',
          workOrderNumber: 'BRK-3003',
          siteName: 'Depot',
          siteCity: 'Memphis',
          jobType: 'takeover',
          status: 'scheduled',
          scheduledDate: 'not-a-date',
          completedDate: '2026-09-18T00:00:00.000Z',
          hoursWorked: 0,
          notes: '',
        },
      ],
    });
    axios.delete.mockRejectedValue({ response: { data: { msg: 'Failed to delete work order' } } });
    window.confirm = jest.fn(() => true);
    renderPage();

    expect(await screen.findByText('Memphis')).toBeInTheDocument();
    await userEvent.click(within(screen.getByTestId('work-order-wo3')).getByRole('button', { name: /edit/i }));

    await userEvent.clear(screen.getByLabelText(/principal/i));
    await userEvent.type(screen.getByLabelText(/principal/i), 'ADI');
    await userEvent.type(screen.getByLabelText(/^address$/i), '9 Main');
    await userEvent.type(screen.getByLabelText(/^city$/i), 'Knoxville');
    await userEvent.selectOptions(screen.getByLabelText(/job type/i), 'other');
    await userEvent.type(screen.getByLabelText(/scheduled date/i), '2026-09-21');
    await userEvent.type(screen.getByLabelText(/completed date/i), '2026-09-22');
    await userEvent.type(screen.getByLabelText(/^sku$/i), 'SKU-1');
    await userEvent.click(screen.getByLabelText(/reimbursable/i));
    await userEvent.click(screen.getByRole('button', { name: /add equipment line/i }));
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[1]);
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.getAllByLabelText(/equipment description/i)).toHaveLength(1);

    await userEvent.click(within(screen.getByTestId('work-order-wo3')).getByRole('button', { name: /delete/i }));
    expect(await screen.findByText(/failed to delete work order/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work order/i)).toHaveValue('BRK-3003');
  });
});
