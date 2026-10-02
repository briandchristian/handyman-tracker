/**
 * CSV of sent bid alerts. One row per email that went out, with the same
 * fields shown on the Bid alerts page. A leading BOM lets Excel open the file
 * as UTF-8.
 */

const HEADER = 'Sent at,Name,Email,Phone,Address,Project,Description,Sent to,Subject';

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function sentAtIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

export function sentBidAlertsToCsv(sent = []) {
  const rows = (Array.isArray(sent) ? sent : []).map((item) => [
    sentAtIso(item?.sentAt),
    item?.name,
    item?.email,
    item?.phone,
    item?.address,
    item?.projectName,
    item?.projectDescription,
    (item?.recipients || []).join('; '),
    item?.subject,
  ].map(csvCell).join(','));

  return `\uFEFF${[HEADER, ...rows].join('\r\n')}`;
}

export function downloadSentBidAlertsCsv(sent) {
  const blob = new Blob([sentBidAlertsToCsv(sent)], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bid-alert-emails.csv';
  link.click();
  window.URL.revokeObjectURL(url);
}
