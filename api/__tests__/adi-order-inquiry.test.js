/**
 * ADI Supplier API - Phase 4 (Order Inquiry)
 *
 * TDD coverage for request validation, payload/header composition,
 * and response normalization for OrderTracking.
 */

import {
  ADI_ORDER_INQUIRY_PATH,
  fetchAdiOrderInquiry,
  normalizeAdiOrderInquiryResponse,
} from '../suppliers/adiOrderInquiry.js';

describe('ADI Order Inquiry client', () => {
  const credentials = {
    apiKey: 'API00483',
    apiPassword: 'f2c46d810212477c',
    apiSecretKey: 'OTUzMWRlZThhZjM0MDlhZA==',
  };

  test('posts to ADI OrderTracking endpoint with required auth headers and payload', async () => {
    const httpClient = {
      post: jest.fn().mockResolvedValue({
        data: {
          CustomerNumber: 'CUST001',
          CustomerSuffix: '000',
          ADIOrderNumber: '1234567890',
          ReturnCode: '00',
          ReturnMessage: '',
          OrderLineHead: {},
        },
      }),
    };

    const result = await fetchAdiOrderInquiry({
      credentials,
      customerNumber: 'CUST001',
      customerSuffix: '000',
      adiOrderNumber: '1234567890',
      clientRequestId: 'e95d18b5-5dae-4b52-9109-6fe0a81e0018',
      timestamp: 4293512740888,
      httpClient,
    });

    expect(httpClient.post).toHaveBeenCalledWith(
      ADI_ORDER_INQUIRY_PATH,
      {
        CustomerNumber: 'CUST001',
        CustomerSuffix: '000',
        ADIOrderNumber: '1234567890',
      },
      {
        headers: {
          'Api-Key': credentials.apiKey,
          'Authentication-Signature': 'Y1v6iZDrwSBYUbI24BchyLQ1q+kvRSS1gZ76Q8i9IQk=',
          'Client-Request-Id': 'e95d18b5-5dae-4b52-9109-6fe0a81e0018',
          Timestamp: '4293512740888',
          'Content-Type': 'application/json',
        },
      }
    );

    expect(result.ReturnCode).toBe('00');
    expect(result.ADIOrderNumber).toBe('1234567890');
  });

  test('throws when adiOrderNumber is missing', async () => {
    await expect(
      fetchAdiOrderInquiry({
        credentials,
        customerNumber: 'CUST001',
        customerSuffix: '000',
        adiOrderNumber: '',
        httpClient: { post: jest.fn() },
      })
    ).rejects.toThrow('adiOrderNumber is required');
  });

  test('normalizes missing nested collections to arrays', () => {
    const normalized = normalizeAdiOrderInquiryResponse({
      CustomerNumber: 'CUST001',
      CustomerSuffix: '000',
      ADIOrderNumber: '1234567890',
      ReturnCode: '00',
      ReturnMessage: '',
      OrderLineHead: {
        OrderLineShipmentUnitHeadList: null,
        CartShipUnitList: undefined,
      },
    });

    expect(normalized.OrderLineHead.OrderLineShipmentUnitHeadList).toEqual([]);
    expect(normalized.OrderLineHead.CartShipUnitList).toEqual([]);
  });
});
