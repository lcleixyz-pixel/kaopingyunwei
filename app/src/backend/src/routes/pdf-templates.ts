// ═══════════════════════════════════════════════════
// PDF 打印模板路由 — 总部统一配置驱动模板
// ═══════════════════════════════════════════════════

import { Router, type Response } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { recordAudit } from '../utils/audit.js';
import { error, success } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { parseBody } from '../utils/routeValidation.js';
import { applyPdfFont, PdfFontMissingError, requireCertificatePrintFont, requireChinesePdfFont } from '../utils/pdfFonts.js';
import {
  DEFAULT_PDF_TEMPLATES,
  PDF_TEMPLATE_KEYS,
  PdfTemplateValidationError,
  formatPdfTemplateRecord,
  formatPdfTemplateRecords,
  isPdfTemplateKey,
  validatePdfTemplateDefinition,
  type PdfTemplateDefinition,
  type PdfTemplateKey,
} from '../services/pdfTemplates.js';
import {
  pdfDocumentOptionsFromTemplate,
  renderCertificatePrintTemplate,
  renderStandardPdfTemplate,
  renderTable5PdfTemplate,
} from '../services/pdfTemplateRenderer.js';

const router = Router();

router.use(authenticate);

const updatePdfTemplateSchema = z.object({
  name: z.string().trim().max(100, '模板名称最多100字').optional(),
  definition: z.unknown(),
});

router.get('/', async (_req, res) => {
  try {
    const records = await prisma.pdfTemplate.findMany({
      where: { key: { in: [...PDF_TEMPLATE_KEYS] } },
      orderBy: { updatedAt: 'desc' },
    });
    success(res, formatPdfTemplateRecords(records));
  } catch (err) {
    handleRouteError(res, err, '获取 PDF 打印模板失败');
  }
});

router.get('/:key', async (req, res) => {
  try {
    const key = parseTemplateKey(req.params.key);
    if (!key) {
      error(res, 'NOT_FOUND', 'PDF 打印模板不存在', 404);
      return;
    }

    const record = await prisma.pdfTemplate.findUnique({ where: { key } });
    success(res, formatPdfTemplateRecord(key, record));
  } catch (err) {
    handleRouteError(res, err, '获取 PDF 打印模板失败');
  }
});

router.put('/:key', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  try {
    const key = parseTemplateKey(req.params.key);
    if (!key) {
      error(res, 'NOT_FOUND', 'PDF 打印模板不存在', 404);
      return;
    }

    const fallback = DEFAULT_PDF_TEMPLATES[key];
    const body = parseBody(updatePdfTemplateSchema, req.body);
    const definition = validatePdfTemplateDefinition(key, body.definition);
    const name = normalizeTemplateName(body.name) || fallback.name;
    const oldTemplate = await prisma.pdfTemplate.findUnique({ where: { key } });
    const template = await prisma.pdfTemplate.upsert({
      where: { key },
      update: {
        name,
        version: (oldTemplate?.version ?? fallback.version) + 1,
        definitionJson: JSON.stringify(definition),
        isEnabled: true,
        updatedBy: req.userId,
      },
      create: {
        key,
        name,
        version: fallback.version,
        definitionJson: JSON.stringify(definition),
        isEnabled: true,
        updatedBy: req.userId,
      },
    });

    await recordAudit(req, {
      action: 'PDF_TEMPLATE_UPDATE',
      target: 'PdfTemplate',
      targetId: template.id,
      oldValue: oldTemplate,
      newValue: { key, name, definition },
    });

    success(res, formatPdfTemplateRecord(key, template));
  } catch (err) {
    handleRouteError(res, err, '保存 PDF 打印模板失败');
  }
});

router.post('/:key/reset', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  try {
    const key = parseTemplateKey(req.params.key);
    if (!key) {
      error(res, 'NOT_FOUND', 'PDF 打印模板不存在', 404);
      return;
    }

    const oldTemplates = await prisma.pdfTemplate.findMany({ where: { key } });
    await prisma.pdfTemplate.deleteMany({ where: { key } });

    await recordAudit(req, {
      action: 'PDF_TEMPLATE_RESET',
      target: 'PdfTemplate',
      targetId: key,
      oldValue: oldTemplates,
      newValue: { key, resetToDefault: true },
    });

    success(res, formatPdfTemplateRecord(key, null));
  } catch (err) {
    handleRouteError(res, err, '重置 PDF 打印模板失败');
  }
});

router.get('/:key/preview.pdf', async (req, res) => {
  try {
    const key = parseTemplateKey(req.params.key);
    if (!key) {
      error(res, 'NOT_FOUND', 'PDF 打印模板不存在', 404);
      return;
    }

    const record = await prisma.pdfTemplate.findUnique({ where: { key } });
    const definition = formatPdfTemplateRecord(key, record).definition;
    sendPreviewPdf(res, key, definition);
  } catch (err) {
    handleRouteError(res, err, '生成 PDF 模板预览失败');
  }
});

function sendPreviewPdf(res: Response, key: PdfTemplateKey, definition: PdfTemplateDefinition): void {
  sendPdf(res, `${DEFAULT_PDF_TEMPLATES[key].name}-预览.pdf`, definition, (doc) => {
    if (definition.kind === 'certificate-print') {
      applyPdfFont(doc, requireCertificatePrintFont());
      renderCertificatePrintTemplate(doc, definition, [sampleCertificateContext()], { offsetX: 0, offsetY: 0, fontScale: 1 });
      return;
    }

    applyPdfFont(doc, requireChinesePdfFont());
    if (definition.kind === 'table5') {
      renderTable5PdfTemplate(doc, definition, sampleTable5Batch(), [
        { occupation: '贵金属首饰与宝玉石检测员', profession: '宝石检验员', level: '三级/高级工', quantity: 12 },
        { occupation: '贵金属首饰与宝玉石检测员', profession: '玉石检验员', level: '四级/中级工', quantity: 8 },
        { occupation: '贵金属首饰与宝玉石检测员', profession: '钻石检验员', level: '五级/初级工', quantity: 6 },
      ], 26);
      return;
    }

    renderStandardPdfTemplate(doc, definition, sampleStandardContext(key));
  });
}

function sendPdf(
  res: Response,
  filename: string,
  definition: PdfTemplateDefinition,
  render: (doc: PDFKit.PDFDocument) => void,
): void {
  const doc = new PDFDocument(pdfDocumentOptionsFromTemplate(definition));
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', encodeContentDisposition(filename));
    res.send(Buffer.concat(chunks));
  });
  render(doc);
  doc.end();
}

function sampleStandardContext(key: PdfTemplateKey): Record<string, unknown> {
  if (key === 'CERT_PRINT_SIGNATURE') {
    return {
      plan: { title: '2026年5月珠宝玉石职业技能等级认定', displayName: '贵金属首饰与宝玉石检测员 / 宝石检验员 / 三级/高级工' },
      record: { responsiblePerson: '王老师', actualPrintedCount: 2, createdAt: '2026-05-13' },
      certificates: [
        { candidate: { name: '张三', idCard: '110101199001010011' }, certNo: 'S0000000001', certDisplayIssueDate: '2026-05-10', signatureBlank: '' },
        { candidate: { name: '李四', idCard: '110101199001010022' }, certNo: 'S0000000002', certDisplayIssueDate: '2026-05-10', signatureBlank: '' },
      ],
    };
  }
  if (key === 'CERT_DESTROY_BATCH') {
    return {
      batch: { title: '2026年5月证书作废销毁批次', responsiblePerson: '赵老师', createdAt: '2026-05-13', notes: '打印污损登记销毁' },
      voidRecords: [
        { tenant: { name: '国家珠宝玉石首饰检验集团有限公司' }, plan: { title: '2026年5月认定计划' }, itemTypeLabel: '空白证书', quantity: 1, reason: '打印污损' },
        { tenant: { name: '国家珠宝玉石首饰检验集团有限公司' }, plan: { title: '2026年5月认定计划' }, itemTypeLabel: '证书壳', quantity: 1, reason: '运输破损' },
      ],
    };
  }
  return {
    tenant: { name: '国家珠宝玉石首饰检验集团有限公司' },
    requestedAt: '2026-05-13',
    blankCertQuantity: 20,
    shellQuantity: 20,
    responsiblePerson: '王老师',
    contactName: '李老师',
    contactPhone: '13800000000',
    mailingAddress: '北京市朝阳区示例路 1 号',
    notes: '用于2026年5月认定计划',
  };
}

function sampleCertificateContext(): Record<string, unknown> {
  return {
    candidate: {
      name: '张三',
      idCard: '110101199001010011',
      plan: {
        occupation: '贵金属首饰与宝玉石检测员',
        profession: '宝石检验员',
        level: '三级/高级工',
      },
    },
    idTypeLabel: '居民身份证',
    certNo: 'S0000000001',
    certDisplayIssueDate: '2026     05   10',
  };
}

function sampleTable5Batch() {
  return {
    tenant: { name: '国家珠宝玉石首饰检验集团有限公司' },
    unitLeader: '赵老师',
    informationManager: '钱老师',
    title: '2026年5月职业技能等级证书上报批次',
    uploadDateText: '2026年5月13日',
    dataType: '新增',
  };
}

function parseTemplateKey(value: unknown): PdfTemplateKey | null {
  return isPdfTemplateKey(value) ? value : null;
}

function normalizeTemplateName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 100) : '';
}

function encodeContentDisposition(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function handleRouteError(res: Response, err: unknown, fallbackMessage: string): void {
  if (err instanceof PdfTemplateValidationError) {
    error(res, err.code, err.message, err.statusCode);
    return;
  }
  if (err instanceof PdfFontMissingError) {
    error(res, err.code, err.message, err.statusCode);
    return;
  }
  logger.error({ err }, fallbackMessage);
  error(res, 'INTERNAL_ERROR', fallbackMessage, 500);
}

export default router;
