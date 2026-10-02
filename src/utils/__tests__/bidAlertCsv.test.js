/**
 * Turns the sent bid-alert list into a CSV file. One row per email that went
 * out, using the same fields shown on the Bid alerts page.
 */

import { sentBidAlertsToCsv } from '../bidAlertCsv';

const sent = [
  {
    id: 'sent-1',
    sentAt: '2026-10-02T19:00:00.000Z',
    recipients: ['office@example.com', 'boss@example.com'],
    subject: 'New bid request: Camera install — Jane Doe',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    address: '10 Main St',
    projectName: 'Camera install',
    projectDescription: 'Four outdoor cameras',
  },
];

describe('sentBidAlertsToCsv', () => {
  test('writes a header and one row for each sent email', () => {
    const csv = sentBidAlertsToCsv(sent);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('Sent at,Name,Email,Phone,Address,Project,Description,Sent to,Subject');
    expect(lines[1]).toContain('2026-10-02T19:00:00.000Z');
    expect(lines[1]).toContain('Jane Doe');
    expect(lines[1]).toContain('jane@example.com');
    expect(lines[1]).toContain('555-0100');
    expect(lines[1]).toContain('10 Main St');
    expect(lines[1]).toContain('Camera install');
    expect(lines[1]).toContain('Four outdoor cameras');
    expect(lines[1]).toContain('office@example.com; boss@example.com');
    expect(lines[1]).toContain('New bid request: Camera install — Jane Doe');
  });

  test('quotes commas, quotes, and line breaks', () => {
    const csv = sentBidAlertsToCsv([
      {
        ...sent[0],
        name: 'Doe, Jane',
        projectDescription: 'She said "urgent"\nCall first',
      },
    ]);
    const body = csv.replace(/^\uFEFF/, '').split('\r\n').slice(1).join('\r\n');

    expect(body).toContain('"Doe, Jane"');
    expect(body).toContain('"She said ""urgent""\nCall first"');
  });

  test('returns a header row when nothing has been sent', () => {
    const csv = sentBidAlertsToCsv([]);
    expect(csv.replace(/^\uFEFF/, '')).toBe(
      'Sent at,Name,Email,Phone,Address,Project,Description,Sent to,Subject'
    );
  });
});
