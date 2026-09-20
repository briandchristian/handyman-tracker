import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import Accounting from '../Accounting';

jest.mock('axios');

describe('Accounting', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
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

    render(
      <BrowserRouter>
        <Accounting />
      </BrowserRouter>
    );

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
    expect(screen.getByText('$160.00')).toBeInTheDocument();
  });
});
