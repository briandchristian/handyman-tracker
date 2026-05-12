/**
 * Frontend ADI service wrapper tests
 * Ensures UI calls use standardized route + auth behavior.
 */

import axios from 'axios';
import API_BASE_URL from '../../config/api';
import {
  fetchAdiPriceInventory,
  generateAdiOrder,
  inquireAdiOrder,
} from '../adiSupplierApi.js';

jest.mock('axios');

const buildExpectedUrl = (path) => `${API_BASE_URL}${path}`;

describe('adiSupplierApi service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    axios.post.mockResolvedValue({ data: { ok: true } });
  });

  test('fetchAdiPriceInventory posts to standardized Phase 2 route', async () => {
    localStorage.setItem('token', 'test-token');
    const payload = {
      customerNumber: 'CUST001',
      customerSuffix: '000',
      itemList: [{ ItemNumber: '12345', Quantity: 2 }],
    };

    await fetchAdiPriceInventory(payload);

    expect(axios.post).toHaveBeenCalledWith(
      buildExpectedUrl('/api/suppliers/adi/price-inventory'),
      payload,
      {
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      }
    );
  });

  test('generateAdiOrder posts to standardized Phase 3 route', async () => {
    localStorage.setItem('token', 'test-token');
    const payload = {
      customerNumber: 'CUST001',
      customerSuffix: '000',
      poNumber: 'PO-12345',
      shipmentPickupIndicator: 'P',
      orderList: [{ ItemNumber: '12345', Quantity: 2, ItemPrice: 19.99 }],
    };

    await generateAdiOrder(payload);

    expect(axios.post).toHaveBeenCalledWith(
      buildExpectedUrl('/api/suppliers/adi/order-generation'),
      payload,
      {
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      }
    );
  });

  test('inquireAdiOrder posts to standardized Phase 4 route', async () => {
    localStorage.setItem('token', 'test-token');
    const payload = {
      customerNumber: 'CUST001',
      customerSuffix: '000',
      adiOrderNumber: '1234567890',
    };

    await inquireAdiOrder(payload);

    expect(axios.post).toHaveBeenCalledWith(
      buildExpectedUrl('/api/suppliers/adi/order-inquiry'),
      payload,
      {
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      }
    );
  });

  test('throws a clear error when auth token is missing', async () => {
    expect(() =>
      fetchAdiPriceInventory({
        customerNumber: 'CUST001',
        customerSuffix: '000',
        itemList: [{ ItemNumber: '12345', Quantity: 2 }],
      })
    ).toThrow('Authentication token is required for ADI supplier API calls');
  });
});
