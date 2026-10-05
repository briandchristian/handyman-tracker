/**
 * ADI Supplier API - Phase 3 (Order Generation)
 *
 * TDD coverage for request validation, payload/header composition,
 * and response normalization for GenerateOrder.
 */

import {
  ADI_ORDER_GENERATION_PATH,
  adiGenerateOrderLogLine,
  fetchAdiOrderGeneration,
  normalizeAdiOrderGenerationResponse,
} from '../lib/suppliers/adiOrderGeneration.js';

describe('ADI Order Generation client', () => {
  const credentials = {
    apiKey: 'API00483',
    apiPassword: 'f2c46d810212477c',
    apiSecretKey: 'OTUzMWRlZThhZjM0MDlhZA==',
  };

  test('posts to ADI GenerateOrder endpoint with required auth headers and payload', async () => {
    const httpClient = {
      post: jest.fn().mockResolvedValue({
        data: {
          ReturnCode: '00',
          ReturnMessage: 'Order 1234567890 created successfully',
        },
      }),
    };

    const result = await fetchAdiOrderGeneration({
      credentials,
      customerNumber: 'CUST001',
      customerSuffix: '000',
      poNumber: 'PO-12345',
      shipmentPickupIndicator: 'P',
      orderList: [{ ItemNumber: '12345', Quantity: 2, ItemPrice: 19.99 }],
      clientRequestId: 'e95d18b5-5dae-4b52-9109-6fe0a81e0018',
      timestamp: 4293512740888,
      httpClient,
    });

    expect(httpClient.post).toHaveBeenCalledWith(
      ADI_ORDER_GENERATION_PATH,
      {
        CustomerNumber: 'CUST001',
        CustomerSuffix: '000',
        PONumber: 'PO-12345',
        ShipmentPickupIndicator: 'P',
        OrderList: [{ ItemNumber: '12345', Quantity: 2, ItemPrice: 19.99 }],
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

    expect(result).toEqual({
      ReturnCode: '00',
      ReturnMessage: 'Order 1234567890 created successfully',
      ADIOrderNumber: '',
    });
  });

  test('keeps a dedicated order number when ADI returns one', () => {
    expect(
      normalizeAdiOrderGenerationResponse({
        ReturnCode: '00',
        ReturnMessage: 'Order created successfully',
        OrderNumber: '1234567890',
      })
    ).toEqual({
      ReturnCode: '00',
      ReturnMessage: 'Order created successfully',
      ADIOrderNumber: '1234567890',
    });
  });

  test('throws when shipment is ship and required drop address fields are missing', async () => {
    await expect(
      fetchAdiOrderGeneration({
        credentials,
        customerNumber: 'CUST001',
        customerSuffix: '000',
        poNumber: 'PO-12345',
        shipmentPickupIndicator: 'S',
        dropShipmentName: 'Test Job Site',
        orderList: [{ ItemNumber: '12345', Quantity: 2, ItemPrice: 19.99 }],
        httpClient: { post: jest.fn() },
      })
    ).rejects.toThrow('dropShipmentAddress1 is required when shipmentPickupIndicator is S');
  });

  test('throws when order item has invalid item price', async () => {
    await expect(
      fetchAdiOrderGeneration({
        credentials,
        customerNumber: 'CUST001',
        customerSuffix: '000',
        poNumber: 'PO-12345',
        shipmentPickupIndicator: 'P',
        orderList: [{ ItemNumber: '12345', Quantity: 2, ItemPrice: 0 }],
        httpClient: { post: jest.fn() },
      })
    ).rejects.toThrow('OrderList[0].ItemPrice must be a positive number');
  });

  test('formats a generate-order log line without credentials', () => {
    const line = adiGenerateOrderLogLine({
      at: '2026-10-05T16:16:01.541Z',
      poNumber: 'PO-2026-0004',
      customerNumber: '451278',
      clientRequestId: 'req-1',
      returnCode: '01',
      returnMessage: 'Country code is invalid',
    });

    expect(line).toBe(
      '[ADI GenerateOrder] time=2026-10-05T16:16:01.541Z po=PO-2026-0004 customer=451278 requestId=req-1 returnCode=01 returnMessage=Country code is invalid'
    );
    expect(line).not.toMatch(/apiKey|apiPassword|apiSecret|Authentication-Signature/i);
  });

  test('normalizes missing response fields to empty strings', () => {
    expect(normalizeAdiOrderGenerationResponse({})).toEqual({
      ReturnCode: '',
      ReturnMessage: '',
      ADIOrderNumber: '',
    });
  });
});
