import { certificatePrintMmToPt } from './certificateManagementRules.js';
import type {
  CertificatePrintTemplateDefinition,
  PdfTemplateDefinition,
  StandardPdfTemplateDefinition,
  Table5PdfTemplateDefinition,
} from './pdfTemplates.js';

export interface CertificatePrintCalibration {
  offsetX: number;
  offsetY: number;
  fontScale: number;
}

export function pdfDocumentOptionsFromTemplate(definition: PdfTemplateDefinition): PDFKit.PDFDocumentOptions {
  return {
    size: definition.page.size,
    layout: definition.page.layout,
    margin: definition.page.margin,
  };
}

const PDF_HORIZONTAL_PUNCTUATION_REPLACEMENTS: Record<string, string> = {
  '（': '(',
  '）': ')',
  '，': ',',
  '、': ',',
  '。': '.',
  '：': ':',
  '；': ';',
  '？': '?',
  '！': '!',
  '《': '<',
  '》': '>',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '～': '~',
  '－': '-',
  '—': '-',
  '　': ' ',
};

export function normalizePdfText(text: string): string {
  return text.replace(/[（），、。：；？！《》“”‘’～－—\u3000]/g, (match) => PDF_HORIZONTAL_PUNCTUATION_REPLACEMENTS[match] || match);
}

export function renderStandardPdfTemplate(
  doc: PDFKit.PDFDocument,
  template: StandardPdfTemplateDefinition,
  context: Record<string, unknown>,
): void {
  if (template.layout === 'supply-request-form') {
    renderSupplyRequestFormTemplate(doc, template, context);
    return;
  }

  renderPdfTitle(doc, template.title, template.typography.titleSize);
  if (template.description) {
    doc.fontSize(Math.max(9, template.typography.rowSize - 1)).fillColor('#475569').text(normalizePdfText(template.description), { align: 'center' });
    doc.fillColor('#111827').moveDown();
  }

  template.rows.forEach((row) => {
    const value = resolveTemplateValue(row.source, context);
    doc.fontSize(template.typography.rowSize).text(normalizePdfText(`${row.label}：${value}`));
    doc.moveDown(0.45);
  });

  if (template.table) {
    doc.moveDown();
    const rows = resolveTemplateArray(template.table.rowsSource, context);
    renderPdfTable(
      doc,
      template.table.columns.map((column) => column.label),
      rows.map((row) => template.table!.columns.map((column) => resolveTemplateValue(column.source, row))),
      {
        widths: template.table.columns.map((column, index) => column.width ?? (index === template.table!.columns.length - 1 ? 90 : 95)),
        headerSize: template.typography.tableHeaderSize,
        bodySize: template.typography.tableBodySize,
      },
    );
  }

  if (template.signatures.length > 0) {
    doc.moveDown(2);
    template.signatures.forEach((line) => {
      doc.fontSize(template.typography.rowSize).text(normalizePdfText(line));
      doc.moveDown(0.8);
    });
  }

  if (template.footerNote) {
    doc.moveDown();
    doc.fontSize(Math.max(8, template.typography.rowSize - 2)).fillColor('#475569').text(normalizePdfText(template.footerNote));
    doc.fillColor('#111827');
  }
}

function renderSupplyRequestFormTemplate(
  doc: PDFKit.PDFDocument,
  template: StandardPdfTemplateDefinition,
  context: Record<string, unknown>,
): void {
  const left = template.page.margin;
  const tableWidth = doc.page.width - left * 2;
  const columns = [126, 170, 116, tableWidth - 126 - 170 - 116];
  const titleY = 18;
  const descriptionY = 49;
  const tableTop = template.description ? 82 : 65;
  const rowSize = template.typography.rowSize;
  const valueSize = template.typography.tableBodySize;

  doc.fontSize(template.typography.titleSize).fillColor('#111827').text(normalizePdfText(template.title), left, titleY, {
    width: tableWidth,
    align: 'center',
  });

  if (template.description) {
    doc.fontSize(Math.max(9, rowSize - 1)).fillColor('#475569').text(normalizePdfText(template.description), left, descriptionY, {
      width: tableWidth,
      align: 'center',
    });
    doc.fillColor('#111827');
  }

  let y = tableTop;
  const heights = {
    unit: 50,
    time: 48,
    quantity: 98,
    contact: 50,
    address: 145,
    signature: 242,
  };

  drawFormCell(doc, left, y, columns[0], heights.unit, labelForSource(template, 'tenant.name', '申请单位'), { fontSize: rowSize, boldLike: true });
  drawFormCell(doc, left + columns[0], y, columns[1] + columns[2] + columns[3], heights.unit, valueForSource('tenant.name', context), { fontSize: valueSize, align: 'left' });
  y += heights.unit;

  drawFormCell(doc, left, y, columns[0], heights.time, labelForSource(template, 'requestedAt', '申请时间'), { fontSize: rowSize, boldLike: true });
  drawFormCell(doc, left + columns[0], y, columns[1] + columns[2] + columns[3], heights.time, valueForSource('requestedAt', context), { fontSize: valueSize, align: 'left' });
  y += heights.time;

  drawFormCell(doc, left, y, columns[0], heights.quantity, multilineQuantityLabel(labelForSource(template, 'blankCertQuantity', '申请空白证书数量')), { fontSize: rowSize, boldLike: true });
  drawFormCell(doc, left + columns[0], y, columns[1], heights.quantity, valueForSource('blankCertQuantity', context), { fontSize: valueSize, align: 'center' });
  drawFormCell(doc, left + columns[0] + columns[1], y, columns[2], heights.quantity, multilineQuantityLabel(labelForSource(template, 'shellQuantity', '申请证书壳数量')), { fontSize: rowSize, boldLike: true });
  drawFormCell(doc, left + columns[0] + columns[1] + columns[2], y, columns[3], heights.quantity, valueForSource('shellQuantity', context), { fontSize: valueSize, align: 'center' });
  y += heights.quantity;

  drawFormCell(doc, left, y, columns[0], heights.contact, labelForSource(template, 'contactName', '联系人'), { fontSize: rowSize, boldLike: true });
  drawFormCell(doc, left + columns[0], y, columns[1], heights.contact, valueForSource('contactName', context), { fontSize: valueSize, align: 'left' });
  drawFormCell(doc, left + columns[0] + columns[1], y, columns[2], heights.contact, labelForSource(template, 'contactPhone', '联系电话'), { fontSize: rowSize, boldLike: true });
  drawFormCell(doc, left + columns[0] + columns[1] + columns[2], y, columns[3], heights.contact, valueForSource('contactPhone', context), { fontSize: valueSize, align: 'left' });
  y += heights.contact;

  drawFormCell(doc, left, y, columns[0], heights.address, labelForSource(template, 'mailingAddress', '邮寄地址'), { fontSize: rowSize, boldLike: true, verticalAlign: 'top' });
  drawFormCell(doc, left + columns[0], y, columns[1] + columns[2] + columns[3], heights.address, valueForSource('mailingAddress', context), { fontSize: valueSize, align: 'left', verticalAlign: 'top' });
  y += heights.address;

  drawFormCell(doc, left, y, columns[0], heights.signature, template.signatures[0] || '分支机构\n确认', { fontSize: rowSize, boldLike: true });
  const signatureLeft = left + columns[0];
  const signatureWidth = columns[1] + columns[2] + columns[3];
  drawFormCell(doc, signatureLeft, y, signatureWidth, heights.signature, '', { fontSize: rowSize });
  const signatureY = y + 112;
  drawPlainTextInCell(doc, template.signatures[1] || '负责人签字：', signatureLeft + 12, signatureY, columns[1] + 80, rowSize);
  drawPlainTextInCell(doc, template.signatures[2] || '单位盖章：', signatureLeft + columns[1] + columns[2] + 22, signatureY, columns[3] + 40, rowSize);
}

export function renderCertificatePrintTemplate(
  doc: PDFKit.PDFDocument,
  template: CertificatePrintTemplateDefinition,
  certificates: Array<Record<string, unknown>>,
  calibration: CertificatePrintCalibration,
): void {
  certificates.forEach((certificate, index) => {
    if (index > 0) doc.addPage(pdfDocumentOptionsFromTemplate(template));
    template.fields.forEach((field) => {
      const value = resolveTemplateValue(field.source, certificate);
      if (field.type === 'image') {
        drawTemplateImage(
          doc,
          {
            x: certificatePrintMmToPt(field.xMm),
            y: certificatePrintMmToPt(field.yMm),
            width: certificatePrintMmToPt(field.widthMm),
            height: certificatePrintMmToPt(field.heightMm),
          },
          value,
          calibration,
        );
        return;
      }

      drawTemplateField(
        doc,
        {
          x: certificatePrintMmToPt(field.xMm),
          y: certificatePrintMmToPt(field.yMm),
          width: certificatePrintMmToPt(field.widthMm),
          height: certificatePrintMmToPt(field.heightMm),
          size: field.fontSize,
          align: field.align,
        },
        value,
        calibration,
      );
    });
  });
}

export function renderTable5PdfTemplate(
  doc: PDFKit.PDFDocument,
  template: Table5PdfTemplateDefinition,
  batch: {
    tenant: { name: string };
    unitLeader: string;
    informationManager: string;
    title: string;
    uploadDateText: string;
    dataType: string;
  },
  summaryRows: Array<{ occupation: string; profession: string; level: string; quantity: number }>,
  total: number,
): void {
  const layout = createTable5Layout(doc, template);
  const maxRowsPerPage = Math.max(
    layout.minSummaryRows,
    Math.floor((doc.page.height - layout.tableTop - layout.basicInfoHeight - layout.dataTypeHeight - layout.headerHeight - layout.totalHeight - layout.managerOpinionHeight - layout.unitOpinionHeight - template.page.margin) / layout.summaryRowHeight),
  );
  const sourceRows = summaryRows.length > 0 ? summaryRows : [{ occupation: '', profession: '', level: '', quantity: 0 }];
  const chunks = chunkRows(sourceRows, maxRowsPerPage);

  chunks.forEach((chunk, pageIndex) => {
    if (pageIndex > 0) doc.addPage(pdfDocumentOptionsFromTemplate(template));
    renderTable5Page(doc, template, batch, chunk, pageIndex === chunks.length - 1, total, layout);
  });
}

export function renderPdfTitle(doc: PDFKit.PDFDocument, title: string, size = 18): void {
  doc.fontSize(size).text(normalizePdfText(title), { align: 'center' });
  doc.moveDown();
}

type Table5BatchContext = {
  tenant: { name: string };
  unitLeader: string;
  informationManager: string;
  title: string;
  uploadDateText: string;
  dataType: string;
};

type Table5SummaryRow = { occupation: string; profession: string; level: string; quantity: number };

type Table5Layout = {
  left: number;
  top: number;
  tableTop: number;
  widths: number[];
  tableWidth: number;
  basicRowHeight: number;
  basicInfoHeight: number;
  dataTypeHeight: number;
  headerHeight: number;
  summaryRowHeight: number;
  totalHeight: number;
  managerOpinionHeight: number;
  unitOpinionHeight: number;
  minSummaryRows: number;
};

function createTable5Layout(doc: PDFKit.PDFDocument, template: Table5PdfTemplateDefinition): Table5Layout {
  const left = template.page.margin;
  const tableWidth = doc.page.width - left * 2;
  const widths = [
    Math.round(tableWidth * 0.17),
    Math.round(tableWidth * 0.29),
    Math.round(tableWidth * 0.16),
    Math.round(tableWidth * 0.24),
    0,
  ];
  widths[4] = tableWidth - widths[0] - widths[1] - widths[2] - widths[3];
  const basicRowHeight = 34;
  return {
    left,
    top: 22,
    tableTop: 92,
    widths,
    tableWidth,
    basicRowHeight,
    basicInfoHeight: basicRowHeight * 5,
    dataTypeHeight: 34,
    headerHeight: 34,
    summaryRowHeight: 34,
    totalHeight: 34,
    managerOpinionHeight: 72,
    unitOpinionHeight: 86,
    minSummaryRows: 5,
  };
}

function renderTable5Page(
  doc: PDFKit.PDFDocument,
  template: Table5PdfTemplateDefinition,
  batch: Table5BatchContext,
  rows: Table5SummaryRow[],
  isLastPage: boolean,
  total: number,
  layout: Table5Layout,
): void {
  const [w0, w1, w2, w3, w4] = layout.widths;
  if (template.codeLabel) {
    doc.fontSize(11).text(normalizePdfText(template.codeLabel), layout.left, layout.top);
  }
  doc.fontSize(template.typography.titleSize).text(normalizePdfText(template.title), layout.left, layout.top + 28, {
    width: layout.tableWidth,
    align: 'center',
  });

  let y = layout.tableTop;
  drawCell(doc, layout.left, y, w0, layout.basicInfoHeight, template.labels.basicInfo);
  drawCell(doc, layout.left + w0, y, w1, layout.basicRowHeight, template.labels.tenantName);
  drawCell(doc, layout.left + w0 + w1, y, w2 + w3 + w4, layout.basicRowHeight, batch.tenant.name);
  y += layout.basicRowHeight;

  drawCell(doc, layout.left + w0, y, w1, layout.basicRowHeight, template.labels.unitLeader);
  drawCell(doc, layout.left + w0 + w1, y, w2 + w3 + w4, layout.basicRowHeight, batch.unitLeader);
  y += layout.basicRowHeight;

  drawCell(doc, layout.left + w0, y, w1, layout.basicRowHeight, template.labels.informationManager);
  drawCell(doc, layout.left + w0 + w1, y, w2 + w3 + w4, layout.basicRowHeight, batch.informationManager);
  y += layout.basicRowHeight;

  drawCell(doc, layout.left + w0, y, w1, layout.basicRowHeight, template.labels.batchTitle);
  drawCell(doc, layout.left + w0 + w1, y, w2 + w3 + w4, layout.basicRowHeight, batch.title);
  y += layout.basicRowHeight;

  drawCell(doc, layout.left + w0, y, w1, layout.basicRowHeight, template.labels.uploadDate);
  drawCell(doc, layout.left + w0 + w1, y, w2 + w3 + w4, layout.basicRowHeight, batch.uploadDateText);
  y += layout.basicRowHeight;

  const displayedRows = [...rows];
  if (isLastPage) {
    while (displayedRows.length < layout.minSummaryRows) {
      displayedRows.push({ occupation: '', profession: '', level: '', quantity: 0 });
    }
  }
  const dataInfoHeight = layout.dataTypeHeight + layout.headerHeight + displayedRows.length * layout.summaryRowHeight + (isLastPage ? layout.totalHeight : 0);
  drawCell(doc, layout.left, y, w0, dataInfoHeight, template.labels.dataInfo);
  drawCell(doc, layout.left + w0, y, w1, layout.dataTypeHeight, template.labels.dataType);
  drawCell(doc, layout.left + w0 + w1, y, w2 + w3 + w4, layout.dataTypeHeight, batch.dataType);
  y += layout.dataTypeHeight;

  drawCell(doc, layout.left + w0, y, w1, layout.headerHeight, template.labels.occupation);
  drawCell(doc, layout.left + w0 + w1, y, w2, layout.headerHeight, template.labels.profession);
  drawCell(doc, layout.left + w0 + w1 + w2, y, w3, layout.headerHeight, template.labels.level);
  drawCell(doc, layout.left + w0 + w1 + w2 + w3, y, w4, layout.headerHeight, template.labels.quantity);
  y += layout.headerHeight;

  displayedRows.forEach((row) => {
    drawCell(doc, layout.left + w0, y, w1, layout.summaryRowHeight, row.occupation);
    drawCell(doc, layout.left + w0 + w1, y, w2, layout.summaryRowHeight, row.profession);
    drawCell(doc, layout.left + w0 + w1 + w2, y, w3, layout.summaryRowHeight, row.level);
    drawCell(doc, layout.left + w0 + w1 + w2 + w3, y, w4, layout.summaryRowHeight, row.quantity ? String(row.quantity) : '');
    y += layout.summaryRowHeight;
  });

  if (!isLastPage) return;

  drawCell(doc, layout.left + w0, y, w1 + w2 + w3, layout.totalHeight, template.labels.total);
  drawCell(doc, layout.left + w0 + w1 + w2 + w3, y, w4, layout.totalHeight, String(total));
  y += layout.totalHeight;

  drawCell(doc, layout.left, y, w0, layout.managerOpinionHeight, template.labels.informationManagerOpinion);
  drawCell(doc, layout.left + w0, y, w1 + w2 + w3 + w4, layout.managerOpinionHeight, template.signatures.informationManagerOpinion, 'left');
  y += layout.managerOpinionHeight;

  drawCell(doc, layout.left, y, w0, layout.unitOpinionHeight, template.labels.unitOpinion);
  drawCell(doc, layout.left + w0, y, w1 + w2 + w3 + w4, layout.unitOpinionHeight, template.signatures.unitOpinion, 'left');
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

export function renderPdfTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  options: { widths?: number[]; headerSize?: number; bodySize?: number } = {},
): void {
  const startX = doc.x;
  const widths = options.widths ?? headers.map((_, index) => index === headers.length - 1 ? 90 : 95);
  let y = doc.y;
  const paddingX = 4;
  const paddingY = 7;
  const minHeight = 28;
  const bottomY = () => doc.page.height - doc.page.margins.bottom;
  const rowHeight = (cells: string[], header = false) => {
    const fontSize = header ? options.headerSize ?? 10 : options.bodySize ?? 9;
    doc.fontSize(fontSize);
    return Math.max(
      minHeight,
      ...cells.map((cell, index) => doc.heightOfString(normalizePdfText(cell), {
        width: Math.max(1, widths[index] - paddingX * 2),
        lineGap: 1,
      }) + paddingY * 2),
    );
  };
  const drawRow = (cells: string[], header = false) => {
    const height = rowHeight(cells, header);
    let x = startX;
    cells.forEach((cell, index) => {
      doc.rect(x, y, widths[index], height).stroke();
      doc.fontSize(header ? options.headerSize ?? 10 : options.bodySize ?? 9).text(normalizePdfText(cell), x + paddingX, y + paddingY, {
        width: Math.max(1, widths[index] - paddingX * 2),
        height: Math.max(1, height - paddingY * 2),
        lineGap: 1,
      });
      x += widths[index];
    });
    y += height;
  };
  drawRow(headers, true);
  rows.forEach((row) => {
    const height = rowHeight(row);
    if (y + height > bottomY()) {
      doc.addPage();
      y = doc.y;
      drawRow(headers, true);
    }
    drawRow(row);
  });
  doc.y = y + 8;
}

function drawTemplateField(
  doc: PDFKit.PDFDocument,
  field: { x: number; y: number; width: number; height: number; size: number; align: 'left' | 'center' | 'right' },
  value: string,
  calibration: CertificatePrintCalibration,
): void {
  const text = normalizePdfText(value || '');
  let fontSize = field.size * calibration.fontScale;
  while (fontSize > 8 && doc.fontSize(fontSize).widthOfString(text) > field.width - 4) {
    fontSize -= 1;
  }
  const textHeight = doc.fontSize(fontSize).heightOfString(text, { width: field.width });
  doc
    .fontSize(fontSize)
    .text(text, field.x + calibration.offsetX, field.y + calibration.offsetY + Math.max(0, (field.height - textHeight) / 2), {
      width: field.width,
      height: field.height,
      align: field.align,
      lineBreak: false,
    });
}

function drawTemplateImage(
  doc: PDFKit.PDFDocument,
  box: { x: number; y: number; width: number; height: number },
  value: string,
  calibration: CertificatePrintCalibration,
): void {
  if (!value) return;
  doc.image(value, box.x + calibration.offsetX, box.y + calibration.offsetY, {
    fit: [box.width, box.height],
    align: 'center',
    valign: 'center',
  });
}

function drawCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  align: 'center' | 'left' = 'center',
): void {
  doc.rect(x, y, width, height).stroke();
  doc.fontSize(10).text(normalizePdfText(text), x + 6, y + 8, {
    width: width - 12,
    height: height - 12,
    align,
  });
}

function drawFormCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  options: {
    align?: 'center' | 'left' | 'right';
    fontSize?: number;
    verticalAlign?: 'middle' | 'top';
    boldLike?: boolean;
  } = {},
): void {
  const fontSize = options.fontSize ?? 12;
  const displayText = normalizePdfText(text);
  const paddingX = options.align === 'left' ? 10 : 6;
  const paddingTop = options.verticalAlign === 'top' ? 14 : 0;
  const contentWidth = Math.max(1, width - paddingX * 2);
  doc.rect(x, y, width, height).stroke();
  doc.fontSize(fontSize).fillColor('#111827');
  const textHeight = measureTextHeight(doc, displayText, contentWidth, fontSize);
  const textY = options.verticalAlign === 'top'
    ? y + paddingTop
    : y + Math.max(0, (height - textHeight) / 2);
  doc.text(displayText, x + paddingX, textY, {
    width: contentWidth,
    height: Math.max(1, height - 8),
    align: options.align ?? 'center',
    lineGap: 2,
  });
}

function drawPlainTextInCell(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
): void {
  doc.fontSize(fontSize).fillColor('#111827').text(normalizePdfText(text), x, y, { width, align: 'left' });
}

function measureTextHeight(doc: PDFKit.PDFDocument, text: string, width: number, fontSize: number): number {
  const docWithMeasure = doc as PDFKit.PDFDocument & { heightOfString?: (text: string, options: { width: number; lineGap?: number }) => number };
  if (typeof docWithMeasure.heightOfString === 'function') {
    return docWithMeasure.heightOfString(text, { width, lineGap: 2 });
  }
  return Math.max(1, text.split('\n').length) * fontSize * 1.25;
}

function labelForSource(template: StandardPdfTemplateDefinition, source: string, fallback: string): string {
  return template.rows.find((row) => row.source === source)?.label || fallback;
}

function valueForSource(source: string, context: Record<string, unknown>): string {
  return resolveTemplateValue(source, context);
}

function multilineQuantityLabel(label: string): string {
  return label.endsWith('数量') ? `${label.slice(0, -2)}\n数量` : label;
}

function resolveTemplateArray(source: string, context: Record<string, unknown>): Array<Record<string, unknown>> {
  const value = resolvePath(source, context);
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
}

function resolveTemplateValue(source: string, context: Record<string, unknown>): string {
  const value = resolvePath(source, context);
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function resolvePath(path: string, context: Record<string, unknown>): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, context);
}
