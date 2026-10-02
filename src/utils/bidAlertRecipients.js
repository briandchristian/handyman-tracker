/**
 * Recipient list for Request a Bid email alerts.
 *
 * Staff can save more than one address and change the list later. Values are
 * trimmed, lowercased, and de-duplicated. Blank entries are ignored. Anything
 * that is not an email is reported as invalid so a bad row is not stored.
 * At most MAX_BID_ALERT_RECIPIENTS addresses are allowed.
 */

export const MAX_BID_ALERT_RECIPIENTS = 25;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/**
 * Normalize a recipient list from an array or from text split on commas,
 * semicolons, and whitespace.
 * @returns {{ recipients: string[], invalid: string[] }}
 */
export function parseRecipientEmails(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input ?? '').split(/[\s,;]+/);

  const recipients = [];
  const invalid = [];
  const seen = new Set();

  for (const item of raw) {
    const original = String(item ?? '').trim();
    if (!original) continue;
    const email = original.toLowerCase();
    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      invalid.push(original);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push(email);
  }

  return { recipients, invalid };
}
