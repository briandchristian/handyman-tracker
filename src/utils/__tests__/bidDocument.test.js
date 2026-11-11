/**
 * Shared bid document for project worksheets and customer quotes.
 * The printed price is the quote. Line estimates stay off the page and off job profit.
 */
import { jsPDF } from 'jspdf';
import { strToU8, zipSync } from 'fflate';
import {
  bidLineAmount,
  bidLinesTotal,
  buildCustomerBidDocument,
  buildProjectBidDocument,
  openBidDocument,
  renderBidDocument,
} from '../bidDocument';

jest.mock('jspdf', () => ({
  jsPDF: jest.fn(),
}));

function mockPdfDoc(pageHeight = 297) {
  return {
    internal: {
      pageSize: {
        getWidth: jest.fn(() => 210),
        getHeight: jest.fn(() => pageHeight),
      },
    },
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    setFillColor: jest.fn(),
    setDrawColor: jest.fn(),
    setTextColor: jest.fn(),
    text: jest.fn(),
    line: jest.fn(),
    rect: jest.fn(),
    addPage: jest.fn(),
    addImage: jest.fn(),
    splitTextToSize: jest.fn((value) => [String(value)]),
    output: jest.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
  };
}

function textLines(doc) {
  return doc.text.mock.calls.map(([line]) => line).filter((line) => typeof line === 'string');
}

const issuedOn = new Date(2026, 10, 9);

describe('bid document model', () => {
  test('a customer quote keeps its number and quoted price, and lists each line', () => {
    const document = buildCustomerBidDocument({
      customer: { name: 'Jane Doe', address: '10 Main St', phone: '555-0100' },
      bid: {
        name: 'Cameras and access',
        description: 'Four outdoor cameras',
        quoteNumber: 'A-1001-B0004',
        quotedAmount: 9100,
        lines: [{ description: 'Quoted camera', quantity: 4, estimate: 1800 }],
      },
      date: issuedOn,
      includeMonitoringAgreement: true,
    });

    expect(document).toMatchObject({
      customerName: 'Jane Doe',
      projectName: 'Cameras and access',
      address: '10 Main St',
      phone: '555-0100',
      description: 'Four outdoor cameras',
      quoteNumber: 'A-1001-B0004',
      bidAmount: 7200,
      includeMonitoringAgreement: true,
    });
    expect(document.date).toBe(issuedOn);
    expect(document.lines).toEqual([
      { description: 'Quoted camera', quantity: 4, sku: '' },
    ]);
    expect(document.bidAmount).toBe(bidLineAmount({ quantity: 4, estimate: 1800 }));
    expect(document.amountDue).toBeUndefined();
    expect(document.billAmount).toBeUndefined();
  });

  test('a project worksheet prints bid lines and the bid amount, not materials used', () => {
    const document = buildProjectBidDocument({
      customer: { name: 'John Doe', address: '123 Main St', phone: '555-123-4567' },
      project: {
        name: 'Kitchen Remodel',
        description: 'Security work',
        bidAmount: 2500,
        billAmount: 7400,
        bidMaterials: [{ item: 'Quoted camera', sku: 'MX922 | 3W-MX922', quantity: 3, estimate: 200 }],
        materials: [{ item: 'Cable used on site', quantity: 1, cost: 40 }],
      },
      quoteNumber: 1000,
      date: issuedOn,
      proposedSystemText: 'Professional installation of a burglar alarm.',
    });

    expect(document.projectName).toBe('Kitchen Remodel');
    expect(document.bidAmount).toBe(2500);
    expect(document.lines).toEqual([
      { description: 'Quoted camera', quantity: 3, sku: 'MX922 | 3W-MX922' },
    ]);
    expect(textFromLines(document.lines)).not.toContain('Cable used on site');
    expect(document.proposedSystemText).toBe('Professional installation of a burglar alarm.');
  });

  test('blank lines, a bad date, and a missing quote still print a bid', () => {
    expect(bidLineAmount()).toBe(0);
    expect(bidLinesTotal(null)).toBe(0);

    const customerDoc = buildCustomerBidDocument({
      customer: { name: '  Jane  ' },
      bid: {
        name: '  Alarm  ',
        quotedAmount: -5,
        quoteNumber: null,
        lines: [{}, { description: '  Camera  ', quantity: 'nope', estimate: '12' }],
      },
      date: 'not-a-date',
    });
    expect(customerDoc.customerName).toBe('Jane');
    expect(customerDoc.projectName).toBe('Alarm');
    expect(customerDoc.bidAmount).toBe(0);
    expect(customerDoc.quoteNumber).toBe('');
    expect(customerDoc.lines[1]).toEqual({ description: 'Camera', quantity: 0, sku: '' });

    const projectDoc = buildProjectBidDocument();
    expect(projectDoc.bidAmount).toBe(0);
    expect(projectDoc.lines).toEqual([]);
    expect(projectDoc.date).toBeInstanceOf(Date);

    const doc = mockPdfDoc(800);
    doc.splitTextToSize = jest.fn((value) => (
      String(value).length > 40 ? ['line one', 'line two'] : [String(value)]
    ));
    renderBidDocument(doc, {
      ...projectDoc,
      quoteNumber: null,
      proposedSystemText: 'A long proposed system statement that wraps onto a second printed line.',
      lines: [
        { description: '', quantity: 0, sku: '' },
        { description: 'Panel', quantity: 2, sku: '' },
      ],
    });
    const lines = textLines(doc);
    expect(lines).toContain('Material');
    expect(lines).toContain('line two');
    expect(lines.some((line) => line.startsWith('Date:') && line.includes('Quote #:'))).toBe(true);
    renderBidDocument(doc);
  });

  test('line amounts sum quantity times estimate and ignore blank lines', () => {
    expect(bidLineAmount({ quantity: 4, estimate: 1800 })).toBe(7200);
    expect(bidLineAmount({ quantity: '2', estimate: '12.5' })).toBe(25);
    expect(bidLineAmount({})).toBe(0);
    expect(bidLinesTotal([
      { quantity: 4, estimate: 1800 },
      { quantity: 1, estimate: 50 },
    ])).toBe(7250);
    expect(bidLinesTotal()).toBe(0);
  });
});

function textFromLines(lines) {
  return lines.map((line) => line.description).join(' ');
}

describe('renderBidDocument', () => {
  let doc;

  beforeEach(() => {
    doc = mockPdfDoc();
  });

  test('prints the bid structure with the quote number, line, and quoted amount', () => {
    const document = buildCustomerBidDocument({
      customer: { name: 'Jane Doe', address: '10 Main St', phone: '555-0100' },
      bid: {
        name: 'Cameras and access',
        description: 'Four outdoor cameras',
        quoteNumber: 'A-1001-B0004',
        quotedAmount: 9100,
        lines: [{ description: 'Quoted camera', quantity: 4, estimate: 1800, sku: 'MX922 | 3W-MX922' }],
      },
      date: issuedOn,
    });

    renderBidDocument(doc, document, {
      headerLogo: { naturalWidth: 200, naturalHeight: 80 },
    });

    const lines = textLines(doc);
    expect(lines).toEqual(expect.arrayContaining([
      'CHRISTIAN',
      'SECURITY',
      'SERVICES',
    ]));
    expect(lines.some((line) => line.includes('2622') && line.includes('License'))).toBe(true);
    expect(lines).toContain('Date: 11/9/2026 | Quote #: A-1001-B0004 | Valid for 30 days');
    expect(lines).toContain('Bid: Jane Doe');
    expect(lines).toContain('Project: Cameras and access');
    expect(lines).toContain('Address: 10 Main St');
    expect(lines).toContain('Phone: 555-0100');
    expect(lines).toContain('Description: Four outdoor cameras');
    expect(lines).toContain('Quoted camera · 3W-MX922');
    expect(lines).toContain('4');
    expect(lines.some((line) => line.includes('1800'))).toBe(false);
    expect(lines).toContain('Bid Amount: $7200.00');
    expect(lines).toContain("What's Included:");
    expect(lines).toContain("What's Not Included:");
    expect(lines).toContain('Payment Terms:');
    expect(lines).toContain('Clarifications & Project Assumptions:');
    expect(lines).toContain('Next Steps:');
    expect(lines).toContain('Accepted & Agreed:');
    expect(lines.some((line) => line.includes('(931) 279-7879') && line.includes('brian_christian@hotmail.com'))).toBe(true);
    expect(doc.addImage).toHaveBeenCalled();
    const clarificationsIdx = lines.indexOf('Clarifications & Project Assumptions:');
    const nextStepsIdx = lines.indexOf('Next Steps:');
    const acceptedIdx = lines.indexOf('Accepted & Agreed:');
    expect(nextStepsIdx).toBeGreaterThan(clarificationsIdx);
    expect(acceptedIdx).toBeGreaterThan(nextStepsIdx);
  });

  test('prints an empty materials row and leaves missing contact as N/A', () => {
    renderBidDocument(doc, buildCustomerBidDocument({ bid: { name: '', quotedAmount: 0 }, date: issuedOn }));
    const lines = textLines(doc);
    expect(lines).toContain('Bid: N/A');
    expect(lines).toContain('Project: N/A');
    expect(lines).toContain('Address: N/A');
    expect(lines).toContain('Phone: N/A');
    expect(lines).toContain('Description: No description');
    expect(lines).toContain('No materials listed');
    expect(lines).toContain('Bid Amount: $0.00');
  });

  test('prints the proposed system between the divider and the materials table', () => {
    const document = buildProjectBidDocument({
      customer: { name: 'John Doe' },
      project: { name: 'Alarm', description: 'Security work', bidAmount: 2500, bidMaterials: [] },
      quoteNumber: 1000,
      date: issuedOn,
      proposedSystemText: 'Professional installation of a burglar alarm.',
    });
    renderBidDocument(doc, document);
    const lines = textLines(doc);
    const descriptionIdx = lines.findIndex((line) => line.startsWith('Description:'));
    const proposedIdx = lines.indexOf('Proposed System:');
    const materialsIdx = lines.indexOf('Materials');
    expect(proposedIdx).toBeGreaterThan(descriptionIdx);
    expect(materialsIdx).toBeGreaterThan(proposedIdx);
    expect(lines).toContain('Professional installation of a burglar alarm.');
  });

  test('starts another page when the materials table runs past the bottom margin', () => {
    const short = mockPdfDoc(120);
    const document = buildProjectBidDocument({
      customer: { name: 'John Doe' },
      project: {
        name: 'Alarm',
        bidAmount: 100,
        bidMaterials: Array.from({ length: 8 }, (_, index) => ({
          item: `Device ${index + 1}`,
          quantity: 1,
          estimate: 10,
        })),
      },
      quoteNumber: 1000,
      date: issuedOn,
    });
    renderBidDocument(short, document);
    expect(short.addPage).toHaveBeenCalled();
  });

  test('attaches the monitoring agreement with headings, bullets, and numbered lines', () => {
    const document = buildCustomerBidDocument({
      customer: { name: 'Jane Doe' },
      bid: { name: 'Monitoring', quoteNumber: 'A-1001-B0005', quotedAmount: 35, lines: [] },
      date: issuedOn,
      includeMonitoringAgreement: true,
    });
    renderBidDocument(doc, document, {
      agreementLines: [
        'ALARM MONITORING SERVICES AGREEMENT',
        '',
        'SCOPE:',
        '- Keep the panel online',
        '* Keep a spare battery',
        '1. Term is 36 months.',
        'A) Site access is included.',
        'Monitoring starts after the test.',
      ],
    });
    const lines = textLines(doc);
    expect(lines).toContain('Attachment A');
    expect(lines).toContain('Monitoring Agreement Contract');
    expect(lines.some((line) => line.includes('Attached to Bid'))).toBe(true);
    expect(lines).toContain('ALARM MONITORING SERVICES AGREEMENT');
    expect(lines).toContain('SCOPE:');
    expect(lines).toContain('• Keep the panel online');
    expect(lines).toContain('• Keep a spare battery');
    expect(lines).toContain('1. Term is 36 months.');
    expect(lines).toContain('A) Site access is included.');
    expect(lines).toContain('Monitoring starts after the test.');
    expect(doc.addPage).toHaveBeenCalled();
  });

  test('says the agreement could not be parsed when the attachment is empty', () => {
    const document = buildCustomerBidDocument({
      bid: { name: 'Monitoring', quoteNumber: 'A-1001-B0006', quotedAmount: 35 },
      date: issuedOn,
      includeMonitoringAgreement: true,
    });
    renderBidDocument(doc, document, { agreementLines: [] });
    expect(textLines(doc)).toContain('Monitoring agreement source file could not be parsed.');
  });
});

describe('openBidDocument', () => {
  let doc;
  let OriginalImage;

  beforeEach(() => {
    doc = mockPdfDoc(800);
    jsPDF.mockImplementation(() => doc);
    global.URL.createObjectURL = jest.fn(() => 'blob:bid-pdf-url');
    window.open = jest.fn();
    global.fetch = jest.fn();
    OriginalImage = global.Image;
    global.Image = class {
      constructor() {
        this.naturalWidth = 0;
        this.naturalHeight = 0;
      }

      set src(_) {
        if (this.onerror) this.onerror(new Error('mock image load error'));
      }
    };
  });

  afterEach(() => {
    global.Image = OriginalImage;
  });

  test('opens the quote in a new tab and reuses the issued quote number', async () => {
    const document = buildCustomerBidDocument({
      customer: { name: 'Jane Doe' },
      bid: { name: 'Cameras', quoteNumber: 'A-1001-B0004', quotedAmount: 9100, lines: [] },
      date: issuedOn,
    });

    await openBidDocument(document);

    expect(jsPDF).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith('blob:bid-pdf-url', '_blank');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(textLines(doc)).toContain('Date: 11/9/2026 | Quote #: A-1001-B0004 | Valid for 30 days');
  });

  test('loads the monitoring agreement file when the quote asks for it', async () => {
    const agreementXml = `
      <w:document>
        <w:body>
          <w:p><w:r><w:t>Monitoring term is 36 months.</w:t></w:r></w:p>
        </w:body>
      </w:document>
    `;
    const zipped = zipSync({ 'word/document.xml': strToU8(agreementXml, true) });
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength),
    });
    const document = buildCustomerBidDocument({
      bid: { name: 'Monitoring', quoteNumber: 'A-1001-B0007', quotedAmount: 35 },
      date: issuedOn,
      includeMonitoringAgreement: true,
    });

    await openBidDocument(document);

    expect(global.fetch).toHaveBeenCalledWith('/ALARM MONITORING SERVICES AGREEMENT.docx');
    expect(textLines(doc)).toContain('Monitoring term is 36 months.');
  });

  test('ignores a docx that has no document body', async () => {
    const emptyText = `
      <w:document>
        <w:body>
          <w:p><w:r><w:t></w:t><w:t>Monitoring stays on.</w:t></w:r></w:p>
          <w:p><w:r><w:t>   </w:t></w:r></w:p>
        </w:body>
      </w:document>
    `;
    const zipped = zipSync({ 'word/other.xml': strToU8('<note/>', true) });
    const withText = zipSync({ 'word/document.xml': strToU8(emptyText, true) });
    const document = buildCustomerBidDocument({
      bid: { name: 'Monitoring', quoteNumber: 'A-1001-B0009', quotedAmount: 35 },
      date: issuedOn,
      includeMonitoringAgreement: true,
    });
    const asBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => asBuffer(zipped),
    });
    await openBidDocument(document);
    expect(textLines(doc)).toContain('Monitoring agreement source file could not be parsed.');

    doc.text.mockClear();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => asBuffer(withText),
    });
    await openBidDocument(document);
    expect(textLines(doc)).toContain('Monitoring stays on.');
  });

  test('keeps the bid when the agreement file is missing or unreadable', async () => {
    const document = buildCustomerBidDocument({
      bid: { name: 'Monitoring', quoteNumber: 'A-1001-B0008', quotedAmount: 35 },
      date: issuedOn,
      includeMonitoringAgreement: true,
    });
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
    await openBidDocument(document);
    expect(textLines(doc)).toContain('Monitoring agreement source file could not be parsed.');

    doc.text.mockClear();
    global.fetch.mockRejectedValueOnce(new Error('network'));
    await openBidDocument(document);
    expect(textLines(doc)).toContain('Bid Amount: $35.00');

    doc.text.mockClear();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    await openBidDocument(document);
    expect(textLines(doc)).toContain('Monitoring agreement source file could not be parsed.');
  });
});
