import axios from 'axios';
import API_BASE_URL from '../config/api';

/**
 * Lightweight frontend wrapper for ADI backend routes.
 * Keeps route paths and auth-header handling standardized across the UI.
 */

const getAuthToken = (tokenOverride) => tokenOverride || localStorage.getItem('token');

const getAuthHeaders = (tokenOverride) => {
  const token = getAuthToken(tokenOverride);
  if (!token) {
    throw new Error('Authentication token is required for ADI supplier API calls');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const postAdi = (path, payload, options = {}) =>
  axios.post(`${API_BASE_URL}${path}`, payload, {
    headers: getAuthHeaders(options.token),
  });

export const fetchAdiPriceInventory = (payload, options = {}) =>
  postAdi('/api/suppliers/adi/price-inventory', payload, options).then((res) => res.data);

export const generateAdiOrder = (payload, options = {}) =>
  postAdi('/api/suppliers/adi/order-generation', payload, options).then((res) => res.data);

export const inquireAdiOrder = (payload, options = {}) =>
  postAdi('/api/suppliers/adi/order-inquiry', payload, options).then((res) => res.data);

