/**
 * Bid PDF shared by the project worksheet and a customer quote.
 * The printed price is the quoted amount. Line estimates are worksheet math
 * and stay off the page. A quote does not become job revenue.
 */
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { strFromU8, unzipSync } from 'fflate';
import { adiItemNumberFromSku } from './adiIntegration.js';
import { jobQuotedAmount } from '../../server/lib/accountingSummary.js';

/**
 * Company header block for generated bid PDFs (aligned with CHRISTIAN SECURITY SERVICES BID template).
 * Logo uses /logo.png with preserved aspect ratio; text fills the rest of the header row.
 */
const BID_PDF_COMPANY = {
  nameLine1: 'CHRISTIAN',
  nameLine2: 'SECURITY',
  nameLine3: 'SERVICES',
  subtitle: 'ALARM SYSTEM CONTRACTOR',
  license: 'Tennessee Alarm Systems Contractor License #: 2622',
  phone: '(931) 279-7879',
};

export const MONITORING_AGREEMENT_DOCX_URL = '/ALARM MONITORING SERVICES AGREEMENT.docx';

const INCLUDED = [
  '- All equipment and materials',
  '- Professional installation (typically 1 day)',
  '- Testing and walkthrough',
  '- Full programming, testing, and on-site training',
  '- 1-year equipment warranty + lifetime installation labor warranty',
];

const EXCLUDED = [
  '- Monitoring (separate contract, ~$35 /month)',
  '- Any electrical upgrades or drywall repairs',
  '- Local permits (if required beyond low-voltage)',
];

const PAYMENT_TERMS = [
  '- 50% deposit to schedule and order equipment',
  '- Balance due on completion (after testing and your approval)',
];

const CLARIFICATIONS = [
  'Limitation of Liability: Contractor’s total liability for any claims arising from this project is capped at the total contract value.',
  'Waiver of Damages: Contractor is not liable for any indirect, incidental, or consequential damages, including loss of profits or business interruption.',
  'Pricing & Validity: This bid is an estimate based on provided specifications and remains valid for 30 days. Final pricing is subject to a mutually signed agreement and may be adjusted for unforeseen site conditions or scope changes.',
];

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function nonNegative(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

export function bidLineAmount(line = {}) {
  return money(nonNegative(line.quantity) * nonNegative(line.estimate));
}

export function bidLinesTotal(lines = []) {
  return money((Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + bidLineAmount(line), 0));
}

/** Priced lines set the quote. A bid with none keeps the amount already stored. */
export function quotedAmountForBid(bid = {}) {
  const total = bidLinesTotal(bid?.lines);
  if (total > 0) return total;
  return money(nonNegative(bid?.quotedAmount));
}

function printLines(lines = []) {
  return (Array.isArray(lines) ? lines : []).map((line) => ({
    description: String(line?.description ?? line?.item ?? '').trim(),
    quantity: nonNegative(line?.quantity),
    sku: String(line?.sku || '').trim(),
  }));
}

function issuedDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Customer quote. The quote number already on the bid is the number that prints.
 * The bid amount is the sum of each line, quantity times its estimate.
 * A bid with no priced lines keeps its stored quoted amount.
 */
export function buildCustomerBidDocument({
  customer = {},
  bid = {},
  date,
  includeMonitoringAgreement = false,
} = {}) {
  return {
    customerName: String(customer?.name || '').trim(),
    projectName: String(bid?.name || '').trim(),
    address: String(customer?.address || '').trim(),
    phone: String(customer?.phone || '').trim(),
    description: String(bid?.description || '').trim(),
    quoteNumber: bid?.quoteNumber ?? '',
    date: date ? issuedDate(date) : new Date(),
    proposedSystemText: '',
    lines: printLines(bid?.lines),
    bidAmount: quotedAmountForBid(bid),
    includeMonitoringAgreement: Boolean(includeMonitoringAgreement),
  };
}

/**
 * Project worksheet. Lines come from the bid worksheet. The bid amount is the
 * project quote, which is separate from materials used on the job.
 */
export function buildProjectBidDocument({
  customer = {},
  project = {},
  quoteNumber = '',
  date,
  proposedSystemText = '',
  includeMonitoringAgreement = false,
} = {}) {
  return {
    customerName: String(customer?.name || '').trim(),
    projectName: String(project?.name || '').trim(),
    address: String(customer?.address || '').trim(),
    phone: String(customer?.phone || '').trim(),
    description: String(project?.description || '').trim(),
    quoteNumber,
    date: date ? issuedDate(date) : new Date(),
    proposedSystemText: String(proposedSystemText || '').trim(),
    lines: printLines(project?.bidMaterials),
    bidAmount: jobQuotedAmount(project),
    includeMonitoringAgreement: Boolean(includeMonitoringAgreement),
  };
}

function extractDocxPlainText(arrayBuffer) {
  try {
    const files = unzipSync(new Uint8Array(arrayBuffer));
    const xmlBytes = files['word/document.xml'];
    if (!xmlBytes) return [];
    const xml = strFromU8(xmlBytes);
    const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
    return paragraphs
      .map((paragraph) => {
        const texts = [...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1] || '');
        return texts.join('').replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Failed to parse monitoring agreement DOCX:', err);
    return [];
  }
}

function classifyContractLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return { type: 'blank', text: '' };
  if (/^[-*•]\s+/.test(trimmed)) return { type: 'bullet', text: trimmed.replace(/^[-*•]\s+/, '') };
  if (/^(\d+[\.\)]|[A-Za-z][\.\)])\s+/.test(trimmed)) return { type: 'numbered', text: trimmed };
  if (
    /:$/.test(trimmed) ||
    (trimmed.length <= 90 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed))
  ) {
    return { type: 'heading', text: trimmed };
  }
  return { type: 'paragraph', text: trimmed };
}

export function layoutBidPdfHeader(doc, headerLogo, left, right, headerY) {
  const maxLogoW = 42;
  const maxLogoH = 32;
  let drawW = 0;
  let drawH = 0;

  if (headerLogo?.naturalWidth && headerLogo?.naturalHeight) {
    const scale = Math.min(maxLogoW / headerLogo.naturalWidth, maxLogoH / headerLogo.naturalHeight);
    drawW = headerLogo.naturalWidth * scale;
    drawH = headerLogo.naturalHeight * scale;
    doc.addImage(headerLogo, 'PNG', left, headerY, drawW, drawH);
  }

  const textX = left + drawW + 5;
  const textMaxW = right - textX;
  let ty = headerY + 5;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(BID_PDF_COMPANY.nameLine1, textX, ty);
  ty += 6;
  doc.text(BID_PDF_COMPANY.nameLine2, textX, ty);
  ty += 6;
  doc.text(BID_PDF_COMPANY.nameLine3, textX, ty);
  ty += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const subLines = doc.splitTextToSize(BID_PDF_COMPANY.subtitle, textMaxW);
  subLines.forEach((line) => {
    doc.text(line, textX, ty);
    ty += 4.5;
  });
  const licLines = doc.splitTextToSize(BID_PDF_COMPANY.license, textMaxW);
  licLines.forEach((line) => {
    doc.text(line, textX, ty);
    ty += 4.5;
  });
  doc.text(BID_PDF_COMPANY.phone, textX, ty);
  ty += 6;

  return Math.max(ty, headerY + drawH) + 8;
}

export function loadBidHeaderImage() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });
}

async function loadMonitoringAgreementLines() {
  try {
    const response = await fetch(MONITORING_AGREEMENT_DOCX_URL);
    if (!response.ok) {
      console.error('Monitoring agreement download failed:', response.status);
      return [];
    }
    return extractDocxPlainText(await response.arrayBuffer());
  } catch (err) {
    console.error('Monitoring agreement fetch failed:', err);
    return [];
  }
}

function writeLines(doc, lines, left, cursor, ensurePageSpace) {
  doc.setFont('helvetica', 'normal');
  lines.forEach((line) => {
    ensurePageSpace(6);
    doc.text(line, left + 2, cursor.y);
    cursor.y += 5;
  });
}

/**
 * Draw the bid: header, quote line, customer, materials, price, terms, and signature.
 * Monitoring agreement text is optional and starts on its own page.
 */
export function renderBidDocument(doc, document = {}, { headerLogo = null, agreementLines = [] } = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = pageWidth - 14;
  const bottomMargin = 14;
  const defaultTopY = 20;
  const cursor = { y: layoutBidPdfHeader(doc, headerLogo, left, right, 10) };

  const ensurePageSpace = (neededHeight = 8) => {
    if (cursor.y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      cursor.y = defaultTopY;
    }
  };

  const issued = issuedDate(document.date);
  const quoteMetaLine = `Date: ${format(issued, 'M/d/yyyy')} | Quote #: ${document.quoteNumber ?? ''} | Valid for 30 days`;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  ensurePageSpace(8);
  doc.text(quoteMetaLine, left, cursor.y);
  cursor.y += 8;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  ensurePageSpace(9);
  doc.text(`Bid: ${document.customerName || 'N/A'}`, left, cursor.y);
  cursor.y += 9;

  doc.setFontSize(11);
  ensurePageSpace(28);
  doc.text(`Project: ${document.projectName || 'N/A'}`, left, cursor.y);
  cursor.y += 7;
  doc.text(`Address: ${document.address || 'N/A'}`, left, cursor.y);
  cursor.y += 7;
  doc.text(`Phone: ${document.phone || 'N/A'}`, left, cursor.y);
  cursor.y += 7;
  doc.text(`Description: ${document.description || 'No description'}`, left, cursor.y);
  cursor.y += 7;
  doc.setDrawColor(38, 131, 198);
  doc.line(left, cursor.y, right, cursor.y);
  cursor.y += 8;

  if (document.proposedSystemText) {
    ensurePageSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Proposed System:', left, cursor.y);
    cursor.y += 6;
    doc.setFont('helvetica', 'normal');
    doc.splitTextToSize(document.proposedSystemText, right - left).forEach((line) => {
      ensurePageSpace(6);
      doc.text(line, left, cursor.y);
      cursor.y += 5;
    });
    cursor.y += 6;
  }

  ensurePageSpace(12);
  doc.setFontSize(13);
  doc.text('Materials', left, cursor.y);
  cursor.y += 8;
  doc.setFontSize(10.5);

  const materials = Array.isArray(document.lines) ? document.lines : [];
  const tableWidth = right - left;
  const itemColW = 20;
  const qtyColW = 22;
  const descColW = tableWidth - itemColW - qtyColW;
  const itemX = left + 2;
  const descX = left + itemColW + 2;
  const qtyX = right - 4;
  const rowPadY = 3;
  const lineH = 5;
  const headerH = 8;
  const headerBlue = [38, 131, 198];
  const stripeBlue = [230, 240, 249];

  const drawMaterialsHeader = () => {
    ensurePageSpace(headerH + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(...headerBlue);
    doc.rect(left, cursor.y, tableWidth, headerH, 'F');
    doc.setDrawColor(38, 131, 198);
    doc.rect(left, cursor.y, tableWidth, headerH);
    doc.line(left + itemColW, cursor.y, left + itemColW, cursor.y + headerH);
    doc.line(right - qtyColW, cursor.y, right - qtyColW, cursor.y + headerH);
    doc.setTextColor(255, 255, 255);
    doc.text('Item', itemX, cursor.y + 5.3);
    doc.text('Description', descX, cursor.y + 5.3);
    doc.text('Quantity', qtyX, cursor.y + 5.3, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    cursor.y += headerH;
  };
  drawMaterialsHeader();

  if (materials.length === 0) {
    const rowH = rowPadY * 2 + lineH;
    doc.rect(left, cursor.y, tableWidth, rowH);
    doc.line(left + itemColW, cursor.y, left + itemColW, cursor.y + rowH);
    doc.line(right - qtyColW, cursor.y, right - qtyColW, cursor.y + rowH);
    doc.text('-', itemX, cursor.y + rowPadY + 3.8);
    doc.text('No materials listed', descX, cursor.y + rowPadY + 3.8);
    doc.text('0', qtyX, cursor.y + rowPadY + 3.8, { align: 'right' });
    cursor.y += rowH;
  } else {
    materials.forEach((line, index) => {
      const partNumber = adiItemNumberFromSku(line.sku);
      const label = line.description || 'Material';
      const descText = partNumber ? `${label} · ${partNumber}` : label;
      const descLines = doc.splitTextToSize(descText, descColW - 4);
      const rowH = Math.max(rowPadY * 2 + (descLines.length * lineH), rowPadY * 2 + lineH);
      if (cursor.y + rowH > pageHeight - bottomMargin) {
        doc.addPage();
        cursor.y = defaultTopY;
        drawMaterialsHeader();
      }
      if (index % 2 === 0) {
        doc.setFillColor(...stripeBlue);
        doc.rect(left, cursor.y, tableWidth, rowH, 'F');
      }
      doc.rect(left, cursor.y, tableWidth, rowH);
      doc.line(left + itemColW, cursor.y, left + itemColW, cursor.y + rowH);
      doc.line(right - qtyColW, cursor.y, right - qtyColW, cursor.y + rowH);
      doc.text(String(index + 1), itemX, cursor.y + rowPadY + 3.8);
      descLines.forEach((descLine, lineIndex) => {
        doc.text(descLine, descX, cursor.y + rowPadY + 3.8 + (lineIndex * lineH));
      });
      doc.text(String(line.quantity || 0), qtyX, cursor.y + rowPadY + 3.8, { align: 'right' });
      cursor.y += rowH;
    });
  }

  cursor.y += 8;
  doc.setFontSize(12);
  ensurePageSpace(8);
  doc.setTextColor(38, 131, 198);
  doc.text(`Bid Amount: $${(Number(document.bidAmount) || 0).toFixed(2)}`, left, cursor.y);
  doc.setTextColor(0, 0, 0);
  cursor.y += 6;
  ensurePageSpace(10);
  doc.setDrawColor(38, 131, 198);
  doc.line(left, cursor.y, right, cursor.y);
  cursor.y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  ensurePageSpace(8);
  doc.text("What's Included:", left, cursor.y);
  cursor.y += 6;
  writeLines(doc, INCLUDED, left, cursor, ensurePageSpace);
  cursor.y += 3;

  doc.setFont('helvetica', 'bold');
  ensurePageSpace(8);
  doc.text("What's Not Included:", left, cursor.y);
  cursor.y += 6;
  writeLines(doc, EXCLUDED, left, cursor, ensurePageSpace);
  cursor.y += 3;

  doc.setFont('helvetica', 'bold');
  ensurePageSpace(8);
  doc.text('Payment Terms:', left, cursor.y);
  cursor.y += 6;
  writeLines(doc, PAYMENT_TERMS, left, cursor, ensurePageSpace);
  cursor.y += 3;

  doc.setFont('helvetica', 'bold');
  ensurePageSpace(8);
  doc.text('Clarifications & Project Assumptions:', left, cursor.y);
  cursor.y += 6;
  doc.setFont('helvetica', 'normal');
  CLARIFICATIONS.forEach((line) => {
    doc.splitTextToSize(line, right - left).forEach((wrapped) => {
      ensurePageSpace(6);
      doc.text(wrapped, left, cursor.y);
      cursor.y += 5;
    });
    cursor.y += 2;
  });
  cursor.y += 4;

  doc.setFont('helvetica', 'bold');
  ensurePageSpace(8);
  doc.text('Next Steps:', left, cursor.y);
  cursor.y += 6;
  doc.setFont('helvetica', 'normal');
  ensurePageSpace(8);
  const nextStepsLine = "Accept by signing below or contacting us. We'll schedule a final walkthrough if needed. We look forward to protecting you!";
  doc.splitTextToSize(nextStepsLine, right - left).forEach((line) => {
    ensurePageSpace(6);
    doc.text(line, left, cursor.y);
    cursor.y += 5;
  });
  cursor.y += 6;

  doc.setFont('helvetica', 'bold');
  ensurePageSpace(8);
  doc.text('Accepted & Agreed:', left, cursor.y);
  cursor.y += 7;
  doc.setFont('helvetica', 'normal');
  ensurePageSpace(8);
  doc.text('Customer Signature: ____________________________ Date: _______________', left, cursor.y);
  cursor.y += 7;
  ensurePageSpace(8);
  doc.text('Contractor:', left, cursor.y);
  cursor.y += 6;
  ensurePageSpace(8);
  doc.text('Name/Title ____________________________ Date: _______________', left, cursor.y);
  cursor.y += 7;
  ensurePageSpace(8);
  doc.text(`Phone: ${BID_PDF_COMPANY.phone} | Email: brian_christian@hotmail.com`, left, cursor.y);

  if (!document.includeMonitoringAgreement) return;

  doc.addPage();
  cursor.y = 20;
  doc.setFillColor(235, 241, 252);
  doc.setDrawColor(22, 58, 120);
  doc.rect(left, cursor.y - 6, right - left, 22, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Attachment A', left + (right - left) / 2, cursor.y + 1, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Monitoring Agreement Contract', left + (right - left) / 2, cursor.y + 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Attached to Bid - Optional Addendum', left + (right - left) / 2, cursor.y + 14, { align: 'center' });
  cursor.y += 24;
  doc.setDrawColor(22, 58, 120);
  doc.line(left, cursor.y, right, cursor.y);
  cursor.y += 8;

  doc.setFont('helvetica', 'bold');
  ensurePageSpace(8);
  doc.text('Monitoring Agreement Contract', left, cursor.y);
  cursor.y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const linesToRender = agreementLines.length > 0
    ? agreementLines
    : ['Monitoring agreement source file could not be parsed.'];

  linesToRender.forEach((line) => {
    const classified = classifyContractLine(line);
    if (classified.type === 'blank') {
      cursor.y += 2;
      return;
    }
    if (classified.type === 'heading') {
      ensurePageSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(classified.text, left, cursor.y);
      cursor.y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      return;
    }
    const text = classified.type === 'bullet' ? `• ${classified.text}` : classified.text;
    const x = classified.type === 'bullet' || classified.type === 'numbered' ? left + 2 : left;
    const width = classified.type === 'bullet' || classified.type === 'numbered' ? right - left - 2 : right - left;
    doc.splitTextToSize(text, width).forEach((wrapped) => {
      ensurePageSpace(6);
      doc.text(wrapped, x, cursor.y);
      cursor.y += 5;
    });
    cursor.y += 1;
  });
}

/** Open the bid PDF in a new tab. A later generate reuses the quote number already on the document. */
export async function openBidDocument(document) {
  const doc = new jsPDF();
  const headerLogo = await loadBidHeaderImage();
  const agreementLines = document?.includeMonitoringAgreement
    ? await loadMonitoringAgreementLines()
    : [];
  renderBidDocument(doc, document, { headerLogo, agreementLines });
  const pdfUrl = URL.createObjectURL(doc.output('blob'));
  window.open(pdfUrl, '_blank');
  return doc;
}
