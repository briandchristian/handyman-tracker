import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Accounting from '../Accounting';
import { currentMonthRange } from '../../../server/lib/dateRange.js';

jest.mock('axios');

async function renderAccounting(ui = (
  <BrowserRouter>
    <Accounting />
  </BrowserRouter>
)) {
  const view = render(ui);
  const period = await screen.findByRole('button', { name: 'Period' }).catch(() => null);
  if (!period) return view;
  for (const name of ['Period', 'Checking account', 'Period P&L lite', 'Indirect by cost center', 'Period ledger', 'Job profit']) {
    const button = screen.queryByRole('button', { name });
    if (button?.getAttribute('aria-expanded') === 'false') fireEvent.click(button);
  }
  return view;
}

describe('Accounting', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
  });

  test('saves a note on a checking line without categorizing it', async () => {
    axios.get.mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/accounting/checking-lines')) {
        return Promise.resolve({
          data: [{
            _id: 'line1',
            postedDate: '2024-01-15T12:00:00.000Z',
            description: 'SHELL OIL',
            amount: -45.2,
            status: 'uncategorized',
            note: '',
          }],
        });
      }
      if (path.includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            jobs: [],
            direct: { materials: 0, labor: 0, expenses: 0, total: 0 },
            indirect: { total: 0, byCostCenter: [] },
            period: { revenue: 0, contribution: 0, otherIncome: 0 },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    axios.put.mockResolvedValue({ data: { note: 'Truck fuel' } });

    await renderAccounting();
    await userEvent.type(screen.getByLabelText('Note for SHELL OIL'), 'Truck fuel');
    await userEvent.click(screen.getByRole('button', { name: /save note/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/checking-lines/line1'),
        { note: 'Truck fuel' },
        expect.any(Object)
      );
    });
  });

  test('saves a checking deposit against a subcontractor work order', async () => {
    axios.get.mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/subcontractor-work-orders')) {
        return Promise.resolve({
          data: [{ _id: 'wo1', workOrderNumber: 'BRK-2002', siteName: 'Lobby', principal: 'Brinks' }],
        });
      }
      if (path.includes('/api/accounting/checking-lines')) {
        return Promise.resolve({
          data: [{
            _id: 'in',
            postedDate: '2024-01-16T12:00:00.000Z',
            description: 'BRINKS PAYMENT',
            amount: 640,
            status: 'uncategorized',
          }],
        });
      }
      if (path.includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            jobs: [],
            direct: { materials: 0, labor: 0, expenses: 0, total: 0 },
            indirect: { total: 0, byCostCenter: [] },
            period: { revenue: 0, contribution: 0, otherIncome: 0, subcontractorIncome: 0 },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    axios.put.mockResolvedValue({ data: { status: 'categorized' } });

    await renderAccounting();
    const job = screen.getByLabelText('Job for BRINKS PAYMENT');
    expect(within(job).getByRole('option', { name: 'BRK-2002 · Lobby (Brinks)' })).toBeInTheDocument();
    await userEvent.selectOptions(job, 'subcontractor:wo1');
    await userEvent.click(screen.getByRole('button', { name: /save category/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/checking-lines/in'),
        expect.objectContaining({ subcontractorWorkOrderId: 'wo1' }),
        expect.any(Object)
      );
    });
  });

  test('files a sale against an inventory purchase so the cost follows the item', async () => {
    axios.get.mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/accounting/checking-lines')) {
        return Promise.resolve({
          data: [
            {
              _id: 'buy',
              postedDate: '2026-05-02T12:00:00.000Z',
              description: 'LOCK',
              amount: -10,
              status: 'categorized',
              categoryCode: 'INVENTORY',
            },
            {
              _id: 'sell',
              postedDate: '2026-06-15T12:00:00.000Z',
              description: 'CUSTOMER PAYMENT',
              amount: 25,
              status: 'uncategorized',
            },
          ],
        });
      }
      if (path.includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            jobs: [],
            direct: { materials: 0, labor: 0, expenses: 0, total: 0 },
            indirect: { total: 0, byCostCenter: [] },
            inventory: { onHand: 10 },
            period: { revenue: 25, contribution: 15, otherIncome: 0, subcontractorIncome: 0, sales: 25, cogs: 10 },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    axios.put.mockResolvedValue({ data: { status: 'categorized' } });

    await renderAccounting();
    expect(screen.getByText('Cost of goods sold')).toBeInTheDocument();
    expect(screen.getByText('Inventory on hand')).toBeInTheDocument();
    const category = screen.getByLabelText('Category for CUSTOMER PAYMENT');
    expect(within(category).getByRole('option', { name: 'Inventory' })).toBeInTheDocument();
    expect(within(category).getByRole('option', { name: 'Sales' })).toBeInTheDocument();
    await userEvent.selectOptions(category, 'SALES');
    await userEvent.click(screen.getByRole('checkbox', { name: 'LOCK · $10.00' }));
    await userEvent.click(screen.getByRole('button', { name: /save category/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/checking-lines/sell'),
        expect.objectContaining({ categoryCode: 'SALES', inventoryLineIds: ['buy'] }),
        expect.any(Object)
      );
    });
  });

  test('colors checking income green and payouts red', async () => {
    axios.get.mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/accounting/checking-lines')) {
        return Promise.resolve({
          data: [
            {
              _id: 'out',
              postedDate: '2024-01-15T12:00:00.000Z',
              description: 'SHELL OIL',
              amount: -45.2,
              status: 'uncategorized',
            },
            {
              _id: 'in',
              postedDate: '2024-01-16T12:00:00.000Z',
              description: 'CUSTOMER PAYMENT',
              amount: 800,
              status: 'uncategorized',
            },
          ],
        });
      }
      if (path.includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            jobs: [],
            direct: { materials: 0, labor: 0, expenses: 0, total: 0 },
            indirect: { total: 0, byCostCenter: [] },
            period: { revenue: 0, contribution: 0, otherIncome: 0 },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    await renderAccounting();
    expect(screen.getByText('-$45.20')).toHaveClass('text-red-700');
    expect(screen.getByText('$800.00')).toHaveClass('text-green-700');
  });

  test('imports a checking CSV and reconciles a suggested line to the existing record', async () => {
    axios.get.mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/accounting/checking-lines')) {
        return Promise.resolve({
          data: [{
            _id: 'line1',
            postedDate: '2024-01-15T12:00:00.000Z',
            description: 'SHELL OIL',
            amount: -45.2,
            status: 'suggested',
            suggestion: { kind: 'expense', id: 'e1', label: 'Expense Shell $45.20 on 2024-01-15' },
          }],
        });
      }
      if (path.includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            jobs: [],
            direct: { materials: 0, labor: 0, expenses: 0, total: 0 },
            indirect: { total: 0, byCostCenter: [] },
            period: { revenue: 0, contribution: 0, otherIncome: 0 },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    axios.post.mockResolvedValue({ data: { imported: 1, duplicates: 4, suggested: 1 } });
    axios.put.mockResolvedValue({ data: { status: 'matched' } });

    await renderAccounting();
    const input = screen.getByLabelText(/checking csv/i);
    const csv = 'Date,Description,Amount\n01/15/2024,SHELL OIL,-45.20\n';
    const file = new File([csv], 'checking.csv', { type: 'text/csv' });
    const RealFileReader = global.FileReader;
    global.FileReader = class {
      readAsText() {
        this.result = csv;
        queueMicrotask(() => this.onload());
      }
    };
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    const propKey = Object.keys(input).find((key) => key.startsWith('__reactProps'));
    try {
      await act(async () => {
        await input[propKey].onChange({ target: input });
      });
    } finally {
      global.FileReader = RealFileReader;
    }

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/checking-import'),
        expect.objectContaining({ csv: expect.stringContaining('SHELL OIL') }),
        expect.any(Object)
      );
    });
    expect(screen.getByText('SHELL OIL')).toBeInTheDocument();
    expect(screen.getByText(/Expense Shell/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /use existing/i }));
    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('/api/accounting/checking-lines/line1'),
      { confirmMatch: true },
      expect.any(Object)
    );
  });

  test('renders AR, AP, tax, and job profit from the summary API', async () => {
    axios.get.mockResolvedValue({
      data: {
        ar: { billed: 200, paid: 50, balance: 150 },
        ap: { receivedUnpaid: 80, paid: 40, balance: 80 },
        taxCollected: 20,
        jobs: [
          {
            customerName: 'Jane',
            projectName: 'Alarm',
            status: 'Billed',
            billed: 200,
            materialCost: 40,
            profit: 160,
          },
        ],
      },
    });

    await renderAccounting();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/summary'),
        expect.any(Object)
      );
    });

    expect(await screen.findByText('Accounts receivable')).toBeInTheDocument();
    expect(screen.getByText('Accounts payable')).toBeInTheDocument();
    expect(screen.getByText('Tax collected')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.getByText('Alarm')).toBeInTheDocument();
    expect(screen.getAllByText('$160.00').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  test('shows Direct vs Indirect totals and accepts an overhead expense', async () => {
    axios.get.mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 200, paid: 50, balance: 150 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            direct: { materials: 40, labor: 80, expenses: 25, total: 145, laborHours: 2 },
            indirect: {
              labor: 120,
              expenses: 200,
              total: 320,
              laborHours: 3,
              byCostCenter: [{ code: 'OFFICE', name: 'Office overhead', expenses: 200, labor: 0, total: 200 }],
            },
            period: {
              from: '2026-09-01',
              to: '2026-09-30',
              revenue: 200,
              contribution: 55,
              overheadRatePerHour: 160,
              overheadRateOnCost: 2.21,
            },
            jobs: [
              {
                customerName: 'Jane',
                projectName: 'Alarm',
                status: 'Billed',
                workType: 'installation',
                billed: 200,
                materialCost: 40,
                laborCost: 80,
                directExpenseCost: 25,
                profit: 160,
                contribution: 55,
              },
            ],
          },
        });
      }
      if (path.includes('/api/cost-centers')) {
        return Promise.resolve({ data: [{ code: 'OFFICE', name: 'Office overhead' }] });
      }
      return Promise.resolve({ data: [] });
    });
    axios.post.mockResolvedValue({ data: { _id: 'exp1' } });

    await renderAccounting();

    expect(await screen.findByText('Direct costs')).toBeInTheDocument();
    expect(screen.getByText('Indirect costs')).toBeInTheDocument();
    expect(screen.getAllByText('Office overhead').length).toBeGreaterThan(0);
    expect(screen.getByText('Period P&L lite')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Record expense' }));
    await userEvent.type(screen.getByLabelText('Amount'), '120');
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/expenses'),
        expect.objectContaining({ amount: 120, costCenterCode: 'OFFICE' }),
        expect.any(Object)
      );
    });
  });

  test('files an expense on a customer service job or a subcontractor job', async () => {
    axios.get.mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            direct: { materials: 0, labor: 0, expenses: 0, total: 0 },
            indirect: { total: 0, byCostCenter: [] },
            period: { revenue: 0, contribution: 0 },
            jobs: [],
          },
        });
      }
      if (path.includes('/api/customers')) {
        return Promise.resolve({
          data: [{
            _id: 'c6',
            name: 'Mike Dibble',
            accountNumber: 'A-1006',
            projects: [{ _id: 'p1', name: 'Old install', jobNumber: 'A-1006-P0001' }],
            serviceJobs: [{
              _id: 'j1',
              name: 'IP Cameras for property',
              jobNumber: 'A-1006-J0001',
            }],
          }],
        });
      }
      if (path.includes('/api/subcontractor-work-orders')) {
        return Promise.resolve({
          data: [{
            _id: 'wo1',
            workOrderNumber: 'BRK-2002',
            siteName: 'Lobby',
            principal: 'Brinks',
          }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    axios.post.mockResolvedValue({ data: { _id: 'exp1' } });

    await renderAccounting();
    await userEvent.click(screen.getByRole('button', { name: 'Record expense' }));
    const job = screen.getByLabelText('Job (optional)');
    expect(Array.from(job.options).map((option) => option.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('A-1006-J0001'),
      expect.stringContaining('BRK-2002'),
    ]));

    await userEvent.selectOptions(job, 'c6:j1');
    await userEvent.type(screen.getByLabelText('Amount'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/expenses'),
        expect.objectContaining({ customerId: 'c6', projectId: 'j1', amount: 12 }),
        expect.any(Object)
      );
    });

    await userEvent.selectOptions(job, 'subcontractor:wo1');
    await userEvent.type(screen.getByLabelText('Amount'), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/expenses'),
        expect.objectContaining({ subcontractorWorkOrderId: 'wo1', amount: 9 }),
        expect.any(Object)
      );
    });
  });

  test('filters the job table by work type', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 300, paid: 0, balance: 300 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            direct: { materials: 0, labor: 0, expenses: 0, total: 0, laborHours: 0 },
            indirect: { labor: 0, expenses: 0, total: 0, laborHours: 0, byCostCenter: [] },
            period: { revenue: 300, contribution: 300, overheadRatePerHour: null, overheadRateOnCost: null },
            jobs: [
              { customerName: 'A', projectName: 'Install job', status: 'Billed', workType: 'installation', billed: 200, materialCost: 0, profit: 200, contribution: 200 },
              { customerName: 'B', projectName: 'Service job', status: 'Billed', workType: 'service', billed: 100, materialCost: 0, profit: 100, contribution: 100 },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    await renderAccounting();

    expect(await screen.findByText('Install job')).toBeInTheDocument();
    expect(screen.getByText('Service job')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filter by work type'), 'service');
    expect(screen.queryByText('Install job')).not.toBeInTheDocument();
    expect(screen.getByText('Service job')).toBeInTheDocument();
  });

  test('treats blank job workType as installation in the Job profit filter', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 300, paid: 0, balance: 300 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            jobs: [
              { customerName: 'A', projectName: 'Legacy install', status: 'Billed', billed: 200, materialCost: 0, profit: 200 },
              { customerName: 'B', projectName: 'Blank type', status: 'Billed', workType: '', billed: 50, materialCost: 0, profit: 50 },
              { customerName: 'C', projectName: 'Service job', status: 'Billed', workType: 'service', billed: 100, materialCost: 0, profit: 100 },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    await renderAccounting();

    expect(await screen.findByText('Legacy install')).toBeInTheDocument();
    expect(screen.getByText('Blank type')).toBeInTheDocument();
    expect(screen.getAllByText('Installation').length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByLabelText('Filter by work type'), 'installation');
    expect(screen.getByText('Legacy install')).toBeInTheDocument();
    expect(screen.getByText('Blank type')).toBeInTheDocument();
    expect(screen.queryByText('Service job')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filter by work type'), 'consultation');
    expect(screen.queryByText('Legacy install')).not.toBeInTheDocument();
    expect(screen.queryByText('No jobs yet.')).not.toBeInTheDocument();
    expect(screen.getByText(/No Consultation jobs in this Job profit list/i)).toBeInTheDocument();
    expect(screen.getByText(/filters this Job profit table only/i)).toBeInTheDocument();
  });

  test('Job Profit shows billed amount separately from the bid', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 7400, paid: 0, balance: 7400 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            direct: { materials: 0, labor: 400, expenses: 0, total: 400 },
            indirect: { labor: 0, expenses: 0, total: 0, byCostCenter: [] },
            period: { revenue: 7400, contribution: 7000 },
            jobs: [
              {
                customerName: 'Acme',
                projectName: 'Service call',
                status: 'Billed',
                workType: 'service',
                quoted: 2500,
                billed: 7400,
                materialCost: 0,
                laborCost: 400,
                directExpenseCost: 0,
                profit: 7400,
                contribution: 7000,
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    await renderAccounting();

    expect(await screen.findByText('Quoted')).toBeInTheDocument();
    expect(screen.getAllByText('Billed').length).toBeGreaterThan(0);
    expect(screen.getByText('$2,500.00')).toBeInTheDocument();
    expect(screen.getAllByText('$7,400.00').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Material cost is qty × what you paid/i)
    ).toBeInTheDocument();
  });

  test('saves overhead time and reapplies the date range', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            direct: { materials: 0, labor: 0, expenses: 0, total: 0, laborHours: 0 },
            indirect: { labor: 0, expenses: 0, total: 0, laborHours: 0, byCostCenter: [] },
            period: { revenue: 0, contribution: 0, overheadRatePerHour: null, overheadRateOnCost: null },
            jobs: [],
          },
        });
      }
      if (String(url).includes('/api/customers')) {
        return Promise.resolve({
          data: [{ _id: 'c1', name: 'Acme', projects: [{ _id: 'p1', name: 'Alarm' }] }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    axios.post.mockResolvedValue({ data: { _id: 'lab1' } });

    await renderAccounting();

    await userEvent.click(await screen.findByRole('button', { name: 'Record overhead time' }));
    await userEvent.type(screen.getByLabelText('Hours'), '3');
    await userEvent.type(screen.getByLabelText('Hourly cost'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Save time' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/labor-entries'),
        expect.objectContaining({ hours: 3, hourlyCost: 40, workType: 'bidding' }),
        expect.any(Object)
      );
    });

    await userEvent.click(screen.getByRole('button', { name: 'Apply range' }));
    await waitFor(() => {
      expect(axios.get.mock.calls.some((call) => String(call[0]).includes('/api/accounting/summary'))).toBe(true);
    });
  });

  test('shows a period sub-ledger with expense and time line items', async () => {
    axios.get.mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            direct: { materials: 0, labor: 0, expenses: 0, total: 0 },
            indirect: {
              total: 125.5,
              byCostCenter: [{ code: 'FUEL', name: 'Fuel', expenses: 45.5, labor: 0, total: 45.5 }],
            },
            period: { revenue: 0, contribution: 0 },
            jobs: [],
          },
        });
      }
      if (path.includes('/api/expenses')) {
        return Promise.resolve({
          data: [
            {
              _id: 'e1',
              date: '2026-09-08T00:00:00.000Z',
              amount: 45.5,
              costCenterCode: 'FUEL',
              payee: 'Shell',
              description: 'Trip to Murfreesboro',
            },
          ],
        });
      }
      if (path.includes('/api/labor-entries')) {
        return Promise.resolve({
          data: [
            {
              _id: 't1',
              date: '2026-09-09T00:00:00.000Z',
              hours: 2,
              hourlyCost: 40,
              workType: 'bidding',
              notes: 'Site survey',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    await renderAccounting();

    expect(await screen.findByText('Period ledger')).toBeInTheDocument();
    expect(screen.getByText('Shell')).toBeInTheDocument();
    expect(screen.getByText('Trip to Murfreesboro')).toBeInTheDocument();
    expect(screen.getByText('Site survey')).toBeInTheDocument();
    expect(screen.getByText('2 hrs')).toBeInTheDocument();
    expect(screen.getByText('$80.00')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Ledger class'), 'direct');
    expect(screen.queryByText('Shell')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Ledger class'), 'indirect');
    expect(screen.getByText('Shell')).toBeInTheDocument();
  });

  test('offers Misc in the expense cost center and overhead work type dropdowns', async () => {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            direct: { materials: 0, labor: 0, expenses: 0, total: 0, laborHours: 0 },
            indirect: { labor: 0, expenses: 0, total: 0, laborHours: 0, byCostCenter: [] },
            period: { revenue: 0, contribution: 0, overheadRatePerHour: null, overheadRateOnCost: null },
            jobs: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    await renderAccounting();

    const costCenter = await screen.findByLabelText('Cost center');
    expect(Array.from(costCenter.options).map((option) => option.value)).toContain('MISC');
    expect(Array.from(costCenter.options).map((option) => option.textContent)).toContain('Misc');

    const workType = document.getElementById('labor-type');
    expect(Array.from(workType.options).map((option) => option.value)).toContain('misc');
    expect(Array.from(workType.options).map((option) => option.textContent)).toContain('Misc');
  });

  function mockEmptyAccountingApis() {
    axios.get.mockImplementation((url) => {
      if (String(url).includes('/api/accounting/summary')) {
        return Promise.resolve({
          data: {
            ar: { billed: 0, paid: 0, balance: 0 },
            ap: { receivedUnpaid: 0, paid: 0, balance: 0 },
            taxCollected: 0,
            direct: { materials: 0, labor: 0, expenses: 0, total: 0 },
            indirect: { total: 0, byCostCenter: [] },
            period: { revenue: 0, contribution: 0 },
            jobs: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
  }

  function SearchProbe() {
    const [params] = useSearchParams();
    return <span data-testid="accounting-search">{params.toString()}</span>;
  }

  test('Apply range is a button, not a submitting form control', async () => {
    mockEmptyAccountingApis();
    await renderAccounting();

    const apply = await screen.findByRole('button', { name: 'Apply range' });
    expect(apply).toHaveAttribute('type', 'button');
    expect(apply.closest('form')).toBeNull();
  });

  test('keeps a non-current From/To after Apply and writes ?from=&to=', async () => {
    mockEmptyAccountingApis();
    await renderAccounting(
      <MemoryRouter initialEntries={['/accounting']}>
        <SearchProbe />
        <Accounting />
      </MemoryRouter>
    );

    const fromInput = await screen.findByLabelText('From date');
    const toInput = screen.getByLabelText('To date');
    const current = currentMonthRange();
    expect(fromInput).toHaveValue(current.from);
    expect(toInput).toHaveValue(current.to);

    fireEvent.change(fromInput, { target: { value: '2026-01-15' } });
    fireEvent.change(toInput, { target: { value: '2026-02-20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply range' }));

    expect(fromInput).toHaveValue('2026-01-15');
    expect(toInput).toHaveValue('2026-02-20');
    expect(fromInput).not.toHaveValue(current.from);
    expect(toInput).not.toHaveValue(current.to);

    await waitFor(() => {
      expect(screen.getByTestId('accounting-search')).toHaveTextContent('from=2026-01-15');
      expect(screen.getByTestId('accounting-search')).toHaveTextContent('to=2026-02-20');
    });
    expect(axios.get.mock.calls.some((call) => {
      const url = String(call[0]);
      return url.includes('from=2026-01-15') && url.includes('to=2026-02-20');
    })).toBe(true);
  });

  test('does not snap From/To back to today when a date input blurs empty', async () => {
    mockEmptyAccountingApis();
    await renderAccounting();

    const fromInput = await screen.findByLabelText('From date');
    const toInput = screen.getByLabelText('To date');
    fireEvent.change(fromInput, { target: { value: '2026-03-04' } });
    fireEvent.change(toInput, { target: { value: '2026-03-18' } });
    fireEvent.change(fromInput, { target: { value: '' } });
    fireEvent.change(toInput, { target: { value: '2026-3-18' } });

    expect(fromInput).toHaveValue('2026-03-04');
    expect(toInput).toHaveValue('2026-03-18');

    await userEvent.click(screen.getByRole('button', { name: 'Apply range' }));
    expect(fromInput).toHaveValue('2026-03-04');
    expect(toInput).toHaveValue('2026-03-18');
  });

  test('hydrates From/To from the query string after a remount', async () => {
    mockEmptyAccountingApis();
    await renderAccounting(
      <MemoryRouter initialEntries={['/accounting?from=2025-11-01&to=2025-11-30']}>
        <Accounting />
      </MemoryRouter>
    );

    expect(await screen.findByLabelText('From date')).toHaveValue('2025-11-01');
    expect(screen.getByLabelText('To date')).toHaveValue('2025-11-30');
    const current = currentMonthRange();
    expect(screen.getByLabelText('From date')).not.toHaveValue(current.from);

    await waitFor(() => {
      expect(axios.get.mock.calls.some((call) => {
        const url = String(call[0]);
        return url.includes('from=2025-11-01') && url.includes('to=2025-11-30');
      })).toBe(true);
    });
  });
});
