/**
 * Read a checking-account CSV and decide which lines are new.
 * Re-importing the same history skips lines already stored, including
 * two identical charges on the same day. A withdrawal within three days
 * of an expense or supplier payment with the same amount is a suggestion
 * to reconcile. It is not saved as a second cost until someone says so.
 */

import { normalizeCostCenterCode } from './costCenters.js';
import { checkingCategory } from './checkingCategories.js';

const DATE_HEADERS = new Set([
  'date',
  'posted date',
  'posting date',
  'post date',
  'trans date',
  'transaction date',
  'processed date',
]);
const DESC_HEADERS = ['description', 'memo', 'details', 'narrative', 'name', 'transaction', 'payee'];
const AMOUNT_HEADERS = new Set(['amount', 'transaction amount']);
const DEBIT_HEADERS = new Set(['debit', 'withdrawal', 'withdrawals', 'money out']);
const CREDIT_HEADERS = new Set(['credit', 'deposit', 'deposits', 'money in']);
const CHECK_HEADERS = new Set(['check', 'check number', 'check #', 'check no', 'cheque', 'cheque number']);
const MATCH_WINDOW_DAYS = 3;

function normHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseCsvTable(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => String(value).trim()));
}

function parseAmount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-');
  const cleaned = raw.replace(/[$,]/g, '').replace(/[()]/g, '');
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return negative ? -Math.abs(num) : num;
}

export function parseBankDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso && (raw.length === 10 || raw[10] === 'T')) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!us) return '';
  const month = Number(us[1]);
  const day = Number(us[2]);
  let year = Number(us[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function columnIndex(headers, names) {
  const wanted = names instanceof Set ? names : new Set(names);
  return headers.findIndex((header) => wanted.has(header));
}

/** Amount, or one signed column such as Debit/Credit. Separate Debit and Credit columns stay out of this. */
function isCombinedAmountHeader(header) {
  if (AMOUNT_HEADERS.has(header)) return true;
  const letters = String(header || '').replace(/[^a-z]/g, '');
  return letters === 'debitcredit' || letters === 'creditdebit';
}

function hasAmountColumn(headers) {
  return headers.some((header) => (
    isCombinedAmountHeader(header) || DEBIT_HEADERS.has(header) || CREDIT_HEADERS.has(header)
  ));
}

export function parseCheckingCsv(text) {
  const table = parseCsvTable(text);
  let headerIndex = -1;
  let headers = [];
  for (let i = 0; i < Math.min(table.length, 20); i += 1) {
    const candidate = table[i].map(normHeader);
    const hasDate = candidate.some((header) => DATE_HEADERS.has(header));
    const hasAmount = hasAmountColumn(candidate);
    if (hasDate && hasAmount) {
      headerIndex = i;
      headers = candidate;
      break;
    }
  }
  if (headerIndex < 0) {
    return {
      error: 'The CSV needs a date column and an amount column, a Debit/Credit column, or separate debit and credit columns.',
    };
  }

  const dateIndex = columnIndex(headers, DATE_HEADERS);
  const amountIndex = headers.findIndex(isCombinedAmountHeader);
  const debitIndex = columnIndex(headers, DEBIT_HEADERS);
  const creditIndex = columnIndex(headers, CREDIT_HEADERS);
  const checkIndex = columnIndex(headers, CHECK_HEADERS);
  const descriptionIndex = DESC_HEADERS
    .map((name) => headers.indexOf(name))
    .find((index) => index >= 0) ?? -1;

  const rows = [];
  let skipped = 0;
  for (const cells of table.slice(headerIndex + 1)) {
    const postedDate = parseBankDate(cells[dateIndex]);
    let amount = null;
    if (amountIndex >= 0) amount = parseAmount(cells[amountIndex]);
    if (amount == null && (debitIndex >= 0 || creditIndex >= 0)) {
      const debit = debitIndex >= 0 ? parseAmount(cells[debitIndex]) : null;
      const credit = creditIndex >= 0 ? parseAmount(cells[creditIndex]) : null;
      if (debit == null && credit == null) amount = null;
      else amount = Math.round(((credit || 0) - Math.abs(debit || 0)) * 100) / 100;
    }
    if (!postedDate || amount == null || amount === 0) {
      skipped += 1;
      continue;
    }
    rows.push({
      postedDate,
      description: descriptionIndex >= 0 ? String(cells[descriptionIndex] || '').trim() : '',
      amount,
      checkNumber: checkIndex >= 0 ? String(cells[checkIndex] || '').trim() : '',
    });
  }

  if (!rows.length) {
    return {
      error: skipped
        ? 'None of the rows had a readable date and amount.'
        : 'The CSV has no transactions.',
    };
  }
  return { rows, skipped };
}

function postedDay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return parseBankDate(value);
}

function occurrenceBase(row) {
  const desc = String(row.description || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const amount = Math.round((Number(row.amount) || 0) * 100);
  const check = String(row.checkNumber || '').trim();
  return `${postedDay(row.postedDate)}|${amount}|${desc}|${check}`;
}

function hashKey(value) {
  let hash = 5381;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function dayIndex(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function words(value) {
  return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
}

function sharesWord(left, right) {
  const tokens = new Set(words(right));
  return words(left).some((word) => tokens.has(word));
}

function claimKey(kind, id) {
  return `${kind}:${id}`;
}

function suggestMatch(row, { expenses = [], supplierPayments = [], claimed }) {
  if (!(Number(row.amount) < 0)) return null;
  const target = Math.abs(Math.round(Number(row.amount) * 100));
  const day = dayIndex(postedDay(row.postedDate));
  if (day == null) return null;
  const candidates = [];

  const consider = (record, kind, recordDay, label) => {
    const id = String(record?._id || record?.id || '');
    if (!id || claimed.has(claimKey(kind, id))) return;
    const when = postedDay(recordDay);
    const whenIndex = dayIndex(when);
    if (whenIndex == null) return;
    const apart = Math.abs(day - whenIndex);
    if (apart > MATCH_WINDOW_DAYS) return;
    if (Math.round(Number(record.amount) * 100) !== target) return;
    const text = `${record.payee || ''} ${record.description || ''} ${record.note || ''}`;
    candidates.push({
      kind,
      id,
      apart,
      shared: sharesWord(row.description, text) ? 1 : 0,
      label: label(record, when),
    });
  };

  expenses.forEach((expense) => consider(
    expense,
    'expense',
    expense.date,
    (expense, when) => {
      const who = expense.payee || expense.description || 'Expense';
      return `Expense ${who} $${(Number(expense.amount) || 0).toFixed(2)} on ${when}`;
    }
  ));
  supplierPayments.forEach((payment) => consider(
    payment,
    'supplierPayment',
    payment.paidAt || payment.date,
    (payment, when) => {
      const who = payment.note || 'Supplier payment';
      return `Supplier payment ${who} $${(Number(payment.amount) || 0).toFixed(2)} on ${when}`;
    }
  ));

  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.shared - a.shared) || (a.apart - b.apart));
  const best = candidates[0];
  claimed.add(claimKey(best.kind, best.id));
  return { kind: best.kind, id: best.id, label: best.label };
}

export function planCheckingImport({
  rows = [],
  storedLines = [],
  expenses = [],
  supplierPayments = [],
} = {}) {
  const storedCounts = new Map();
  storedLines.forEach((line) => {
    const base = occurrenceBase(line);
    storedCounts.set(base, (storedCounts.get(base) || 0) + 1);
  });
  const seen = new Map();
  const claimed = new Set();
  storedLines.forEach((line) => {
    if (line.match?.id) claimed.add(claimKey(line.match.kind, line.match.id));
    if (line.suggestion?.id) claimed.add(claimKey(line.suggestion.kind, line.suggestion.id));
  });

  return rows.map((row) => {
    const postedDate = postedDay(row.postedDate);
    const normalized = {
      postedDate,
      description: String(row.description || '').trim(),
      amount: Math.round((Number(row.amount) || 0) * 100) / 100,
      checkNumber: String(row.checkNumber || '').trim(),
    };
    const base = occurrenceBase(normalized);
    const occurrence = (seen.get(base) || 0) + 1;
    seen.set(base, occurrence);
    const fingerprint = `${hashKey(base)}#${occurrence}`;
    if (occurrence <= (storedCounts.get(base) || 0)) {
      return { ...normalized, fingerprint, disposition: 'duplicate', suggestion: null };
    }
    const suggestion = suggestMatch(normalized, { expenses, supplierPayments, claimed });
    return {
      ...normalized,
      fingerprint,
      suggestion,
      disposition: suggestion ? 'suggested' : 'new',
    };
  });
}

export function noteOnCheckingLine(line = {}, note = '') {
  return { ...line, note: String(note ?? '').trim() };
}

function noteFrom(line = {}, input = {}) {
  if (Object.prototype.hasOwnProperty.call(input, 'note')) return String(input.note ?? '').trim();
  return String(line.note || '');
}

function resolveInventoryLinks(rawIds, lots = [], soldIds = []) {
  const ids = [];
  const seen = new Set();
  (Array.isArray(rawIds) ? rawIds : []).forEach((raw) => {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  const sold = new Set((soldIds || []).map(String));
  const byId = new Map((lots || []).map((lot) => [String(lot._id || lot.id || ''), lot]));
  for (const id of ids) {
    if (sold.has(id)) return { error: 'That inventory purchase is already sold' };
    const lot = byId.get(id);
    const choice = lot ? checkingCategory(lot.categoryCode) : null;
    const isPurchase = lot && lot.status === 'categorized' && choice?.effect === 'asset' && Number(lot.amount) < 0;
    if (!isPurchase) return { error: 'Pick a purchase filed as inventory' };
  }
  return { ids };
}

/** A purchase already named by a sale has to stay inventory until that sale lets it go. */
export function inventoryReleaseError(line = {}, nextCategoryCode = '', sales = []) {
  if (normalizeCostCenterCode(line.categoryCode) !== 'INVENTORY') return '';
  if (normalizeCostCenterCode(nextCategoryCode) === 'INVENTORY') return '';
  const id = String(line._id || line.id || '');
  if (!id) return '';
  const used = (Array.isArray(sales) ? sales : []).some((sale) => (
    (sale.inventoryLineIds || []).map(String).includes(id)
  ));
  return used ? 'This purchase is already sold' : '';
}

export function categorizeCheckingLine(line = {}, input = {}, catalog = {}) {
  if (input.confirmMatch) {
    const match = line.suggestion?.id ? line.suggestion : (line.match?.id ? line.match : null);
    if (!match) return { error: 'No existing record to reconcile' };
    return {
      value: {
        ...line,
        status: 'matched',
        categoryCode: '',
        customerId: '',
        projectId: '',
        subcontractorWorkOrderId: '',
        inventoryLineIds: [],
        note: noteFrom(line, input),
        match,
        suggestion: null,
      },
    };
  }

  const categoryCode = normalizeCostCenterCode(input.categoryCode);
  const choice = checkingCategory(categoryCode);
  if (!choice) return { error: 'Unknown category' };
  if (choice.effect === 'income' && !(Number(line.amount) > 0)) {
    return { error: 'Other income is for money coming in' };
  }
  if (choice.effect === 'sale' && !(Number(line.amount) > 0)) {
    return { error: 'Sales is for money coming in' };
  }
  if (choice.effect === 'asset' && !(Number(line.amount) < 0)) {
    return { error: 'Inventory is for a purchase' };
  }
  let inventoryLineIds = [];
  if (choice.effect === 'sale') {
    const linked = resolveInventoryLinks(
      input.inventoryLineIds,
      catalog.inventoryLines || [],
      catalog.soldInventoryIds || []
    );
    if (linked.error) return { error: linked.error };
    inventoryLineIds = linked.ids;
  }
  const clearsJob = choice.effect === 'asset' || choice.effect === 'sale';
  const subcontractorWorkOrderId = clearsJob || !input.subcontractorWorkOrderId
    ? ''
    : String(input.subcontractorWorkOrderId);
  return {
    value: {
      ...line,
      status: choice.effect === 'exclude' ? 'excluded' : 'categorized',
      categoryCode,
      customerId: clearsJob || subcontractorWorkOrderId || !input.customerId ? '' : String(input.customerId),
      projectId: clearsJob || subcontractorWorkOrderId || !input.projectId ? '' : String(input.projectId),
      subcontractorWorkOrderId,
      inventoryLineIds,
      note: noteFrom(line, input),
      match: null,
      suggestion: null,
    },
  };
}
