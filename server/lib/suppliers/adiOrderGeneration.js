import crypto from 'crypto';
import axios from 'axios';
import { buildAdiAuthHeaders } from './adiAuth.js';

/**
 * ADI Supplier API - Phase 3 (Order Generation)
 *
 * Endpoint from ADI docs:
 * POST /adi/api/v1/Order/GenerateOrder
 */
export const ADI_ORDER_GENERATION_PATH =
  'https://api.adiglobal.com/adi/api/v1/Order/GenerateOrder';

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const validateOrderList = (orderList) => {
  if (!Array.isArray(orderList) || orderList.length === 0) {
    throw new Error('orderList is required and must contain at least one item');
  }

  orderList.forEach((item, index) => {
    if (isBlank(item?.ItemNumber)) {
      throw new Error(`OrderList[${index}].ItemNumber is required`);
    }

    const quantity = Number(item?.Quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`OrderList[${index}].Quantity must be a positive number`);
    }

    const itemPrice = Number(item?.ItemPrice);
    if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
      throw new Error(`OrderList[${index}].ItemPrice must be a positive number`);
    }
  });
};

const validateShippingFields = ({
  shipmentPickupIndicator,
  dropShipmentName,
  dropShipmentAddress1,
  dropShipmentCity,
  dropShipmentStateProvince,
  dropShipmentZipcode,
}) => {
  if (isBlank(shipmentPickupIndicator)) {
    throw new Error('shipmentPickupIndicator is required');
  }

  const indicator = String(shipmentPickupIndicator).trim().toUpperCase();
  if (!['S', 'P'].includes(indicator)) {
    throw new Error('shipmentPickupIndicator must be either "S" (Ship) or "P" (Pickup)');
  }

  if (indicator === 'S') {
    if (isBlank(dropShipmentName)) {
      throw new Error('dropShipmentName is required when shipmentPickupIndicator is S');
    }
    if (isBlank(dropShipmentAddress1)) {
      throw new Error('dropShipmentAddress1 is required when shipmentPickupIndicator is S');
    }
    if (isBlank(dropShipmentCity)) {
      throw new Error('dropShipmentCity is required when shipmentPickupIndicator is S');
    }
    if (isBlank(dropShipmentStateProvince)) {
      throw new Error('dropShipmentStateProvince is required when shipmentPickupIndicator is S');
    }
    if (isBlank(dropShipmentZipcode)) {
      throw new Error('dropShipmentZipcode is required when shipmentPickupIndicator is S');
    }
  }
};

const validateRequest = ({
  customerNumber,
  customerSuffix,
  poNumber,
  shipmentPickupIndicator,
  orderList,
  dropShipmentName,
  dropShipmentAddress1,
  dropShipmentCity,
  dropShipmentStateProvince,
  dropShipmentZipcode,
}) => {
  if (isBlank(customerNumber)) {
    throw new Error('customerNumber is required');
  }
  if (isBlank(customerSuffix)) {
    throw new Error('customerSuffix is required');
  }
  if (isBlank(poNumber)) {
    throw new Error('poNumber is required');
  }

  validateShippingFields({
    shipmentPickupIndicator,
    dropShipmentName,
    dropShipmentAddress1,
    dropShipmentCity,
    dropShipmentStateProvince,
    dropShipmentZipcode,
  });
  validateOrderList(orderList);
};

export const normalizeAdiOrderGenerationResponse = (response = {}) => ({
  ReturnCode: response.ReturnCode ?? '',
  ReturnMessage: response.ReturnMessage ?? '',
});

export const fetchAdiOrderGeneration = async ({
  credentials,
  customerNumber,
  customerSuffix,
  poNumber,
  referenceNumber,
  shipmentPickupIndicator,
  shipmentComplete,
  shipmentCarrier,
  shipmentMethod,
  pickupDC,
  promoCode,
  promoCodeType,
  emailAddress,
  dropShipmentName,
  dropShipmentAddress1,
  dropShipmentAddress2,
  dropShipmentAddress3,
  dropShipmentCity,
  dropShipmentStateProvince,
  dropShipmentZipcode,
  dropShipmentCountryCode,
  orderList,
  clientRequestId = crypto.randomUUID(),
  timestamp = Date.now(),
  endpoint = ADI_ORDER_GENERATION_PATH,
  httpClient = axios,
}) => {
  validateRequest({
    customerNumber,
    customerSuffix,
    poNumber,
    shipmentPickupIndicator,
    orderList,
    dropShipmentName,
    dropShipmentAddress1,
    dropShipmentCity,
    dropShipmentStateProvince,
    dropShipmentZipcode,
  });

  const indicator = String(shipmentPickupIndicator).trim().toUpperCase();

  const payload = {
    CustomerNumber: String(customerNumber).trim(),
    CustomerSuffix: String(customerSuffix).trim(),
    PONumber: String(poNumber).trim(),
    ShipmentPickupIndicator: indicator,
    OrderList: orderList.map((item) => ({
      ItemNumber: String(item.ItemNumber).trim(),
      Quantity: Number(item.Quantity),
      ItemPrice: Number(item.ItemPrice),
    })),
  };

  if (!isBlank(referenceNumber)) payload.ReferenceNumber = String(referenceNumber).trim();
  if (!isBlank(shipmentComplete)) payload.ShipmentComplete = String(shipmentComplete).trim().toUpperCase();
  if (!isBlank(shipmentCarrier)) payload.ShipmentCarrier = String(shipmentCarrier).trim();
  if (!isBlank(shipmentMethod)) payload.ShipmentMethod = String(shipmentMethod).trim();
  if (!isBlank(pickupDC)) payload.PickupDC = String(pickupDC).trim();
  if (!isBlank(promoCode)) payload.PromoCode = String(promoCode).trim();
  if (!isBlank(promoCodeType)) payload.PromoCodeType = String(promoCodeType).trim();
  if (!isBlank(emailAddress)) payload.EmailAddress = String(emailAddress).trim();
  if (!isBlank(dropShipmentName)) payload.DropShipmentName = String(dropShipmentName).trim();
  if (!isBlank(dropShipmentAddress1)) payload.DropShipmentAddress1 = String(dropShipmentAddress1).trim();
  if (!isBlank(dropShipmentAddress2)) payload.DropShipmentAddress2 = String(dropShipmentAddress2).trim();
  if (!isBlank(dropShipmentAddress3)) payload.DropShipmentAddress3 = String(dropShipmentAddress3).trim();
  if (!isBlank(dropShipmentCity)) payload.DropShipmentCity = String(dropShipmentCity).trim();
  if (!isBlank(dropShipmentStateProvince)) payload.DropShipmentStateProvince = String(dropShipmentStateProvince).trim();
  if (!isBlank(dropShipmentZipcode)) payload.DropShipmentZipcode = String(dropShipmentZipcode).trim();
  if (!isBlank(dropShipmentCountryCode)) payload.DropShipmentCountryCode = String(dropShipmentCountryCode).trim();

  const authHeaders = buildAdiAuthHeaders({
    apiKey: credentials?.apiKey,
    apiPassword: credentials?.apiPassword,
    apiSecretKey: credentials?.apiSecretKey,
    clientRequestId,
    timestamp,
  });

  const response = await httpClient.post(endpoint, payload, {
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
  });

  return normalizeAdiOrderGenerationResponse(response?.data);
};

