/**
 * ADI Supplier API - Phase 2 (Price and Inventory)
 *
 * TDD coverage for request validation, payload/header composition,
 * and response normalization for PriceAndInventoryDetails.
 */

import {
  ADI_PRICE_AND_INVENTORY_PATH,
  fetchAdiPriceAndInventoryDetails,
  normalizeAdiPriceAndInventoryResponse,
} from '../suppliers/adiPriceInventory.js';

describe('ADI Price and Inventory client', () => {
  const credentials = {
    apiKey: 'API00483',
    apiPassword: 'f2c46d810212477c',
    apiSecretKey: 'OTUzMWRlZThhZjM0MDlhZA==',
  };

  test('posts to ADI PriceAndInventory endpoint with required auth headers and payload', async () => {
    const httpClient = {
      post: jest.fn().mockResolvedValue({
        data: {
          CustomerNumber: 'CUST001',
          CustomerSuffix: '000',
          ReturnCode: '00',
          ReturnMessage: '',
          ItemList: [],
        },
      }),
    };

    const result = await fetchAdiPriceAndInventoryDetails({
      credentials,
      customerNumber: 'CUST001',
      customerSuffix: '000',
      itemList: [{ ItemNumber: '12345', Quantity: 2 }],
      clientRequestId: 'e95d18b5-5dae-4b52-9109-6fe0a81e0018',
      timestamp: 4293512740888,
      httpClient,
    });

    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(
      ADI_PRICE_AND_INVENTORY_PATH,
      {
        CustomerNumber: 'CUST001',
        CustomerSuffix: '000',
        ItemList: [{ ItemNumber: '12345', Quantity: 2 }],
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
  });

  test('throws when request has more than 50 items', async () => {
    const itemList = Array.from({ length: 51 }, (_, index) => ({
      ItemNumber: `SKU-${index + 1}`,
      Quantity: 1,
    }));

    await expect(
      fetchAdiPriceAndInventoryDetails({
        credentials,
        customerNumber: 'CUST001',
        customerSuffix: '000',
        itemList,
        httpClient: { post: jest.fn() },
      })
    ).rejects.toThrow('itemList cannot contain more than 50 items');
  });

  test('throws when item quantity is invalid', async () => {
    await expect(
      fetchAdiPriceAndInventoryDetails({
        credentials,
        customerNumber: 'CUST001',
        customerSuffix: '000',
        itemList: [{ ItemNumber: '12345', Quantity: 0 }],
        httpClient: { post: jest.fn() },
      })
    ).rejects.toThrow('ItemList[0].Quantity must be a positive number');
  });

  test('normalizes item fields from either naming variant in ADI docs', () => {
    const normalized = normalizeAdiPriceAndInventoryResponse({
      CustomerNumber: 'CUST001',
      CustomerSuffix: '000',
      ReturnCode: '00',
      ReturnMessage: '',
      ItemList: [
        {
          ItemNumber: '12345',
          Quantity: 2,
          ItemPrice: '19.99',
          AllowedToBuy: 'Y',
          ItemSaleStartDate: '01/01/2026',
          ItemSaleEndDate: '01/31/2026',
          ItemNationalInventory: 'US',
          ReturnCode: '00',
          ReturnMessage: '',
        },
      ],
    });

    expect(normalized.ItemList[0]).toEqual({
      ItemNumber: '12345',
      Quantity: 2,
      ItemPrice: '19.99',
      AllowedToBuy: 'Y',
      SaleStartDate: '01/01/2026',
      SaleEndDate: '01/31/2026',
      NationalInventory: 'US',
      ReturnCode: '00',
      ReturnMessage: '',
    });
  });
});
