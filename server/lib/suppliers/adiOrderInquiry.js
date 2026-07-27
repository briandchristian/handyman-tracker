import crypto from 'crypto';
import axios from 'axios';
import { buildAdiAuthHeaders } from './adiAuth.js';

/**
 * ADI Supplier API - Phase 4 (Order Inquiry)
 *
 * Endpoint from ADI docs:
 * POST /adi/api/v1/Order/OrderTracking
 */
export const ADI_ORDER_INQUIRY_PATH =
  'https://api.adiglobal.com/adi/api/v1/Order/OrderTracking';

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const validateRequest = ({ customerNumber, customerSuffix, adiOrderNumber }) => {
  if (isBlank(customerNumber)) {
    throw new Error('customerNumber is required');
  }
  if (isBlank(customerSuffix)) {
    throw new Error('customerSuffix is required');
  }
  if (isBlank(adiOrderNumber)) {
    throw new Error('adiOrderNumber is required');
  }
};

export const normalizeAdiOrderInquiryResponse = (response = {}) => ({
  CustomerNumber: response.CustomerNumber ?? '',
  CustomerSuffix: response.CustomerSuffix ?? '',
  ADIOrderNumber: response.ADIOrderNumber ?? '',
  ReturnCode: response.ReturnCode ?? '',
  ReturnMessage: response.ReturnMessage ?? '',
  OrderLineHead: {
    ...(response.OrderLineHead || {}),
    OrderLineShipmentUnitHeadList: Array.isArray(response.OrderLineHead?.OrderLineShipmentUnitHeadList)
      ? response.OrderLineHead.OrderLineShipmentUnitHeadList
      : [],
    CartShipUnitList: Array.isArray(response.OrderLineHead?.CartShipUnitList)
      ? response.OrderLineHead.CartShipUnitList
      : [],
  },
});

export const fetchAdiOrderInquiry = async ({
  credentials,
  customerNumber,
  customerSuffix,
  adiOrderNumber,
  clientRequestId = crypto.randomUUID(),
  timestamp = Date.now(),
  endpoint = ADI_ORDER_INQUIRY_PATH,
  httpClient = axios,
}) => {
  validateRequest({ customerNumber, customerSuffix, adiOrderNumber });

  const payload = {
    CustomerNumber: String(customerNumber).trim(),
    CustomerSuffix: String(customerSuffix).trim(),
    ADIOrderNumber: String(adiOrderNumber).trim(),
  };

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

  return normalizeAdiOrderInquiryResponse(response?.data);
};

