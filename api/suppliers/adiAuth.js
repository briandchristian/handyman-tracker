import crypto from 'crypto';

/**
 * ADI Supplier API - Phase 1 Authentication helpers.
 * The API secret key is Base64-decoded before SHA256 HMAC signing.
 */

const REQUIRED_FIELDS = [
  'apiKey',
  'apiPassword',
  'apiSecretKey',
  'clientRequestId',
  'timestamp',
];

const assertRequiredFields = (params) => {
  for (const field of REQUIRED_FIELDS) {
    if (params[field] === undefined || params[field] === null || params[field] === '') {
      throw new Error(`${field} is required`);
    }
  }
};

export const createAdiAuthenticationSignature = ({
  apiKey,
  apiPassword,
  apiSecretKey,
  clientRequestId,
  timestamp,
}) => {
  assertRequiredFields({
    apiKey,
    apiPassword,
    apiSecretKey,
    clientRequestId,
    timestamp,
  });

  const message = `${apiKey}${apiPassword}${clientRequestId}${timestamp}`;
  const secretKeyBytes = Buffer.from(apiSecretKey, 'base64');

  return crypto
    .createHmac('sha256', secretKeyBytes)
    .update(message, 'utf8')
    .digest('base64');
};

export const buildAdiAuthHeaders = ({
  apiKey,
  apiPassword,
  apiSecretKey,
  clientRequestId,
  timestamp,
}) => {
  const signature = createAdiAuthenticationSignature({
    apiKey,
    apiPassword,
    apiSecretKey,
    clientRequestId,
    timestamp,
  });

  return {
    'Api-Key': apiKey,
    'Authentication-Signature': signature,
    'Client-Request-Id': clientRequestId,
    Timestamp: String(timestamp),
  };
};

