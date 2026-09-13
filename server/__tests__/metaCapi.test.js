/**
 * Unit tests for the Meta Conversions API (CAPI) helper.
 *
 * The helper sends a server-side `Lead` event to Meta when a public bid request
 * is submitted. Browser pixels are frequently blocked (ad blockers, iOS tracking
 * restrictions), so the server-side signal is the more reliable of the two.
 *
 * Rules the helper must honour:
 *  - Email and phone are PII and must be SHA-256 hashed before transmission.
 *    Email is lowercased/trimmed first; phone is reduced to digits only.
 *  - Raw email/phone must never appear in the outgoing payload.
 *  - When `META_CAPI_ACCESS_TOKEN` is absent the feature silently no-ops, so the
 *    app works perfectly before an access token has been generated.
 *  - The helper never throws and never rejects; failures are reported via the
 *    returned result object so a CAPI outage can't break a bid submission.
 */

import {
  DEFAULT_META_PIXEL_ID,
  buildLeadEvent,
  getMetaCapiConfig,
  hashEmail,
  hashPhone,
  normalizeEmail,
  normalizePhone,
  sendMetaLeadEvent,
  sha256Hex,
} from '../lib/metaCapi.js';

// Known-good SHA-256 values used as fixed anchors so a broken hash
// implementation cannot silently agree with the test.
const SHA256_ABC =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const SHA256_EMPTY =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const SHA256_JOHN_AT_EXAMPLE =
  '855f96e983f1f8e8be944692b6f719fd54329826cb62e98015efee8e2e071dd4';
const SHA256_9312797879 =
  '37aa61cf93eafdbe2a31163b441853f9ed1e099a8d711ffa93e8065324bc4c53';

describe('sha256Hex', () => {
  test('matches the standard SHA-256 test vector for "abc"', () => {
    expect(sha256Hex('abc')).toBe(SHA256_ABC);
  });

  test('hashes the empty string to the known SHA-256 value', () => {
    expect(sha256Hex('')).toBe(SHA256_EMPTY);
  });

  test('returns a 64 character lowercase hex digest', () => {
    expect(sha256Hex('anything')).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic and case sensitive', () => {
    expect(sha256Hex('Value')).toBe(sha256Hex('Value'));
    expect(sha256Hex('Value')).not.toBe(sha256Hex('value'));
  });
});

describe('normalizeEmail', () => {
  test('lowercases and trims', () => {
    expect(normalizeEmail('  John@Example.COM  ')).toBe('john@example.com');
  });

  test('leaves an already normalized email untouched', () => {
    expect(normalizeEmail('john@example.com')).toBe('john@example.com');
  });

  test.each([undefined, null, '', '   '])(
    'returns empty string for %p',
    (input) => {
      expect(normalizeEmail(input)).toBe('');
    }
  );

  test('coerces non-string input safely', () => {
    expect(normalizeEmail(12345)).toBe('12345');
  });
});

describe('normalizePhone', () => {
  test('strips all non-digit characters', () => {
    expect(normalizePhone('(931) 279-7879')).toBe('9312797879');
  });

  test('strips dashes, dots, spaces and plus signs', () => {
    expect(normalizePhone('+1 555.123.4567')).toBe('15551234567');
    expect(normalizePhone('555-123-4567')).toBe('5551234567');
  });

  test.each([undefined, null, '', 'no-digits-here'])(
    'returns empty string for %p',
    (input) => {
      expect(normalizePhone(input)).toBe('');
    }
  );

  test('coerces non-string input safely', () => {
    expect(normalizePhone(9312797879)).toBe('9312797879');
  });
});

describe('hashEmail / hashPhone', () => {
  test('hashEmail hashes the normalized email', () => {
    expect(hashEmail('  John@Example.com ')).toBe(SHA256_JOHN_AT_EXAMPLE);
    expect(hashEmail('john@example.com')).toBe(SHA256_JOHN_AT_EXAMPLE);
  });

  test('hashPhone hashes the digits-only phone', () => {
    expect(hashPhone('(931) 279-7879')).toBe(SHA256_9312797879);
    expect(hashPhone('931-279-7879')).toBe(SHA256_9312797879);
    expect(hashPhone('9312797879')).toBe(SHA256_9312797879);
  });

  test('never returns the raw value', () => {
    expect(hashEmail('john@example.com')).not.toContain('john');
    expect(hashPhone('9312797879')).not.toContain('9312797879');
  });

  test.each([undefined, null, '', '   '])(
    'hashEmail returns undefined for %p rather than hashing an empty string',
    (input) => {
      expect(hashEmail(input)).toBeUndefined();
    }
  );

  test.each([undefined, null, '', 'abc'])(
    'hashPhone returns undefined for %p rather than hashing an empty string',
    (input) => {
      expect(hashPhone(input)).toBeUndefined();
    }
  );
});

describe('getMetaCapiConfig', () => {
  test('is disabled when the access token is missing', () => {
    const config = getMetaCapiConfig({});
    expect(config.enabled).toBe(false);
    expect(config.accessToken).toBe('');
  });

  test('is disabled when the access token is blank whitespace', () => {
    const config = getMetaCapiConfig({ META_CAPI_ACCESS_TOKEN: '   ' });
    expect(config.enabled).toBe(false);
  });

  test('is enabled when an access token is present', () => {
    const config = getMetaCapiConfig({ META_CAPI_ACCESS_TOKEN: 'tok-123' });
    expect(config.enabled).toBe(true);
    expect(config.accessToken).toBe('tok-123');
  });

  test('falls back to the Christian Security Services pixel id', () => {
    const config = getMetaCapiConfig({ META_CAPI_ACCESS_TOKEN: 'tok-123' });
    expect(config.pixelId).toBe(DEFAULT_META_PIXEL_ID);
    expect(DEFAULT_META_PIXEL_ID).toBe('1415642066441121');
  });

  test('prefers an explicitly configured pixel id', () => {
    const config = getMetaCapiConfig({
      META_CAPI_ACCESS_TOKEN: 'tok-123',
      META_PIXEL_ID: '999888777',
    });
    expect(config.pixelId).toBe('999888777');
  });

  test('trims surrounding whitespace from env values', () => {
    const config = getMetaCapiConfig({
      META_CAPI_ACCESS_TOKEN: '  tok-123  ',
      META_PIXEL_ID: '  999888777  ',
    });
    expect(config.accessToken).toBe('tok-123');
    expect(config.pixelId).toBe('999888777');
  });
});

describe('buildLeadEvent', () => {
  test('builds a Lead event with hashed advanced matching fields', () => {
    const event = buildLeadEvent({
      email: 'John@Example.com',
      phone: '(931) 279-7879',
      eventTime: 1700000000,
    });

    expect(event.event_name).toBe('Lead');
    expect(event.action_source).toBe('website');
    expect(event.event_time).toBe(1700000000);
    expect(event.user_data.em).toEqual([SHA256_JOHN_AT_EXAMPLE]);
    expect(event.user_data.ph).toEqual([SHA256_9312797879]);
  });

  test('never includes raw PII anywhere in the serialized payload', () => {
    const event = buildLeadEvent({
      email: 'John@Example.com',
      phone: '(931) 279-7879',
      name: 'John Doe',
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('John@Example.com');
    expect(serialized).not.toContain('john@example.com');
    expect(serialized).not.toContain('9312797879');
    expect(serialized).not.toContain('279-7879');
  });

  test('omits advanced matching keys when the values are missing', () => {
    const event = buildLeadEvent({});
    expect(event.user_data.em).toBeUndefined();
    expect(event.user_data.ph).toBeUndefined();
  });

  test('defaults event_time to the current time in whole seconds', () => {
    const before = Math.floor(Date.now() / 1000);
    const event = buildLeadEvent({ email: 'a@b.com' });
    const after = Math.floor(Date.now() / 1000);

    expect(Number.isInteger(event.event_time)).toBe(true);
    expect(event.event_time).toBeGreaterThanOrEqual(before);
    expect(event.event_time).toBeLessThanOrEqual(after);
  });

  test('passes through request context used for attribution', () => {
    const event = buildLeadEvent({
      email: 'a@b.com',
      eventSourceUrl: 'https://example.com/request-a-bid',
      clientIpAddress: '203.0.113.7',
      clientUserAgent: 'Mozilla/5.0',
    });

    expect(event.event_source_url).toBe('https://example.com/request-a-bid');
    expect(event.user_data.client_ip_address).toBe('203.0.113.7');
    expect(event.user_data.client_user_agent).toBe('Mozilla/5.0');
  });
});

describe('sendMetaLeadEvent', () => {
  test('no-ops without calling the network when the token is missing', async () => {
    const fetchImpl = jest.fn();

    const result = await sendMetaLeadEvent(
      { email: 'a@b.com', phone: '9312797879' },
      { env: {}, fetchImpl }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, reason: 'disabled' });
  });

  test('posts hashed data to the Meta events endpoint when configured', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await sendMetaLeadEvent(
      { email: 'John@Example.com', phone: '(931) 279-7879' },
      {
        env: { META_CAPI_ACCESS_TOKEN: 'tok-123', META_PIXEL_ID: '1415642066441121' },
        fetchImpl,
      }
    );

    expect(result.sent).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain('1415642066441121');
    expect(url).toContain('/events');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.access_token).toBe('tok-123');
    expect(body.data).toHaveLength(1);
    expect(body.data[0].event_name).toBe('Lead');
    expect(body.data[0].user_data.em).toEqual([SHA256_JOHN_AT_EXAMPLE]);
    expect(body.data[0].user_data.ph).toEqual([SHA256_9312797879]);
  });

  test('never transmits raw email or phone over the wire', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    await sendMetaLeadEvent(
      { email: 'John@Example.com', phone: '(931) 279-7879' },
      { env: { META_CAPI_ACCESS_TOKEN: 'tok-123' }, fetchImpl }
    );

    const body = fetchImpl.mock.calls[0][1].body;
    expect(body).not.toContain('John@Example.com');
    expect(body).not.toContain('john@example.com');
    expect(body).not.toContain('9312797879');
  });

  test('does not leak the access token into the query string', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    await sendMetaLeadEvent(
      { email: 'a@b.com' },
      { env: { META_CAPI_ACCESS_TOKEN: 'tok-123' }, fetchImpl }
    );

    expect(fetchImpl.mock.calls[0][0]).not.toContain('tok-123');
  });

  test('reports an http error without throwing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid parameter',
    });

    const result = await sendMetaLeadEvent(
      { email: 'a@b.com' },
      { env: { META_CAPI_ACCESS_TOKEN: 'tok-123' }, fetchImpl }
    );

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('http-error');
    expect(result.status).toBe(400);
  });

  test('swallows a rejected network call and reports it', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('socket hang up'));

    const result = await sendMetaLeadEvent(
      { email: 'a@b.com' },
      { env: { META_CAPI_ACCESS_TOKEN: 'tok-123' }, fetchImpl }
    );

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('exception');
  });

  test('swallows a synchronously thrown fetch error', async () => {
    const fetchImpl = jest.fn(() => {
      throw new Error('boom');
    });

    await expect(
      sendMetaLeadEvent(
        { email: 'a@b.com' },
        { env: { META_CAPI_ACCESS_TOKEN: 'tok-123' }, fetchImpl }
      )
    ).resolves.toEqual(expect.objectContaining({ sent: false, reason: 'exception' }));
  });

  test('reports missing fetch implementation instead of throwing', async () => {
    const result = await sendMetaLeadEvent(
      { email: 'a@b.com' },
      { env: { META_CAPI_ACCESS_TOKEN: 'tok-123' }, fetchImpl: null }
    );

    expect(result).toEqual({ sent: false, reason: 'no-fetch' });
  });

  test('works when called with no options at all (token absent by default)', async () => {
    const originalToken = process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.META_CAPI_ACCESS_TOKEN;

    const result = await sendMetaLeadEvent({ email: 'a@b.com' });
    expect(result).toEqual({ sent: false, reason: 'disabled' });

    if (originalToken !== undefined) {
      process.env.META_CAPI_ACCESS_TOKEN = originalToken;
    }
  });
});
