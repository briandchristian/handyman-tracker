/**
 * Staff page for one customer: contact, job tickets, bids, and projects.
 * Earlier combined records stay linked. A bid is not a job.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import CustomerDetail from '../CustomerDetail';

jest.mock('axios');
jest.mock('jspdf', () => ({
  jsPDF: jest.fn(),
}));

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
  await waitFor(() => {
    expect(screen.queryByText(/loading customer/i)).not.toBeInTheDocument();
  });
  if (!screen.queryByRole('heading', { name: 'John Doe' })) return view;
  for (const name of ['Jobs', 'Bids', 'Projects']) {
    const button = screen.queryByRole('button', { name });
    if (button?.getAttribute('aria-expanded') === 'false') fireEvent.click(button);
  }
  return view;
}

describe('CustomerDetail', () => {
  let mockPdfDoc;
  let OriginalImage;

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
    global.alert = jest.fn();
    global.confirm = jest.fn(() => true);
    axios.get.mockResolvedValue({ data: customer });
    global.URL.createObjectURL = jest.fn(() => 'blob:bid-pdf-url');
    window.open = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    mockPdfDoc = {
      internal: {
        pageSize: {
          getWidth: jest.fn(() => 210),
          getHeight: jest.fn(() => 800),
        },
      },
      setFontSize: jest.fn(),
      setFont: jest.fn(),
      setFillColor: jest.fn(),
      setDrawColor: jest.fn(),
      setTextColor: jest.fn(),
      text: jest.fn(),
      line: jest.fn(),
      rect: jest.fn(),
      addPage: jest.fn(),
      addImage: jest.fn(),
      splitTextToSize: jest.fn((value) => [String(value)]),
      output: jest.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
    };
    jsPDF.mockImplementation(() => mockPdfDoc);
    OriginalImage = global.Image;
    global.Image = class {
      constructor() {
        this.naturalWidth = 0;
        this.naturalHeight = 0;
      }

      set src(_) {
        if (this.onerror) this.onerror(new Error('mock image load error'));
      }
    };
  });

  afterEach(() => {
    global.Image = OriginalImage;
  });

  test('loads contact and keeps jobs, bids, and projects in separate lists', async () => {
    await renderPage();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1'),
        expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
      );
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Contact' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Job number')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Quote number')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bids' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Projects' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add project' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument();

    const job = screen.getByTestId('job-ticket-j1');
    expect(job).toHaveTextContent('J-2001 · Replace keypad');
    expect(job).toHaveTextContent('$160.00');
    expect(job).toHaveTextContent('$100.00');
    expect(within(job).queryByRole('link', { name: 'Open' })).not.toBeInTheDocument();

    const bid = screen.getByTestId('bid-row-b1');
    expect(bid).toHaveTextContent('Q-1001 · Cameras and access');
    expect(within(bid).getByRole('heading', { name: 'Q-1001 · Cameras and access' })).not.toHaveClass('text-green-700');
    expect(bid).toHaveTextContent('declined');
    expect(bid).toHaveTextContent('$9,100.00');
    expect(bid).not.toHaveTextContent('Amount due');

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

  test('creates a draft purchase order from the job lines', async () => {
    const jobCustomer = {
      ...customer,
      serviceJobs: [{
        ...customer.serviceJobs[0],
        chargeLines: [
          { description: 'Switch', sku: 'SW-1', quantity: 1, price: 500, paid: 180 },
        ],
      }],
    };
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/suppliers')) {
        return Promise.resolve({ data: { suppliers: [{ _id: 's1', name: 'ADI' }] } });
      }
      return Promise.resolve({ data: jobCustomer });
    });
    axios.post.mockResolvedValue({ data: { _id: 'po1', poNumber: 'PO-2026-0004' } });
    await renderPage();

    const job = screen.getByTestId('job-ticket-j1');
    await userEvent.click(within(job).getByRole('button', { name: 'Create PO' }));
    await userEvent.selectOptions(await within(job).findByLabelText('PO supplier'), 's1');
    await userEvent.click(within(job).getByRole('button', { name: 'Create purchase order' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/purchase-orders'),
        expect.objectContaining({
          supplier: 's1',
          status: 'Draft',
          items: [expect.objectContaining({
            sku: 'SW-1',
            description: 'Switch',
            quantity: 1,
            unitPrice: 180,
            total: 180,
          })],
          notes: expect.stringContaining('J-2001'),
        }),
        expect.any(Object)
      );
    });
    expect(await within(job).findByRole('link', { name: 'PO-2026-0004' })).toHaveAttribute('href', '/purchase-orders');
  });

  test('edits a job as one list of lines with price and optional cost', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        serviceJobs: [{
          ...customer.serviceJobs[0],
          chargeLines: [{ description: 'Switch', quantity: 1, price: 500 }],
          parts: [{ description: 'Hub', sku: 'Q9', quantity: 1, paid: 265, sold: 328 }],
        }],
      },
    });
    axios.put.mockResolvedValue({ data: { _id: 'j1' } });
    await renderPage();

    const job = await screen.findByTestId('job-ticket-j1');
    await userEvent.click(within(job).getByRole('button', { name: 'Edit' }));
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Parts used' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lines' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Switch')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hub')).toBeInTheDocument();
    expect(screen.getByDisplayValue('328')).toBeInTheDocument();
    expect(screen.getByDisplayValue('265')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save job' }));
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/service-jobs/j1'),
        expect.objectContaining({
          parts: [],
          chargeLines: expect.arrayContaining([
            expect.objectContaining({ description: 'Switch', price: 500 }),
            expect.objectContaining({ description: 'Hub', price: 328, paid: 265, sku: 'Q9' }),
          ]),
        }),
        expect.any(Object)
      );
      expect(axios.put.mock.calls.at(-1)[1]).not.toHaveProperty('notes');
    });
  });

  test('drags a quick pick above or below another and leaves the dropdown in name order', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({
          data: {
            quickPicks: [
              { _id: 'sw', description: 'Switch', sku: 'SW-1', price: 10, paid: 4, sortOrder: 0 },
              { _id: 'rl', description: 'Relay', sku: 'RL-1', price: 8, paid: 3, sortOrder: 1 },
            ],
          },
        });
      }
      return Promise.resolve({ data: customer });
    });
    axios.put.mockResolvedValue({ data: { quickPicks: [] } });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));

    const picks = await screen.findByRole('list', { name: 'Quick picks' });
    const rows = within(picks).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent).join(' ')).toMatch(/Switch.*Relay/);

    const dropdown = screen.getByLabelText('Quick pick');
    expect(within(dropdown).getAllByRole('option').map((option) => option.textContent).join(' ')).toMatch(/Relay.*Switch/);

    const dataTransfer = {
      data: {},
      setData(type, value) { this.data[type] = value; },
      getData(type) { return this.data[type] || ''; },
    };
    rows[0].getBoundingClientRect = () => ({
      top: 0, left: 0, bottom: 48, right: 320, width: 320, height: 48, x: 0, y: 0, toJSON() { return {}; },
    });
    fireEvent.dragStart(rows[1], { dataTransfer });
    fireEvent.dragOver(rows[0], { dataTransfer, clientY: 8 });
    fireEvent.drop(rows[0], { dataTransfer, clientY: 8 });

    expect(within(picks).getAllByRole('listitem').map((row) => row.textContent).join(' ')).toMatch(/Relay.*Switch/);
    expect(within(dropdown).getAllByRole('option').map((option) => option.textContent).join(' ')).toMatch(/Relay.*Switch/);
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/quick-picks/order'),
        { ids: ['rl', 'sw'] },
        expect.any(Object)
      );
    });
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
  });

  test('adds a saved part onto a job line from the quick pick list', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({
          data: {
            quickPicks: [{
              _id: 'qp1',
              description: 'Switch',
              sku: 'SW-1',
              price: 500,
              paid: 180,
            }],
          },
        });
      }
      return Promise.resolve({ data: customer });
    });
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
    expect(await screen.findByRole('option', { name: /Switch · SW-1/ })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Quick pick'), 'qp1');

    expect(screen.getByLabelText('Line description')).toHaveValue('Switch');
    expect(screen.getByLabelText('SKU')).toHaveValue('SW-1');
    expect(screen.getByLabelText('Line quantity')).toHaveValue(1);
    expect(screen.getByLabelText('Price')).toHaveValue(500);
    expect(screen.getByLabelText('Line paid')).toHaveValue(180);
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
  });

  test('fills price with line paid plus 30 percent and updates it when paid changes', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({ data: { quickPicks: [] } });
      }
      return Promise.resolve({ data: customer });
    });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));

    await userEvent.type(screen.getByLabelText('Line paid'), '100');
    expect(screen.getByLabelText('Price')).toHaveValue(130);

    await userEvent.clear(screen.getByLabelText('Price'));
    await userEvent.type(screen.getByLabelText('Price'), '150');
    expect(screen.getByLabelText('Price')).toHaveValue(150);
    expect(screen.getByLabelText('Line paid')).toHaveValue(100);

    await userEvent.clear(screen.getByLabelText('Line paid'));
    expect(screen.getByLabelText('Price')).toHaveValue(150);
    await userEvent.type(screen.getByLabelText('Line paid'), '200');
    expect(screen.getByLabelText('Price')).toHaveValue(260);

    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
  });

  test('saves a job line onto the quick pick list', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({ data: { quickPicks: [] } });
      }
      return Promise.resolve({ data: customer });
    });
    axios.post.mockImplementation((url) => {
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({
          data: {
            _id: 'qp2',
            description: 'Relay',
            sku: 'RL-1',
            price: 40,
            paid: 22,
          },
        });
      }
      return Promise.resolve({ data: { _id: 'j2' } });
    });
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
    await userEvent.type(screen.getByLabelText('Line description'), 'Relay');
    await userEvent.type(screen.getByLabelText('SKU'), 'RL-1');
    await userEvent.type(screen.getByLabelText('Line paid'), '22');
    await userEvent.clear(screen.getByLabelText('Price'));
    await userEvent.type(screen.getByLabelText('Price'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Save to Quick Pick' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/quick-picks'),
        { description: 'Relay', sku: 'RL-1', price: '40', paid: '22' },
        expect.any(Object)
      );
    });
    expect(await screen.findByRole('option', { name: /Relay · RL-1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove quick pick' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved to Quick Pick');
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
  });

  test('shows whether a quick pick is missing, out of stock, or on the shelf', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/inventory')) {
        return Promise.resolve({
          data: [
            { _id: 'stocked', name: 'Contact', sku: 'DC-1', currentStock: 4 },
            { _id: 'empty', name: 'Relay', sku: 'RL-1', currentStock: 0 },
          ],
        });
      }
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({
          data: {
            quickPicks: [
              { _id: 'missing', description: 'Keypad', sku: 'KP-1', price: 85, paid: 40 },
              { _id: 'empty-pick', description: 'Relay', sku: 'RL-1', price: 40, paid: 22 },
              { _id: 'stocked-pick', description: 'Contact', sku: 'DC-1', price: 32, paid: 14 },
            ],
          },
        });
      }
      return Promise.resolve({ data: customer });
    });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));

    const picks = await screen.findByRole('list', { name: 'Quick picks' });
    expect(within(picks).getByText('Not in inventory')).toBeInTheDocument();
    expect(within(picks).getByText('Out of stock')).toBeInTheDocument();
    expect(within(picks).getByText('In stock, 4 on hand')).toBeInTheDocument();

    await userEvent.click(within(picks).getByRole('button', { name: 'Add Contact to the line' }));
    expect(screen.getByLabelText('Inventory')).toHaveValue('draw');
    expect(screen.getByLabelText('Line description')).toHaveValue('Contact');
    expect(screen.getByLabelText('Line quantity')).toHaveValue(1);

    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
  });

  test('adds a quick pick that is not in inventory yet', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/inventory')) return Promise.resolve({ data: [] });
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({
          data: { quickPicks: [{ _id: 'qp1', description: 'Switch', sku: 'SW-1', price: 500, paid: 180 }] },
        });
      }
      return Promise.resolve({ data: customer });
    });
    axios.post.mockImplementation((url) => {
      if (String(url).includes('/api/inventory')) {
        return Promise.resolve({ data: { _id: 'item9', name: 'Switch', sku: 'SW-1', currentStock: 0 } });
      }
      return Promise.resolve({ data: { _id: 'j2' } });
    });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add to inventory' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/inventory'),
        expect.objectContaining({ name: 'Switch', sku: 'SW-1', currentStock: 0, lastPrice: 180 }),
        expect.any(Object)
      );
    });
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
  });

  test('saves a line kept in inventory for the selected supplier', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/suppliers')) {
        return Promise.resolve({ data: { suppliers: [{ _id: 's1', name: 'Wave Electronics' }] } });
      }
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({ data: { quickPicks: [] } });
      }
      return Promise.resolve({ data: customer });
    });
    axios.post.mockResolvedValue({ data: { _id: 'j2' } });
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
    await userEvent.type(screen.getByLabelText('Job name'), 'Cameras');
    await userEvent.type(screen.getByLabelText('Line description'), 'Switch');
    await userEvent.type(screen.getByLabelText('SKU'), 'SW-1');
    await userEvent.type(screen.getByLabelText('Line quantity'), '2');
    await userEvent.type(screen.getByLabelText('Line paid'), '180');
    expect(screen.getByRole('option', { name: 'Use on this job' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Inventory'), 'stock');
    expect(await screen.findByRole('option', { name: 'Wave Electronics' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Supplier'), 's1');
    await userEvent.click(screen.getByRole('button', { name: 'Add job' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/service-jobs'),
        expect.objectContaining({
          name: 'Cameras',
          chargeLines: [expect.objectContaining({
            description: 'Switch',
            sku: 'SW-1',
            quantity: '2',
            paid: '180',
            inventoryDisposition: 'stock',
            supplierId: 's1',
          })],
        }),
        expect.any(Object)
      );
    });
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
  });

  test('stacks the job editor in sections with the same fields as the bid form', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));

    const form = screen.getByRole('form', { name: 'Job ticket' });
    expect(within(form).getByRole('heading', { name: 'Job' })).toBeInTheDocument();
    expect(within(form).getByRole('heading', { name: 'Site' })).toBeInTheDocument();
    expect(within(form).getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(within(form).getByRole('heading', { name: 'Lines' })).toBeInTheDocument();
    expect(screen.getByLabelText('Job name')).toHaveClass('field');
    expect(screen.getByLabelText('Line description')).toHaveClass('field');
    expect(screen.getByLabelText('Line description').closest('.rounded-2xl')).toHaveClass('border-emerald-200', 'shadow-md');
    expect(form.querySelector('.grid-cols-12')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
  });

  test('adds a job ticket with a charge line and does not post it as a bid', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'j2' } });
    await renderPage();

    await screen.findByText('John Doe');
    await userEvent.click(screen.getByRole('button', { name: 'New job' }));
    await userEvent.type(screen.getByLabelText('Job name'), 'Panel service');
    await userEvent.type(screen.getByLabelText('Line description'), 'Keypad');
    await userEvent.type(screen.getByLabelText('Line quantity'), '1');
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

  test('shows saved bid lines beside the quoted amount and prints the bid document', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        bids: [
          {
            ...customer.bids[0],
            description: 'Four outdoor cameras',
            linesTotal: 7200,
            lines: [{ description: 'Quoted camera', quantity: 4, estimate: 1800 }],
          },
        ],
      },
    });
    await renderPage();

    const bid = await screen.findByTestId('bid-row-b1');
    expect(bid).toHaveTextContent('Quoted camera');
    expect(bid).toHaveTextContent('4');
    expect(bid).toHaveTextContent('$1,800.00');
    expect(bid).toHaveTextContent('$7,200.00');
    expect(bid).not.toHaveTextContent('$9,100.00');
    expect(bid).not.toHaveTextContent('Amount due');

    await userEvent.click(within(bid).getByRole('checkbox', { name: /include monitoring agreement/i }));
    await userEvent.click(within(bid).getByRole('button', { name: /^generate bid$/i }));

    await waitFor(() => {
      expect(jsPDF).toHaveBeenCalled();
      expect(window.open).toHaveBeenCalledWith('blob:bid-pdf-url', '_blank');
    });
    expect(global.fetch).toHaveBeenCalledWith('/ALARM MONITORING SERVICES AGREEMENT.docx');
    const printed = mockPdfDoc.text.mock.calls.map(([line]) => line).filter((line) => typeof line === 'string');
    expect(printed.some((line) => line.includes('Quote #: Q-1001'))).toBe(true);
    expect(printed).toContain('Bid: John Doe');
    expect(printed).toContain('Project: Cameras and access');
    expect(printed).toContain('Description: Four outdoor cameras');
    expect(printed).toContain('Quoted camera');
    expect(printed).toContain('Bid Amount: $7200.00');
    expect(printed).toContain("What's Included:");
    expect(printed.some((line) => String(line).includes('1800'))).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('a job linked to a bid shows that bid quoted amount', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        serviceJobs: [{
          ...customer.serviceJobs[0],
          bidId: 'b1',
        }],
      },
    });

    await renderPage();
    const job = screen.getByTestId('job-ticket-j1');
    expect(job).toHaveTextContent('Quoted $9,100.00');
    expect(job).toHaveTextContent('Q-1001');
  });

  test('adds a note on a job without opening the project', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        serviceJobs: [{
          ...customer.serviceJobs[0],
          notes: 'Gate code is 1234',
        }],
      },
    });
    axios.post.mockResolvedValue({ data: [] });
    await renderPage();

    const job = screen.getByTestId('job-ticket-j1');
    expect(job).toHaveTextContent('Gate code is 1234');
    await userEvent.type(within(job).getByLabelText('Note for J-2001'), 'Dog in the yard');
    await userEvent.click(within(job).getByRole('button', { name: 'Add note' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/service-jobs/j1/notes'),
        { text: 'Dog in the yard' },
        expect.any(Object)
      );
    });
  });

  test('shows a bid in green once a job is linked to it', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        serviceJobs: [{
          ...customer.serviceJobs[0],
          bidId: 'b1',
        }],
      },
    });

    await renderPage();
    const bid = await screen.findByTestId('bid-row-b1');
    const title = within(bid).getByRole('heading', { name: 'Q-1001 · Cameras and access' });
    expect(title).toHaveClass('text-green-700');
    expect(bid).toHaveTextContent('On job J-2001');
  });

  test('imports a bid into a job and marks the bid accepted', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        bids: [{
          _id: 'b1',
          name: 'Cameras and access',
          quoteNumber: 'Q-1001',
          status: 'sent',
          description: 'Four outdoor cameras',
          planId: 'plan1',
          quotedAmount: 9100,
          lines: [{ description: 'Quoted camera', quantity: 4, estimate: 1800 }],
        }],
      },
    });
    axios.post.mockResolvedValue({ data: { _id: 'j9' } });
    axios.put.mockResolvedValue({ data: { status: 'accepted' } });

    await renderPage();
    const bid = await screen.findByTestId('bid-row-b1');
    await userEvent.click(within(bid).getByRole('button', { name: /import into job/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/service-jobs'),
        expect.objectContaining({
          name: 'Cameras and access',
          bidId: 'b1',
          planId: 'plan1',
          notes: [{ text: 'Four outdoor cameras' }],
          chargeLines: [expect.objectContaining({
            description: 'Quoted camera',
            quantity: 4,
            price: 1800,
          })],
        }),
        expect.any(Object)
      );
    });
    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('/api/customers/c1/bids/b1'),
      expect.objectContaining({ status: 'accepted' }),
      expect.any(Object)
    );
  });

  test('adds a quick pick onto a bid line as the description and estimate', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/quick-picks')) {
        return Promise.resolve({
          data: {
            quickPicks: [{
              _id: 'qp1',
              description: 'Switch',
              sku: 'SW-1',
              price: 500,
              paid: 180,
            }],
          },
        });
      }
      return Promise.resolve({ data: customer });
    });
    axios.post.mockResolvedValue({ data: { _id: 'b2' } });
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add bid' }));
    const bid = screen.getByRole('form', { name: 'Bid' });
    expect(await within(bid).findByRole('option', { name: /Switch · SW-1/ })).toBeInTheDocument();
    await userEvent.selectOptions(within(bid).getByLabelText('Bid quick pick'), 'qp1');

    expect(within(bid).getByLabelText('Bid line description')).toHaveValue('Switch');
    expect(within(bid).getByLabelText('Bid quantity')).toHaveValue(1);
    expect(within(bid).getByLabelText('Estimate')).toHaveValue(500);
    expect(within(bid).getByLabelText('Estimate')).not.toHaveValue(180);

    await userEvent.type(screen.getByLabelText('Bid name'), 'Cameras');
    await userEvent.click(screen.getByRole('button', { name: 'Save bid' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/bids'),
        expect.objectContaining({
          name: 'Cameras',
          lines: [expect.objectContaining({ description: 'Switch', quantity: 1, estimate: 500 })],
        }),
        expect.any(Object)
      );
    });
  });

  test('removes a bid line and leaves a blank line when it was the last one', async () => {
    axios.get.mockResolvedValue({
      data: {
        ...customer,
        bids: [{
          ...customer.bids[0],
          lines: [
            { description: 'Quoted camera', quantity: 4, estimate: 1800 },
            { description: 'Keypad', quantity: 1, estimate: 85 },
          ],
        }],
      },
    });
    axios.put.mockResolvedValue({ data: { _id: 'b1' } });
    await renderPage();

    const row = await screen.findByTestId('bid-row-b1');
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Bid' });

    expect(within(form).getAllByLabelText('Bid line description')).toHaveLength(2);
    await userEvent.click(within(form).getAllByRole('button', { name: 'Remove bid line' })[0]);

    expect(within(form).getAllByLabelText('Bid line description')).toHaveLength(1);
    expect(within(form).getByLabelText('Bid line description')).toHaveValue('Keypad');
    expect(within(form).queryByDisplayValue('Quoted camera')).not.toBeInTheDocument();

    await userEvent.click(within(form).getByRole('button', { name: 'Remove bid line' }));
    expect(within(form).getByLabelText('Bid line description')).toHaveValue('');
    expect(within(form).getAllByLabelText('Bid line description')).toHaveLength(1);
  });

  test('quoted amount is the sum of each line quantity times its estimate', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'b2' } });
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add bid' }));
    const form = screen.getByRole('form', { name: 'Bid' });
    await userEvent.type(within(form).getByLabelText('Bid line description'), 'Camera');
    await userEvent.type(within(form).getByLabelText('Bid quantity'), '4');
    await userEvent.type(within(form).getByLabelText('Estimate'), '1800');
    expect(within(form).getByLabelText('Quoted amount')).toHaveValue(7200);

    await userEvent.click(within(form).getByRole('button', { name: 'Add bid line' }));
    const descriptions = within(form).getAllByLabelText('Bid line description');
    const quantities = within(form).getAllByLabelText('Bid quantity');
    const estimates = within(form).getAllByLabelText('Estimate');
    await userEvent.type(descriptions[1], 'Keypad');
    await userEvent.type(quantities[1], '1');
    await userEvent.type(estimates[1], '50');
    expect(within(form).getByLabelText('Quoted amount')).toHaveValue(7250);

    await userEvent.click(within(form).getAllByRole('button', { name: 'Remove bid line' })[1]);
    expect(within(form).getByLabelText('Quoted amount')).toHaveValue(7200);

    await userEvent.type(within(form).getByLabelText('Bid name'), 'Cameras');
    await userEvent.click(within(form).getByRole('button', { name: 'Save bid' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/bids'),
        expect.objectContaining({
          name: 'Cameras',
          quotedAmount: 7200,
          lines: [
            expect.objectContaining({ description: 'Camera', quantity: '4', estimate: '1800' }),
          ],
        }),
        expect.any(Object)
      );
    });
  });

  test('adds a bid without creating a job', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'b2' } });
    await renderPage();

    await screen.findByRole('heading', { name: 'Bids' });
    await userEvent.click(screen.getByRole('button', { name: 'Add bid' }));
    await userEvent.type(screen.getByLabelText('Bid name'), 'Cameras');
    expect(screen.getByLabelText('Quoted amount')).toHaveValue(0);
    await userEvent.selectOptions(screen.getByLabelText('Bid status'), 'declined');
    await userEvent.click(screen.getByRole('button', { name: 'Save bid' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/c1/bids'),
        expect.objectContaining({
          name: 'Cameras',
          quotedAmount: 0,
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
