/**
 * ADI Supplier API - Phase 1 (Authentication)
 *
 * This suite validates the ADI Authentication-Signature algorithm and
 * required request headers so future phases (price/inventory, orders)
 * can reuse a trusted auth helper.
 */

import {
  buildAdiAuthHeaders,
  createAdiAuthenticationSignature,
} from '../suppliers/adiAuth.js';

describe('ADI authentication helpers', () => {
  const credentials = {
    apiKey: 'API00483',
    apiPassword: 'f2c46d810212477c',
    apiSecretKey: 'OTUzMWRlZThhZjM0MDlhZA==',
  };

  const requestMeta = {
    clientRequestId: 'e95d18b5-5dae-4b52-9109-6fe0a81e0018',
    timestamp: 4293512740888,
  };

  test('creates the expected ADI Authentication-Signature from the official sample', () => {
    const signature = createAdiAuthenticationSignature({
      ...credentials,
      ...requestMeta,
    });

    expect(signature).toBe('Y1v6iZDrwSBYUbI24BchyLQ1q+kvRSS1gZ76Q8i9IQk=');
  });

  test('builds all required auth headers with matching signature inputs', () => {
    const headers = buildAdiAuthHeaders({
      ...credentials,
      ...requestMeta,
    });

    expect(headers).toEqual({
      'Api-Key': credentials.apiKey,
      'Authentication-Signature': 'Y1v6iZDrwSBYUbI24BchyLQ1q+kvRSS1gZ76Q8i9IQk=',
      'Client-Request-Id': requestMeta.clientRequestId,
      Timestamp: String(requestMeta.timestamp),
    });
  });

  test('throws a clear error when a required authentication field is missing', () => {
    expect(() =>
      createAdiAuthenticationSignature({
        apiKey: '',
        apiPassword: credentials.apiPassword,
        apiSecretKey: credentials.apiSecretKey,
        clientRequestId: requestMeta.clientRequestId,
        timestamp: requestMeta.timestamp,
      })
    ).toThrow('apiKey is required');
  });
});
