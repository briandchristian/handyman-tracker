/**
 * Recipient list for Request a Bid email alerts.
 *
 * Staff save one or more addresses and can change that list later. Parsing
 * trims, lowercases, and de-duplicates. Blank rows are ignored. A value that
 * is not an email is reported so it is not stored. The list has a hard cap.
 */

import {
  MAX_BID_ALERT_RECIPIENTS,
  parseRecipientEmails,
} from '../bidAlertRecipients.js';

describe('parseRecipientEmails', () => {
  test('accepts an array, trims, lowercases, and drops blanks and duplicates', () => {
    const parsed = parseRecipientEmails([
      ' Office@Example.com ',
      '',
      '   ',
      'office@example.com',
      'boss@example.com',
    ]);

    expect(parsed.invalid).toEqual([]);
    expect(parsed.recipients).toEqual(['office@example.com', 'boss@example.com']);
  });

  test('accepts a comma, semicolon, or newline separated string', () => {
    const parsed = parseRecipientEmails('a@example.com, b@example.com;\nc@example.com');

    expect(parsed.invalid).toEqual([]);
    expect(parsed.recipients).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
    ]);
  });

  test('reports invalid addresses and still lists the valid ones', () => {
    const parsed = parseRecipientEmails(['good@example.com', 'not-an-email', 'also bad']);

    expect(parsed.recipients).toEqual(['good@example.com']);
    expect(parsed.invalid).toEqual(['not-an-email', 'also bad']);
  });

  test('treats a missing value as an empty list', () => {
    expect(parseRecipientEmails(undefined)).toEqual({ recipients: [], invalid: [] });
    expect(parseRecipientEmails(null)).toEqual({ recipients: [], invalid: [] });
  });

  test('rejects an address longer than 254 characters', () => {
    const local = 'a'.repeat(250);
    const parsed = parseRecipientEmails([`${local}@example.com`]);

    expect(parsed.recipients).toEqual([]);
    expect(parsed.invalid).toHaveLength(1);
  });

  test('exposes the maximum number of recipients', () => {
    expect(MAX_BID_ALERT_RECIPIENTS).toBeGreaterThan(1);
  });
});
