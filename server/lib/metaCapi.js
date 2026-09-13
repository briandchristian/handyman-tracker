/**
 * Meta Conversions API (CAPI) — server-side `Lead` events.
 *
 * The browser Meta Pixel in `index.html` fires PageView, and `Login.jsx` fires
 * a `Lead` event when a bid request succeeds. Browser pixels are routinely lost
 * to ad blockers and iOS tracking restrictions, so this module sends the same
 * conversion from the server, where it cannot be blocked.
 *
 * Privacy: email and phone are personally identifiable and are SHA-256 hashed
 * before transmission, as Meta's advanced matching requires. Values are
 * normalized first (email lowercased/trimmed, phone reduced to digits) because
 * Meta hashes its own side the same way — an unnormalized hash simply won't
 * match. Raw email and phone never leave this process.
 *
 * Configuration (see docs/META_CONVERSIONS_API.md):
 *   META_CAPI_ACCESS_TOKEN — required to enable. Generate in Meta Events
 *                            Manager. When absent, every send silently no-ops.
 *   META_PIXEL_ID          — optional; defaults to the Christian Security
 *                            Services pixel.
 *
 * This module never throws and never rejects. Failures are reported through the
 * returned result object so that an outage, a bad token, or a network error can
 * never break or delay a customer's bid submission.
 */

import { createHash } from 'crypto';

/** Christian Security Services Meta Pixel, matching index.html. */
export const DEFAULT_META_PIXEL_ID = '1987889385503166';

export const META_GRAPH_API_VERSION = 'v21.0';

/** SHA-256 hex digest of a value, coercing null/undefined to an empty string. */
export function sha256Hex(value) {
  return createHash('sha256')
    .update(String(value ?? ''), 'utf8')
    .digest('hex');
}

/** Meta expects emails lowercased and trimmed before hashing. */
export function normalizeEmail(email) {
  if (email === undefined || email === null) return '';
  return String(email).trim().toLowerCase();
}

/** Meta expects phone numbers stripped to digits before hashing. */
export function normalizePhone(phone) {
  if (phone === undefined || phone === null) return '';
  return String(phone).replace(/\D/g, '');
}

/** Hashed email, or undefined when there is nothing meaningful to hash. */
export function hashEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized ? sha256Hex(normalized) : undefined;
}

/** Hashed phone, or undefined when there is nothing meaningful to hash. */
export function hashPhone(phone) {
  const normalized = normalizePhone(phone);
  return normalized ? sha256Hex(normalized) : undefined;
}

/**
 * Resolve CAPI settings from an environment bag. `enabled` is false whenever an
 * access token is missing or blank, which is the feature's off switch.
 */
export function getMetaCapiConfig(env = process.env) {
  const accessToken = String(env.META_CAPI_ACCESS_TOKEN || '').trim();
  const pixelId =
    String(env.META_PIXEL_ID || '').trim() || DEFAULT_META_PIXEL_ID;

  return { accessToken, pixelId, enabled: Boolean(accessToken) };
}

/**
 * Build a Conversions API `Lead` event. Only hashed identifiers and
 * non-identifying request context are included; the caller's `name` is
 * deliberately not transmitted.
 */
export function buildLeadEvent({
  email,
  phone,
  eventSourceUrl,
  clientIpAddress,
  clientUserAgent,
  eventTime,
} = {}) {
  const userData = {};

  const hashedEmail = hashEmail(email);
  const hashedPhone = hashPhone(phone);
  if (hashedEmail) userData.em = [hashedEmail];
  if (hashedPhone) userData.ph = [hashedPhone];
  if (clientIpAddress) userData.client_ip_address = clientIpAddress;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  const event = {
    event_name: 'Lead',
    event_time: Number.isInteger(eventTime)
      ? eventTime
      : Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: userData,
  };
  if (eventSourceUrl) event.event_source_url = eventSourceUrl;

  return event;
}

/**
 * Send a `Lead` event to Meta. Resolves to a result object describing what
 * happened; it never throws and never rejects.
 *
 * @returns {Promise<{sent: boolean, reason?: string, status?: number}>}
 *   `{ sent: false, reason: 'disabled' }`   — no access token configured
 *   `{ sent: false, reason: 'no-fetch' }`   — no fetch implementation available
 *   `{ sent: false, reason: 'http-error' }` — Meta rejected the event
 *   `{ sent: false, reason: 'exception' }`  — network or serialization failure
 *   `{ sent: true, status }`                — accepted by Meta
 */
export async function sendMetaLeadEvent(lead = {}, options = {}) {
  try {
    const { env = process.env, fetchImpl = globalThis.fetch } = options;

    const config = getMetaCapiConfig(env);
    if (!config.enabled) {
      return { sent: false, reason: 'disabled' };
    }
    if (typeof fetchImpl !== 'function') {
      return { sent: false, reason: 'no-fetch' };
    }

    // Access token goes in the body, not the query string, so it cannot leak
    // into request logs or error messages that echo the URL.
    const response = await fetchImpl(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${config.pixelId}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [buildLeadEvent(lead)],
          access_token: config.accessToken,
        }),
      }
    );

    if (!response || !response.ok) {
      let detail = '';
      try {
        detail =
          response && typeof response.text === 'function'
            ? await response.text()
            : '';
      } catch (_) {
        detail = '';
      }
      console.error(
        'Meta CAPI Lead event rejected:',
        response?.status,
        detail
      );
      return { sent: false, reason: 'http-error', status: response?.status };
    }

    return { sent: true, status: response.status };
  } catch (err) {
    console.error('Meta CAPI Lead event failed:', err?.message || err);
    return { sent: false, reason: 'exception' };
  }
}
