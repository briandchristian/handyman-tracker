/**
 * ADI Supplier API - Phase 4 (Order Inquiry)
 *
 * TDD coverage for request validation, payload/header composition,
 * and response normalization for OrderTracking.
 */

import {
  ADI_ORDER_INQUIRY_PATH,
  adiOrderInquiryLogLine,
  fetchAdiOrderInquiry,
  normalizeAdiOrderInquiryResponse,
  sanitizeAdiReply,
} from '../lib/suppliers/adiOrderInquiry.js';

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
    expect(normalized.OrderStatus).toBe('');
  });

  test('keeps tracking fields that are outside the known header', () => {
    const normalized = normalizeAdiOrderInquiryResponse({
      ReturnCode: '00',
      ReturnMessage: ' ',
      HoldReason: 'Credit review',
      OrderHeader: { WebOrderNumber: 'W-99' },
      ApiKey: 'API00483',
      nested: { apiPassword: 'secret', Branch: 'Nashville' },
    });

    expect(normalized.HoldReason).toBe('Credit review');
    expect(normalized.OrderHeader).toEqual({ WebOrderNumber: 'W-99' });
    expect(normalized.ReturnMessage).toBe(' ');
    expect(normalized.ApiKey).toBeUndefined();
    expect(normalized.nested).toEqual({ Branch: 'Nashville' });
  });

  test('logs the tracking reply without credentials', () => {
    const line = adiOrderInquiryLogLine({
      at: '2026-10-05T17:08:29.820Z',
      customerNumber: '451278',
      adiOrderNumber: '18066584',
      clientRequestId: 'req-1',
      returnCode: '00',
      returnMessage: ' ',
      reply: {
        ReturnCode: '00',
        HoldReason: 'Credit review',
        ApiKey: 'API00483',
        apiSecretKey: 'hidden',
      },
    });

    expect(line).toContain('customer=451278');
    expect(line).toContain('adiOrderNumber=18066584');
    expect(line).toContain('requestId=req-1');
    expect(line).toContain('Credit review');
    expect(line).not.toContain('API00483');
    expect(line).not.toContain('hidden');
    expect(sanitizeAdiReply({ AuthenticationSignature: 'sig', ReturnCode: '00' })).toEqual({
      ReturnCode: '00',
    });
  });

  test('keeps order status from the header when the top level omits it', () => {
    const normalized = normalizeAdiOrderInquiryResponse({
      ReturnCode: '00',
      ReturnMessage: '',
      OrderLineHead: {
        Status: 'Shipped',
        OrderLineShipmentUnitHeadList: [{ TrackingNumber: '1Z999' }],
        CartShipUnitList: [{ CartNumber: 'CART1' }],
      },
    });

    expect(normalized.OrderStatus).toBe('Shipped');
    expect(normalized.OrderLineHead.OrderLineShipmentUnitHeadList).toEqual([
      { TrackingNumber: '1Z999' },
    ]);
    expect(normalized.OrderLineHead.CartShipUnitList).toEqual([{ CartNumber: 'CART1' }]);
  });
});
