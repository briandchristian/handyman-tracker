/**
 * Email staff when someone submits Request a Bid.
 *
 * Who receives the message is stored in the database and edited in the app
 * (several addresses, changeable at any time). How the message is sent stays
 * in the environment, because it includes a password:
 *   SMTP_HOST   — required, together with a from address, to turn sending on
 *   SMTP_PORT   — optional, default 587. Port 465 uses TLS.
 *   SMTP_SECURE — optional "true" to force TLS on other ports
 *   SMTP_USER   — optional SMTP username
 *   SMTP_PASS   — optional SMTP password
 *   SMTP_FROM   — the From address. Falls back to SMTP_USER.
 *
 * When SMTP is not configured, or nobody is on the recipient list, sending is
 * skipped. This module never throws: a mail outage must not fail a bid that
 * has already been saved.
 */

import nodemailer from 'nodemailer';
import {
  parseRecipientEmails,
} from '../../src/utils/bidAlertRecipients.js';

export { MAX_BID_ALERT_RECIPIENTS, parseRecipientEmails } from '../../src/utils/bidAlertRecipients.js';

function trimmed(value) {
  return String(value ?? '').trim();
}

/** Resolve SMTP settings. `enabled` is false until a host and from address exist. */
export function getSmtpConfig(env = process.env) {
  const host = trimmed(env.SMTP_HOST);
  const user = trimmed(env.SMTP_USER);
  const pass = String(env.SMTP_PASS ?? '');
  const from = trimmed(env.SMTP_FROM) || user;
  const portRaw = trimmed(env.SMTP_PORT);
  let port = 587;
  let portValid = true;
  if (portRaw) {
    if (!/^\d+$/.test(portRaw)) {
      portValid = false;
    } else {
      port = Number(portRaw);
      portValid = port > 0 && port <= 65535;
    }
  }
  const secureFlag = trimmed(env.SMTP_SECURE).toLowerCase();
  const secure = secureFlag === 'true' || secureFlag === '1' || port === 465;

  return {
    host,
    port: portValid ? port : 587,
    user,
    pass,
    from,
    secure,
    enabled: Boolean(host && from && portValid),
  };
}

/** Nodemailer options for a resolved SMTP config. Auth is omitted for an open relay. */
export function smtpTransportOptions(smtp) {
  const options = {
    host: smtp.host,
    port: smtp.port,
    secure: Boolean(smtp.secure),
  };
  if (smtp.user) {
    options.auth = { user: smtp.user, pass: smtp.pass };
  }
  return options;
}

export function createSmtpTransport(options) {
  return nodemailer.createTransport(options);
}

function oneLine(value, fallback) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, 120);
}

/** Plain-text alert. The subject is a single line so a bid cannot inject headers. */
export function buildBidAlertMessage(bid = {}) {
  const name = oneLine(bid.name, 'Unknown');
  const projectName = oneLine(bid.projectName, 'Untitled project');
  const address = trimmed(bid.address) || '(not provided)';
  const text = [
    'A new bid request was submitted on the website.',
    '',
    `Name: ${trimmed(bid.name) || 'Unknown'}`,
    `Email: ${trimmed(bid.email)}`,
    `Phone: ${trimmed(bid.phone)}`,
    `Address: ${address}`,
    `Project: ${trimmed(bid.projectName) || 'Untitled project'}`,
    '',
    'Description:',
    trimmed(bid.projectDescription),
  ].join('\n');

  return {
    subject: `New bid request: ${projectName} — ${name}`,
    text,
  };
}

/**
 * The email that went out, and nothing else. This is not a customer record:
 * no account, projects list, or internal flags.
 */
export function bidAlertSentRecord(bid = {}, recipients = []) {
  const message = buildBidAlertMessage(bid);
  const parsed = parseRecipientEmails(recipients);
  return {
    recipients: parsed.recipients,
    subject: message.subject,
    name: trimmed(bid.name) || 'Unknown',
    email: trimmed(bid.email),
    phone: trimmed(bid.phone),
    address: trimmed(bid.address) || '(not provided)',
    projectName: trimmed(bid.projectName) || 'Untitled project',
    projectDescription: trimmed(bid.projectDescription),
  };
}

/**
 * Send one message to every recipient. Returns a result object and never throws.
 * Pass `createTransport` in tests to avoid opening a real SMTP connection.
 */
export async function sendBidAlert({
  recipients,
  bid,
  env = process.env,
  transport,
  createTransport = createSmtpTransport,
} = {}) {
  try {
    const parsed = parseRecipientEmails(recipients);
    if (parsed.invalid.length > 0) {
      return { sent: false, reason: 'invalid-recipients', invalid: parsed.invalid };
    }
    if (parsed.recipients.length === 0) {
      return { sent: false, reason: 'no-recipients' };
    }

    const smtp = getSmtpConfig(env);
    if (!smtp.enabled) {
      return {
        sent: false,
        reason: 'smtp-not-configured',
        recipients: parsed.recipients,
      };
    }

    const message = buildBidAlertMessage(bid || {});
    const mailer = transport || createTransport(smtpTransportOptions(smtp));
    await mailer.sendMail({
      from: smtp.from,
      to: parsed.recipients,
      subject: message.subject,
      text: message.text,
    });
    return {
      sent: true,
      recipients: parsed.recipients,
      record: bidAlertSentRecord(bid, parsed.recipients),
    };
  } catch (err) {
    return {
      sent: false,
      reason: 'send-failed',
      error: err?.message || String(err),
    };
  }
}
