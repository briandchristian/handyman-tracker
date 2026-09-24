/**
 * ADI purchase-order integration.
 *
 * Price and inventory results update matching PO line prices and keep
 * buy-eligibility, sale dates, and national inventory for display.
 * Order generation can pick up or ship, including the optional ADI fields.
 * Order inquiry status prefers a dedicated status field, then shipment and cart rows.
 * ADI inventory items can be priced from the same price call. A failed quote
 * keeps the saved unit price and the item description.
 */

const text = (value) => (value == null ? '' : String(value).trim());

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const skuKey = (value) => text(value).toLowerCase();

/** Catalog lines are stored as "manufacturer part | ADI item number". ADI prices the right-hand item number. */
export function adiItemNumberFromSku(sku) {
  const value = text(sku);
  const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : value;
}

export function splitCatalogSku(sku) {
  const value = text(sku);
  const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return {
      manufacturerPart: parts.slice(0, -1).join(' | '),
      adiItemNumber: parts[parts.length - 1],
    };
  }
  return { manufacturerPart: '', adiItemNumber: value };
}

export function plainAdiItemMessage(message, itemNumber = '') {
  const raw = text(message);
  if (/does not exist in dimension/i.test(raw)) {
    const quoted = raw.match(/"([^"]+)"/)?.[1] || '';
    const item = adiItemNumberFromSku(itemNumber) || adiItemNumberFromSku(quoted);
    return item ? `ADI doesn't recognize ${item}.` : `ADI doesn't recognize this item.`;
  }
  return raw;
}

export function adiSupportCode(message) {
  return text(message).match(/\bEVAL-\d+\b/)?.[0] || '';
}

export function findAdiAccount(purchaseOrders = []) {
  for (const po of purchaseOrders) {
    const supplierAccount = po?.supplier?.adiAccount;
    if (text(supplierAccount?.customerNumber)) {
      return {
        customerNumber: text(supplierAccount.customerNumber),
        customerSuffix: text(supplierAccount.customerSuffix) || '000',
        supplierId: po?.supplier?._id || '',
      };
    }
  }

  for (const po of purchaseOrders) {
    if (text(po?.adiIntegration?.customerNumber)) {
      return {
        customerNumber: text(po.adiIntegration.customerNumber),
        customerSuffix: text(po.adiIntegration.customerSuffix) || '000',
        supplierId: po?.supplier?._id || '',
      };
    }
  }

  return null;
}

export function adiAllowedLabel(value) {
  const flag = text(value).toUpperCase();
  if (flag === 'Y') return 'Yes';
  if (flag === 'N') return 'No';
  return '';
}

const quoteFailed = (quote) => /does not exist|eval-|not found|invalid/i.test(text(quote?.ReturnMessage));

const firstText = (source, keys) => {
  for (const key of keys) {
    const value = text(source?.[key]);
    if (value) return value;
  }
  return '';
};

export function applyAdiPriceInventory(po, priceResponse = {}) {
  const quotes = new Map();
  const itemList = Array.isArray(priceResponse.ItemList) ? priceResponse.ItemList : [];

  itemList.forEach((item, index) => {
    const returned = adiItemNumberFromSku(item?.ItemNumber);
    const requested = adiItemNumberFromSku(po?.items?.[index]?.sku);
    const key = skuKey(returned || requested);
    if (key) quotes.set(key, item);
  });

  const items = (po?.items || []).map((line, index) => {
    const adiSku = adiItemNumberFromSku(line?.sku);
    const quote = quotes.get(skuKey(adiSku)) || (text(itemList[index]?.ItemNumber) ? null : itemList[index]);
    if (!quote) return { ...line };

    const price = Number(quote.ItemPrice);
    if (quoteFailed(quote) || !Number.isFinite(price) || price <= 0 || text(quote.ItemPrice) === '') {
      return { ...line };
    }

    const quantity = Number(line.quantity) || 0;
    return {
      ...line,
      unitPrice: price,
      total: roundMoney(quantity * price),
    };
  });

  const subtotal = roundMoney(items.reduce((sum, line) => sum + (Number(line.total) || 0), 0));
  const tax = Number(po?.tax) || 0;
  const shipping = Number(po?.shipping) || 0;
  const matchedKeys = new Set(
    items.map((line) => skuKey(line.sku)).filter((key) => quotes.has(key))
  );

  return {
    items,
    subtotal,
    tax,
    shipping,
    total: roundMoney(subtotal + tax + shipping),
    priceLines: itemList.map((item, index) => ({
      itemNumber: text(item?.ItemNumber) || adiItemNumberFromSku(po?.items?.[index]?.sku),
      quantity: Number(item?.Quantity) || 0,
      itemPrice: text(item?.ItemPrice),
      allowedToBuy: text(item?.AllowedToBuy),
      saleStartDate: text(item?.SaleStartDate || item?.ItemSaleStartDate),
      saleEndDate: text(item?.SaleEndDate || item?.ItemSaleEndDate),
      nationalInventory: text(item?.NationalInventory || item?.ItemNationalInventory),
      returnCode: text(item?.ReturnCode),
      returnMessage: text(item?.ReturnMessage),
    })),
    unmatchedSkus: (po?.items || [])
      .map((line) => text(line?.sku))
      .filter((sku) => sku && !matchedKeys.has(skuKey(sku))),
  };
}

const OPTIONAL_ORDER_FIELDS = [
  'referenceNumber',
  'shipmentComplete',
  'shipmentCarrier',
  'shipmentMethod',
  'pickupDC',
  'promoCode',
  'promoCodeType',
  'emailAddress',
  'dropShipmentName',
  'dropShipmentAddress1',
  'dropShipmentAddress2',
  'dropShipmentAddress3',
  'dropShipmentCity',
  'dropShipmentStateProvince',
  'dropShipmentZipcode',
  'dropShipmentCountryCode',
];

export function buildAdiGenerateOrderPayload(form = {}) {
  const indicator = text(form.shipmentPickupIndicator || 'P').toUpperCase();
  const payload = {
    customerNumber: text(form.customerNumber),
    customerSuffix: text(form.customerSuffix),
    poNumber: text(form.poNumber),
    shipmentPickupIndicator: indicator,
    orderList: (form.items || []).map((item) => ({
      ItemNumber: adiItemNumberFromSku(item.sku),
      Quantity: Number(item.quantity) || 0,
      ItemPrice: Number(item.unitPrice) || 0,
    })),
  };

  OPTIONAL_ORDER_FIELDS.forEach((field) => {
    const value = text(form[field]);
    if (value) payload[field] = field === 'shipmentComplete' ? value.toUpperCase() : value;
  });

  return payload;
}

export function validateAdiGenerateOrder(form = {}) {
  const indicator = text(form.shipmentPickupIndicator || 'P').toUpperCase();
  if (indicator !== 'S') return '';

  const required = [
    ['dropShipmentName', 'dropShipmentName is required when shipmentPickupIndicator is S'],
    ['dropShipmentAddress1', 'dropShipmentAddress1 is required when shipmentPickupIndicator is S'],
    ['dropShipmentCity', 'dropShipmentCity is required when shipmentPickupIndicator is S'],
    ['dropShipmentStateProvince', 'dropShipmentStateProvince is required when shipmentPickupIndicator is S'],
    ['dropShipmentZipcode', 'dropShipmentZipcode is required when shipmentPickupIndicator is S'],
  ];

  for (const [field, message] of required) {
    if (!text(form[field])) return message;
  }

  return '';
}

export function extractAdiOrderNumber(orderGenerationResponse = {}, fallbackMessage = '') {
  const candidates = [
    orderGenerationResponse?.ADIOrderNumber,
    orderGenerationResponse?.AdiOrderNumber,
    orderGenerationResponse?.OrderNumber,
    orderGenerationResponse?.orderNumber,
    orderGenerationResponse?.OrderNo,
    orderGenerationResponse?.OrderID,
    fallbackMessage,
  ];

  for (const candidate of candidates) {
    const match = text(candidate).match(/\b\d{10}\b/);
    if (match?.[0]) return match[0];
  }

  return '';
}

export function deriveAdiInquiryStatus(inquiryResponse = {}) {
  const head = inquiryResponse?.OrderLineHead || {};
  const directStatus = [
    inquiryResponse?.OrderStatus,
    inquiryResponse?.Status,
    inquiryResponse?.OrderState,
    head.OrderStatus,
    head.Status,
    head.OrderState,
  ].find((value) => typeof value === 'string' && value.trim());

  if (directStatus) return directStatus.trim();

  const message = inquiryResponse?.ReturnMessage;
  if (typeof message === 'string' && message.trim()) {
    const statusMatch = message.match(/\b(open|closed|shipped|cancelled|confirmed|delivered|processing)\b/i);
    if (statusMatch?.[1]) {
      const word = statusMatch[1].toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return message.trim();
  }

  return 'Unknown';
}

const mapTrackingRow = (unit, fields) => {
  const row = {};
  Object.entries(fields).forEach(([name, keys]) => {
    row[name] = firstText(unit, keys);
  });
  return row;
};

const hasTrackingValue = (row) => Object.values(row).some((value) => text(value));

export function collectAdiShipments(inquiryResponse = {}) {
  const list = inquiryResponse?.OrderLineHead?.OrderLineShipmentUnitHeadList;
  if (!Array.isArray(list)) return [];

  return list
    .map((unit) =>
      mapTrackingRow(unit, {
        trackingNumber: ['TrackingNumber', 'trackingNumber', 'ProNumber'],
        carrier: ['Carrier', 'ShipmentCarrier', 'carrier'],
        status: ['Status', 'OrderStatus', 'ShipmentStatus'],
        shipDate: ['ShipDate', 'ShipmentDate', 'shipDate'],
        itemNumber: ['ItemNumber', 'itemNumber'],
        quantity: ['Quantity', 'quantity'],
      })
    )
    .filter(hasTrackingValue);
}

const supplierId = (supplier) => text(supplier?._id || supplier);

export function isAdiSupplier(supplier) {
  if (!supplier || typeof supplier !== 'object') return false;
  if (text(supplier.adiAccount?.customerNumber)) return true;
  return /^adi\b/i.test(text(supplier.name));
}

export function resolveInventorySupplier(item, suppliers = []) {
  const embedded = item?.preferredSupplier;
  const id = supplierId(embedded);
  const listed = suppliers.find((supplier) => supplierId(supplier) === id);
  if (!listed) return embedded && typeof embedded === 'object' ? embedded : null;
  return {
    ...listed,
    ...(typeof embedded === 'object' ? embedded : {}),
    name: text(embedded?.name) || text(listed.name),
    adiAccount: text(embedded?.adiAccount?.customerNumber) ? embedded.adiAccount : listed.adiAccount,
  };
}

export function isAdiInventoryItem(item, suppliers = []) {
  return isAdiSupplier(resolveInventorySupplier(item, suppliers));
}

/** A supplier can price parts only when its account is connected to a price API. */
export function supplierPriceLookupAccount(supplier) {
  const customerNumber = text(supplier?.adiAccount?.customerNumber);
  if (!customerNumber) return null;
  return {
    customerNumber,
    customerSuffix: text(supplier?.adiAccount?.customerSuffix) || '000',
  };
}

/**
 * A successful price update keeps the previous price, the new price,
 * the dollar and percent change, and the time of the update.
 * Percent is omitted when there was no previous price to compare.
 */
export function priceChangeRecord(previousPrice, newPrice, updatedAt = new Date()) {
  const previous = roundMoney(Math.max(0, Number(previousPrice) || 0));
  const next = roundMoney(Math.max(0, Number(newPrice) || 0));
  const changeAmount = roundMoney(next - previous);
  const changePercent = previous > 0 ? roundMoney((changeAmount / previous) * 100) : null;
  const when = new Date(updatedAt);

  return {
    previousPrice: previous,
    newPrice: next,
    changeAmount,
    changePercent,
    updatedAt: Number.isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString(),
  };
}

export function priceChangeForUpdate(previousPrice, update, updatedAt = new Date()) {
  if (!text(update?.adiQuote?.itemPrice)) return null;
  return priceChangeRecord(previousPrice, update?.lastPrice, updatedAt);
}

export function appendPriceHistory(history, previousPrice, newPrice, updatedAt = new Date()) {
  return [priceChangeRecord(previousPrice, newPrice, updatedAt), ...(Array.isArray(history) ? history : [])];
}

/** Newest entries stay at the front. An out-of-range index leaves the list unchanged. */
export function removePriceHistoryAt(history = [], index) {
  const list = Array.isArray(history) ? history : [];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return list;
  return list.filter((_, entryIndex) => entryIndex !== index);
}

/** Keep the newest entries. History is stored newest first. */
export function keepLatestPriceHistory(history = [], count) {
  const list = Array.isArray(history) ? history : [];
  const limit = Math.max(0, Number(count) || 0);
  return list.slice(0, limit);
}

export function formatPriceChangeAmount(amount) {
  const value = roundMoney(amount);
  const body = Math.abs(value).toFixed(2);
  if (value > 0) return `+$${body}`;
  if (value < 0) return `-$${body}`;
  return `$${body}`;
}

export function formatPriceChangePercent(percent) {
  if (percent == null || percent === '' || !Number.isFinite(Number(percent))) return '—';
  const value = roundMoney(percent);
  const body = Math.abs(value).toFixed(2);
  if (value > 0) return `+${body}%`;
  if (value < 0) return `-${body}%`;
  return `${body}%`;
}

export function inventoryUpdateFromAdiQuote(item, quote = {}) {
  const price = Number(quote.ItemPrice);
  const failed = quoteFailed(quote) || !Number.isFinite(price) || price <= 0 || text(quote.ItemPrice) === '';
  const itemNumber = adiItemNumberFromSku(quote.ItemNumber) || adiItemNumberFromSku(item?.sku);

  return {
    description: text(item?.description),
    lastPrice: failed ? Math.max(0, Number(item?.lastPrice) || 0) : price,
    adiQuote: {
      itemNumber,
      itemPrice: failed ? '' : price.toFixed(2),
      allowedToBuy: text(quote.AllowedToBuy),
      nationalInventory: text(quote.NationalInventory || quote.ItemNationalInventory),
      saleStartDate: text(quote.SaleStartDate || quote.ItemSaleStartDate),
      saleEndDate: text(quote.SaleEndDate || quote.ItemSaleEndDate),
      returnMessage: text(quote.ReturnMessage),
      checkedAt: new Date().toISOString(),
    },
  };
}

export function buildAdiInventoryLookups(items = [], suppliers = []) {
  const adiItems = items.filter(
    (item) => isAdiInventoryItem(item, suppliers) && adiItemNumberFromSku(item?.sku)
  );
  const accountSource = adiItems
    .map((item) => resolveInventorySupplier(item, suppliers))
    .find((supplier) => text(supplier?.adiAccount?.customerNumber));
  const batches = [];

  for (let index = 0; index < adiItems.length; index += 50) {
    batches.push(
      adiItems.slice(index, index + 50).map((item) => ({
        ItemNumber: adiItemNumberFromSku(item.sku),
        Quantity: 1,
      }))
    );
  }

  return {
    adiItems,
    batches,
    account: accountSource
      ? {
          customerNumber: text(accountSource.adiAccount.customerNumber),
          customerSuffix: text(accountSource.adiAccount.customerSuffix) || '000',
        }
      : null,
  };
}

export function collectAdiCarts(inquiryResponse = {}) {
  const list = inquiryResponse?.OrderLineHead?.CartShipUnitList;
  if (!Array.isArray(list)) return [];

  return list
    .map((unit) =>
      mapTrackingRow(unit, {
        cartNumber: ['CartNumber', 'cartNumber', 'CartId'],
        status: ['Status', 'OrderStatus'],
        carrier: ['Carrier', 'ShipmentCarrier'],
        trackingNumber: ['TrackingNumber', 'trackingNumber'],
      })
    )
    .filter(hasTrackingValue);
}
