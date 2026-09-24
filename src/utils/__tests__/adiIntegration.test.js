/**
 * ADI purchase-order integration
 * Price lookup updates PO lines. Order placement can ship or pick up.
 * Inquiry keeps status plus shipment and cart tracking.
 */

import {
  adiAllowedLabel,
  adiItemNumberFromSku,
  adiSupportCode,
  plainAdiItemMessage,
  splitCatalogSku,
  applyAdiPriceInventory,
  buildAdiGenerateOrderPayload,
  collectAdiCarts,
  collectAdiShipments,
  deriveAdiInquiryStatus,
  extractAdiOrderNumber,
  findAdiAccount,
  buildAdiInventoryLookups,
  inventoryUpdateFromAdiQuote,
  isAdiInventoryItem,
  supplierPriceLookupAccount,
  appendPriceHistory,
  formatPriceChangeAmount,
  formatPriceChangePercent,
  keepLatestPriceHistory,
  priceChangeForUpdate,
  priceChangeRecord,
  removePriceHistoryAt,
  validateAdiGenerateOrder,
} from '../adiIntegration';

describe('adiIntegration', () => {
  const po = {
    items: [
      { sku: 'LUM-2X4', description: '2x4', quantity: 50, unit: 'each', unitPrice: 5.99, total: 299.5 },
      { sku: 'OTHER', description: 'Other', quantity: 2, unit: 'each', unitPrice: 1, total: 2 },
    ],
    tax: 10,
    shipping: 5,
  };

  test('applies customer price and keeps quote details for each returned SKU', () => {
    const result = applyAdiPriceInventory(po, {
      ReturnCode: '00',
      ItemList: [
        {
          ItemNumber: 'lum-2x4',
          Quantity: 50,
          ItemPrice: '4.50',
          AllowedToBuy: 'N',
          SaleStartDate: '01/01/2026',
          SaleEndDate: '01/31/2026',
          NationalInventory: '12',
          ReturnCode: '00',
          ReturnMessage: 'ok',
        },
      ],
    });

    expect(result.items[0].unitPrice).toBe(4.5);
    expect(result.items[0].total).toBe(225);
    expect(result.items[1].unitPrice).toBe(1);
    expect(result.subtotal).toBe(227);
    expect(result.tax).toBe(10);
    expect(result.shipping).toBe(5);
    expect(result.total).toBe(242);
    expect(result.priceLines[0]).toEqual({
      itemNumber: 'lum-2x4',
      quantity: 50,
      itemPrice: '4.50',
      allowedToBuy: 'N',
      saleStartDate: '01/01/2026',
      saleEndDate: '01/31/2026',
      nationalInventory: '12',
      returnCode: '00',
      returnMessage: 'ok',
    });
    expect(result.unmatchedSkus).toEqual(['OTHER']);
  });

  test('sends the ADI item number that follows the catalog pipe', () => {
    expect(adiItemNumberFromSku('MX922 | 3W-MX922')).toBe('3W-MX922');
    expect(adiItemNumberFromSku('LUM-2X4')).toBe('LUM-2X4');
    expect(splitCatalogSku('MX922 | 3W-MX922')).toEqual({
      manufacturerPart: 'MX922',
      adiItemNumber: '3W-MX922',
    });
    expect(plainAdiItemMessage(
      'EVAL-013104: Sorry, node "412_MX922 | 3W-MX922" does not exist in dimension "PRODUCT".',
      '3W-MX922'
    )).toBe(`ADI doesn't recognize 3W-MX922.`);
    expect(adiSupportCode('EVAL-013104: Sorry, node missing')).toBe('EVAL-013104');
    expect(findAdiAccount([
      { supplier: { _id: 'sup1' }, adiIntegration: { customerNumber: '451278', customerSuffix: '000' } },
    ])).toEqual({ customerNumber: '451278', customerSuffix: '000', supplierId: 'sup1' });
    expect(findAdiAccount([])).toBeNull();
    expect(adiAllowedLabel('Y')).toBe('Yes');
    expect(adiAllowedLabel('N')).toBe('No');

    const priced = applyAdiPriceInventory(
      {
        items: [{ sku: 'MX922 | 3W-MX922', quantity: 4, unitPrice: 30.99, total: 123.96 }],
        tax: 0,
        shipping: 0,
      },
      {
        ItemList: [{
          ItemNumber: '3W-MX922',
          Quantity: 4,
          ItemPrice: '28.00',
          AllowedToBuy: 'Y',
          NationalInventory: '8',
          ReturnCode: '00',
          ReturnMessage: '',
        }],
      }
    );

    expect(priced.items[0].unitPrice).toBe(28);
    expect(priced.items[0].total).toBe(112);
    expect(priced.priceLines[0].itemNumber).toBe('3W-MX922');
    expect(
      buildAdiGenerateOrderPayload({
        customerNumber: '1',
        customerSuffix: '000',
        poNumber: 'PO-1',
        shipmentPickupIndicator: 'P',
        items: [{ sku: 'MX922 | 3W-MX922', quantity: 4, unitPrice: 30.99 }],
      }).orderList[0].ItemNumber
    ).toBe('3W-MX922');
  });

  test('does not zero a line price when ADI rejects the product node', () => {
    const result = applyAdiPriceInventory(
      {
        items: [{ sku: 'MX922 | 3W-MX922', quantity: 4, unitPrice: 30.99, total: 123.96 }],
        tax: 0,
        shipping: 0,
      },
      {
        ItemList: [{
          ItemPrice: '0',
          ReturnMessage: 'EVAL-013104: Sorry, node "412_MX922 | 3W-MX922" does not exist in dimension "PRODUCT".',
        }],
      }
    );

    expect(result.items[0].unitPrice).toBe(30.99);
    expect(result.priceLines[0].itemNumber).toBe('3W-MX922');
    expect(result.priceLines[0].itemPrice).toBe('0');
  });

  test('keeps the existing unit price when ADI does not return a price', () => {
    const result = applyAdiPriceInventory(po, {
      ItemList: [{ ItemNumber: 'LUM-2X4', ItemPrice: '', AllowedToBuy: 'Y', NationalInventory: '3' }],
    });

    expect(result.items[0].unitPrice).toBe(5.99);
    expect(result.items[0].total).toBe(299.5);
    expect(result.priceLines[0].nationalInventory).toBe('3');
    expect(result.priceLines[0].allowedToBuy).toBe('Y');
  });

  test('builds a pickup order without blank optional fields', () => {
    expect(
      buildAdiGenerateOrderPayload({
        customerNumber: 'CUST001',
        customerSuffix: '000',
        poNumber: 'PO-2024-001',
        shipmentPickupIndicator: 'P',
        referenceNumber: ' ',
        shipmentCarrier: '',
        items: [{ sku: 'LUM-2X4', quantity: 50, unitPrice: 5.99 }],
      })
    ).toEqual({
      customerNumber: 'CUST001',
      customerSuffix: '000',
      poNumber: 'PO-2024-001',
      shipmentPickupIndicator: 'P',
      orderList: [{ ItemNumber: 'LUM-2X4', Quantity: 50, ItemPrice: 5.99 }],
    });
  });

  test('includes drop-ship address and optional shipping fields for a ship order', () => {
    expect(
      buildAdiGenerateOrderPayload({
        customerNumber: 'CUST001',
        customerSuffix: '000',
        poNumber: 'PO-1',
        shipmentPickupIndicator: 's',
        shipmentCarrier: 'UPS',
        shipmentMethod: 'Ground',
        emailAddress: 'jobs@example.com',
        dropShipmentName: 'Job Site',
        dropShipmentAddress1: '1 Main',
        dropShipmentCity: 'Austin',
        dropShipmentStateProvince: 'TX',
        dropShipmentZipcode: '78701',
        items: [{ sku: 'SKU', quantity: 1, unitPrice: 2 }],
      })
    ).toEqual({
      customerNumber: 'CUST001',
      customerSuffix: '000',
      poNumber: 'PO-1',
      shipmentPickupIndicator: 'S',
      shipmentCarrier: 'UPS',
      shipmentMethod: 'Ground',
      emailAddress: 'jobs@example.com',
      dropShipmentName: 'Job Site',
      dropShipmentAddress1: '1 Main',
      dropShipmentCity: 'Austin',
      dropShipmentStateProvince: 'TX',
      dropShipmentZipcode: '78701',
      orderList: [{ ItemNumber: 'SKU', Quantity: 1, ItemPrice: 2 }],
    });
  });

  test('requires a drop-ship address when fulfillment is ship', () => {
    expect(
      validateAdiGenerateOrder({
        shipmentPickupIndicator: 'S',
        dropShipmentName: 'Job Site',
        items: [{ sku: 'SKU', quantity: 1, unitPrice: 2 }],
      })
    ).toBe('dropShipmentAddress1 is required when shipmentPickupIndicator is S');
  });

  test('reads a dedicated ADI order number before the return message', () => {
    expect(
      extractAdiOrderNumber(
        { ADIOrderNumber: '2222222222', ReturnMessage: 'Order created successfully' },
        'Order created successfully'
      )
    ).toBe('2222222222');
  });

  test('reads inquiry status from the order header when the top level has none', () => {
    expect(
      deriveAdiInquiryStatus({
        ReturnMessage: 'Order is Open',
        OrderLineHead: { Status: 'Shipped' },
      })
    ).toBe('Shipped');
  });

  test('collects shipment and cart tracking rows', () => {
    const response = {
      OrderLineHead: {
        OrderLineShipmentUnitHeadList: [
          {
            TrackingNumber: '1Z999',
            Carrier: 'UPS',
            Status: 'In Transit',
            ShipDate: '09/24/2026',
            ItemNumber: 'LUM-2X4',
            Quantity: 50,
          },
        ],
        CartShipUnitList: [{ CartNumber: 'CART1', Status: 'Packed' }],
      },
    };

    expect(collectAdiShipments(response)).toEqual([
      {
        trackingNumber: '1Z999',
        carrier: 'UPS',
        status: 'In Transit',
        shipDate: '09/24/2026',
        itemNumber: 'LUM-2X4',
        quantity: '50',
      },
    ]);
    expect(collectAdiCarts(response)).toEqual([
      { cartNumber: 'CART1', status: 'Packed', carrier: '', trackingNumber: '' },
    ]);
  });

  test('prices ADI inventory items and keeps the saved price when ADI rejects the part', () => {
    const suppliers = [
      { _id: 'adi', name: 'ADI', adiAccount: { customerNumber: '451278', customerSuffix: '000' } },
    ];
    const glassbreak = {
      sku: 'MX922 | 3W-MX922',
      description: 'DSC glassbreak',
      lastPrice: 30.99,
      preferredSupplier: { _id: 'adi', name: 'ADI' },
    };
    const lumber = { sku: 'LUM-2X4', lastPrice: 4, preferredSupplier: { _id: 'hd', name: 'Home Depot' } };

    expect(isAdiInventoryItem(glassbreak, suppliers)).toBe(true);
    expect(isAdiInventoryItem(lumber, suppliers)).toBe(false);

    const rejected = inventoryUpdateFromAdiQuote(glassbreak, {
      ItemPrice: '0',
      ReturnMessage: 'EVAL-013104 node "412_MX922 | 3W-MX922" does not exist in dimension PRODUCT',
    });
    expect(rejected.lastPrice).toBe(30.99);
    expect(rejected.adiQuote.itemNumber).toBe('3W-MX922');
    expect(rejected.adiQuote.itemPrice).toBe('');
    expect(rejected.description).toBe('DSC glassbreak');

    const priced = inventoryUpdateFromAdiQuote(glassbreak, {
      ItemNumber: '3W-MX922',
      ItemPrice: '28.00',
      AllowedToBuy: 'Y',
      NationalInventory: '12',
      ReturnMessage: '',
    });
    expect(priced.lastPrice).toBe(28);
    expect(priced.adiQuote).toMatchObject({
      itemNumber: '3W-MX922',
      itemPrice: '28.00',
      allowedToBuy: 'Y',
      nationalInventory: '12',
    });
    expect(priced.description).toBe('DSC glassbreak');
  });

  test('builds ADI inventory price lookups in batches of 50', () => {
    const suppliers = [
      { _id: 'adi', name: 'ADI', adiAccount: { customerNumber: '451278', customerSuffix: '' } },
    ];
    const items = Array.from({ length: 51 }, (_, index) => ({
      sku: `PART | ADI-${index}`,
      preferredSupplier: { _id: 'adi', name: 'ADI' },
    }));
    items.push({ sku: 'LOCAL', preferredSupplier: { _id: 'hd', name: 'Home Depot' } });

    const lookup = buildAdiInventoryLookups(items, suppliers);
    expect(lookup.account).toEqual({ customerNumber: '451278', customerSuffix: '000' });
    expect(lookup.batches).toHaveLength(2);
    expect(lookup.batches[0]).toHaveLength(50);
    expect(lookup.batches[0][0]).toEqual({ ItemNumber: 'ADI-0', Quantity: 1 });
    expect(lookup.batches[1]).toEqual([{ ItemNumber: 'ADI-50', Quantity: 1 }]);
  });

  test('offers a price lookup only for a supplier account that can price parts', () => {
    expect(supplierPriceLookupAccount({
      name: 'ADI',
      adiAccount: { customerNumber: '451278', customerSuffix: '' },
    })).toEqual({ customerNumber: '451278', customerSuffix: '000' });
    expect(supplierPriceLookupAccount({ name: 'ADI' })).toBeNull();
    expect(supplierPriceLookupAccount({ name: 'Home Depot' })).toBeNull();
  });

  test('records how much a price changed, the percent, and when it was updated', () => {
    const updatedAt = '2026-09-24T20:12:00.000Z';
    const change = priceChangeRecord(30.99, 28, updatedAt);

    expect(change).toEqual({
      previousPrice: 30.99,
      newPrice: 28,
      changeAmount: -2.99,
      changePercent: -9.65,
      updatedAt,
    });
    expect(formatPriceChangeAmount(change.changeAmount)).toBe('-$2.99');
    expect(formatPriceChangePercent(change.changePercent)).toBe('-9.65%');
    expect(formatPriceChangeAmount(priceChangeRecord(10, 15, updatedAt).changeAmount)).toBe('+$5.00');
    expect(formatPriceChangePercent(priceChangeRecord(10, 15, updatedAt).changePercent)).toBe('+50.00%');

    const fromZero = priceChangeRecord(0, 28, updatedAt);
    expect(fromZero.changeAmount).toBe(28);
    expect(fromZero.changePercent).toBeNull();
    expect(formatPriceChangePercent(fromZero.changePercent)).toBe('—');

    const rejected = inventoryUpdateFromAdiQuote(
      { sku: 'MX922 | 3W-MX922', lastPrice: 30.99 },
      { ItemPrice: '0', ReturnMessage: 'does not exist in dimension PRODUCT' }
    );
    expect(priceChangeForUpdate(30.99, rejected, updatedAt)).toBeNull();

    const history = appendPriceHistory(
      [{ previousPrice: 20, newPrice: 30.99, changeAmount: 10.99, changePercent: 54.95, updatedAt: '2026-01-01T00:00:00.000Z' }],
      30.99,
      28,
      updatedAt
    );
    expect(history[0]).toEqual(change);
    expect(history).toHaveLength(2);
  });

  test('deletes one price history entry, older entries, or extras beyond the latest few', () => {
    const history = [
      { previousPrice: 28, newPrice: 30, changeAmount: 2, changePercent: 7.14, updatedAt: '2026-09-24T20:00:00.000Z' },
      { previousPrice: 20, newPrice: 28, changeAmount: 8, changePercent: 40, updatedAt: '2026-06-01T12:00:00.000Z' },
      { previousPrice: 10, newPrice: 20, changeAmount: 10, changePercent: 100, updatedAt: '2026-01-01T12:00:00.000Z' },
    ];

    expect(removePriceHistoryAt(history, 1)).toEqual([history[0], history[2]]);
    expect(removePriceHistoryAt(history, 9)).toEqual(history);
    expect(keepLatestPriceHistory(history, 1)).toEqual([history[0]]);
    expect(keepLatestPriceHistory(history, 10)).toEqual(history);
    expect(keepLatestPriceHistory(
      Array.from({ length: 12 }, (_, index) => ({ ...history[0], updatedAt: `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` })),
      10
    )).toHaveLength(10);
  });
});
