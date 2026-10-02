/**
 * Email sent to staff when someone submits Request a Bid.
 *
 * SMTP credentials stay in the environment (SMTP_HOST, SMTP_PORT, SMTP_SECURE,
 * SMTP_USER, SMTP_PASS, SMTP_FROM). Recipient addresses are passed in; they are
 * stored and edited elsewhere. When SMTP is not configured, or the recipient
 * list is empty, sending is skipped. A mail failure is reported on the result
 * and never thrown, so a bid submission can still succeed.
 */

import {
  bidAlertSentRecord,
  buildBidAlertMessage,
  getSmtpConfig,
  sendBidAlert,
  smtpTransportOptions,
} from '../lib/bidNotify.js';

const configuredEnv = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer@example.com',
  SMTP_PASS: 'secret-pass',
  SMTP_FROM: 'alerts@example.com',
};

const bid = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-0100',
  address: '10 Main St',
  projectName: 'Camera install',
  projectDescription: 'Four outdoor cameras',
};

describe('getSmtpConfig', () => {
  test('is disabled when host or from is missing', () => {
    expect(getSmtpConfig({}).enabled).toBe(false);
    expect(getSmtpConfig({ SMTP_HOST: 'smtp.example.com' }).enabled).toBe(false);
    expect(getSmtpConfig({ SMTP_FROM: 'alerts@example.com' }).enabled).toBe(false);
  });

  test('uses port 587 and the from address when configured', () => {
    const config = getSmtpConfig(configuredEnv);

    expect(config).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      user: 'mailer@example.com',
      pass: 'secret-pass',
      from: 'alerts@example.com',
      secure: false,
      enabled: true,
    });
  });

  test('treats port 465 and SMTP_SECURE as a TLS connection', () => {
    expect(getSmtpConfig({ ...configuredEnv, SMTP_PORT: '465' }).secure).toBe(true);
    expect(getSmtpConfig({ ...configuredEnv, SMTP_SECURE: 'true' }).secure).toBe(true);
  });

  test('falls back to SMTP_USER as the from address', () => {
    const config = getSmtpConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'mailer@example.com',
    });

    expect(config.from).toBe('mailer@example.com');
    expect(config.enabled).toBe(true);
  });

  test('is disabled when the port is not a number', () => {
    expect(getSmtpConfig({ ...configuredEnv, SMTP_PORT: 'abc' }).enabled).toBe(false);
  });
});

describe('smtpTransportOptions', () => {
  test('includes auth only when a username is set', () => {
    const withAuth = smtpTransportOptions(getSmtpConfig(configuredEnv));
    expect(withAuth.auth).toEqual({ user: 'mailer@example.com', pass: 'secret-pass' });

    const openRelay = smtpTransportOptions(
      getSmtpConfig({ SMTP_HOST: 'localhost', SMTP_FROM: 'alerts@example.com' })
    );
    expect(openRelay.auth).toBeUndefined();
    expect(openRelay).toMatchObject({ host: 'localhost', port: 587, secure: false });
  });
});

describe('buildBidAlertMessage', () => {
  test('includes the bid details and keeps the subject on one line', () => {
    const message = buildBidAlertMessage({
      ...bid,
      projectName: 'Camera\r\nBcc: attacker@example.com',
      name: 'Jane\nDoe',
    });

    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.subject).toContain('Camera');
    expect(message.subject).toContain('Jane');
    expect(message.text).toContain('jane@example.com');
    expect(message.text).toContain('555-0100');
    expect(message.text).toContain('10 Main St');
    expect(message.text).toContain('Four outdoor cameras');
  });

  test('notes a missing address', () => {
    const message = buildBidAlertMessage({ ...bid, address: '  ' });
    expect(message.text).toContain('(not provided)');
  });
});

describe('bidAlertSentRecord', () => {
  test('keeps only the fields that were written into the email', () => {
    const message = buildBidAlertMessage(bid);
    const record = bidAlertSentRecord(bid, [' Office@Example.com ', 'boss@example.com']);

    expect(record).toEqual({
      recipients: ['office@example.com', 'boss@example.com'],
      subject: message.subject,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-0100',
      address: '10 Main St',
      projectName: 'Camera install',
      projectDescription: 'Four outdoor cameras',
    });
    expect(record.projects).toBeUndefined();
    expect(record.customerId).toBeUndefined();
  });
});

describe('sendBidAlert', () => {
  test('does not send when there are no recipients', async () => {
    const createTransport = jest.fn();
    const result = await sendBidAlert({
      recipients: ['  '],
      bid,
      env: configuredEnv,
      createTransport,
    });

    expect(result).toEqual({ sent: false, reason: 'no-recipients' });
    expect(createTransport).not.toHaveBeenCalled();
  });

  test('does not send when an address is invalid', async () => {
    const createTransport = jest.fn();
    const result = await sendBidAlert({
      recipients: ['good@example.com', 'nope'],
      bid,
      env: configuredEnv,
      createTransport,
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('invalid-recipients');
    expect(result.invalid).toEqual(['nope']);
    expect(createTransport).not.toHaveBeenCalled();
  });

  test('does not send when SMTP is not configured', async () => {
    const createTransport = jest.fn();
    const result = await sendBidAlert({
      recipients: ['office@example.com'],
      bid,
      env: {},
      createTransport,
    });

    expect(result).toMatchObject({
      sent: false,
      reason: 'smtp-not-configured',
      recipients: ['office@example.com'],
    });
    expect(createTransport).not.toHaveBeenCalled();
  });

  test('sends one message to every recipient', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const createTransport = jest.fn(() => ({ sendMail }));

    const result = await sendBidAlert({
      recipients: [' Office@Example.com ', 'boss@example.com', 'office@example.com'],
      bid,
      env: configuredEnv,
      createTransport,
    });

    expect(result).toMatchObject({
      sent: true,
      recipients: ['office@example.com', 'boss@example.com'],
      record: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        projectName: 'Camera install',
        projectDescription: 'Four outdoor cameras',
        recipients: ['office@example.com', 'boss@example.com'],
      },
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        auth: { user: 'mailer@example.com', pass: 'secret-pass' },
      })
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'alerts@example.com',
        to: ['office@example.com', 'boss@example.com'],
        subject: expect.stringContaining('Camera install'),
        text: expect.stringContaining('jane@example.com'),
      })
    );
  });

  test('reports a transport failure without throwing', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('connection refused'));
    const result = await sendBidAlert({
      recipients: ['office@example.com'],
      bid,
      env: configuredEnv,
      createTransport: () => ({ sendMail }),
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('send-failed');
    expect(result.error).toContain('connection refused');
  });
});
