import crypto from 'crypto';
import axios from 'axios';
import { buildAdiAuthHeaders } from './adiAuth.js';

/**
 * ADI Supplier API - Phase 2 (Price and Inventory)
 *
 * Endpoint from ADI docs:
 * POST /adi/api/v1/PriceAndInventory/PriceAndInventoryDetails
 */
export const ADI_PRICE_AND_INVENTORY_PATH =
  'https://api.adiglobal.com/adi/api/v1/PriceAndInventory/PriceAndInventoryDetails';

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const validateItemList = (itemList) => {
  if (!Array.isArray(itemList) || itemList.length === 0) {
    throw new Error('itemList is required and must contain at least one item');
  }

  if (itemList.length > 50) {
    throw new Error('itemList cannot contain more than 50 items');
  }

  itemList.forEach((item, index) => {
    if (isBlank(item?.ItemNumber)) {
      throw new Error(`ItemList[${index}].ItemNumber is required`);
    }

    const quantity = Number(item?.Quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`ItemList[${index}].Quantity must be a positive number`);
    }
  });
};

const validateRequest = ({ customerNumber, customerSuffix, itemList }) => {
  if (isBlank(customerNumber)) {
    throw new Error('customerNumber is required');
  }

  if (isBlank(customerSuffix)) {
    throw new Error('customerSuffix is required');
  }

  validateItemList(itemList);
};

export const normalizeAdiPriceAndInventoryResponse = (response = {}) => ({
  CustomerNumber: response.CustomerNumber ?? '',
  CustomerSuffix: response.CustomerSuffix ?? '',
  ReturnCode: response.ReturnCode ?? '',
  ReturnMessage: response.ReturnMessage ?? '',
  ItemList: Array.isArray(response.ItemList)
    ? response.ItemList.map((item) => ({
        ItemNumber: item.ItemNumber ?? '',
        Quantity: item.Quantity ?? 0,
        ItemPrice: item.ItemPrice ?? '',
        AllowedToBuy: item.AllowedToBuy ?? '',
        SaleStartDate: item.SaleStartDate ?? item.ItemSaleStartDate ?? '',
        SaleEndDate: item.SaleEndDate ?? item.ItemSaleEndDate ?? '',
        NationalInventory: item.NationalInventory ?? item.ItemNationalInventory ?? '',
        ReturnCode: item.ReturnCode ?? '',
        ReturnMessage: item.ReturnMessage ?? '',
      }))
    : [],
});

export const fetchAdiPriceAndInventoryDetails = async ({
  credentials,
  customerNumber,
  customerSuffix,
  itemList,
  clientRequestId = crypto.randomUUID(),
  timestamp = Date.now(),
  endpoint = ADI_PRICE_AND_INVENTORY_PATH,
  httpClient = axios,
}) => {
  validateRequest({ customerNumber, customerSuffix, itemList });

  const payload = {
    CustomerNumber: String(customerNumber).trim(),
    CustomerSuffix: String(customerSuffix).trim(),
    ItemList: itemList.map((item) => ({
      ItemNumber: String(item.ItemNumber).trim(),
      Quantity: Number(item.Quantity),
    })),
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

  return normalizeAdiPriceAndInventoryResponse(response?.data);
};

