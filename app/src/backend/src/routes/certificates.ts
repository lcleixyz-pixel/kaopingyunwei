// ═══════════════════════════════════════════════════
// 证书路由 — 地方编号回填、库存申领、打印发放、作废销毁、补办
// ═══════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type {
  CertificateItemType,
  CertificateStockMovementType,
  CertNoSource,
  CertStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { recordAudit } from '../utils/audit.js';
import { decrypt } from '../utils/crypto.js';
import { addWorkDaysWithCalendar } from '../utils/dateUtils.js';
import { getWorkdayCalendarConfig } from '../services/workdayCalendars.js';
import { planTenantWhereForRead, tenantWhereForRead } from '../services/accessScope.js';
import {
  buildCertificateImportPreview,
  canReadCertificateAcrossTenants,
  certificatePrintMmToPt,
  computeStockBalance,
  formatCertificatePrintDate,
  getLowStockReminder,
  normalizeText,
  parseCertificateDisplayDate,
  validateCertificateAssignment,
  validateLedgerResponsibility,
  validatePrintCertificateSelection,
  validatePrintRecordSettlement,
  validatePrintUsage,
  type CertificateImportCandidate,
  type CertificateImportRow,
} from '../services/certificateManagementRules.js';

const router = Router();

router.use(authenticate);

const dataFilesDir = path.resolve(process.cwd(), 'data/files');
const certificateUploadDir = path.join(dataFilesDir, 'certificates');

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdir(certificateUploadDir, { recursive: true })
        .then(() => callback(null, certificateUploadDir))
        .catch((err: Error) => callback(err, certificateUploadDir));
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${path.extname(file.originalname || '')}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const itemTypeSchema = z.enum(['BLANK_CERT', 'CERT_SHELL']);
const certStatusSchema = z.enum(['PENDING', 'PRINTED', 'ISSUED', 'REISSUE_REQUESTED']);

const certificateRecordSchema = z.object({
  candidateId: z.string().min(1),
  certNo: z.string().trim().min(1, '证书编号不能为空'),
  certDisplayIssueDate: z.string().trim().min(1, '证书版面发证日期不能为空'),
  certNoSource: z.enum(['LOCAL_IMPORT', 'MANUAL']).default('MANUAL'),
});

const certificateRecordPatchSchema = z.object({
  certNo: z.string().trim().min(1).optional(),
  certDisplayIssueDate: z.string().trim().min(1).optional(),
  certNoSource: z.enum(['LOCAL_IMPORT', 'MANUAL', 'LEGACY_AUTO']).optional(),
  status: certStatusSchema.optional(),
  deliveryMethod: z.string().trim().max(50).optional(),
  receiverName: z.string().trim().max(100).optional(),
  receiverPhone: z.string().trim().max(50).optional(),
  mailingAddress: z.string().trim().max(500).optional(),
  trackingNo: z.string().trim().max(100).optional(),
  printBatchNo: z.string().trim().max(100).optional(),
  verificationItems: z.record(z.string(), z.boolean()).optional(),
  issueNotes: z.string().trim().max(1000).optional(),
});

const importCommitSchema = z.object({
  planId: z.string().min(1),
  rows: z.array(z.object({
    rowNumber: z.number().int().positive(),
    name: z.string(),
    idCard: z.string(),
    certNo: z.string(),
    certDisplayIssueDate: z.string(),
  })).min(1),
});

const supplyRequestSchema = z.object({
  itemType: itemTypeSchema.optional(),
  quantity: z.coerce.number().int().positive().optional(),
  blankCertQuantity: z.coerce.number().int().min(0).default(0),
  shellQuantity: z.coerce.number().int().min(0).default(0),
  responsiblePerson: z.string().trim().min(1, '责任人不能为空'),
  contactName: z.string().trim().max(100).optional(),
  contactPhone: z.string().trim().max(50).optional(),
  mailingAddress: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const supplyActionSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
  rejectReason: z.string().trim().max(1000).optional(),
});

const printRecordSchema = z.object({
  planId: z.string().min(1),
  certificateIds: z.array(z.string().min(1)).default([]),
  blankCertUsed: z.coerce.number().int().min(0).default(0),
  shellUsed: z.coerce.number().int().min(0).default(0),
  blankCertReturned: z.coerce.number().int().min(0).default(0),
  shellReturned: z.coerce.number().int().min(0).default(0),
  blankCertVoided: z.coerce.number().int().min(0).default(0),
  shellVoided: z.coerce.number().int().min(0).default(0),
  actualPrintedCount: z.coerce.number().int().min(0).default(0),
  responsiblePerson: z.string().trim().min(1, '责任人不能为空'),
  overrideReason: z.string().trim().max(1000).optional(),
  verificationItems: z.record(z.string(), z.boolean()).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const voidRecordSchema = z.object({
  planId: z.string().min(1).optional(),
  certificateId: z.string().min(1).optional(),
  itemType: itemTypeSchema,
  quantity: z.coerce.number().int().positive(),
  responsiblePerson: z.string().trim().min(1, '责任人不能为空'),
  reason: z.string().trim().min(1, '作废原因不能为空').max(1000),
});

const destroyBatchSchema = z.object({
  title: z.string().trim().min(1, '销毁批次名称不能为空').max(200),
  responsiblePerson: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  voidRecordIds: z.array(z.string()).default([]),
});

const reissueRequestSchema = z.object({
  planId: z.string().min(1).optional(),
  candidateId: z.string().min(1).optional(),
  certificateId: z.string().min(1).optional(),
  applicantName: z.string().trim().min(1),
  applicantPhone: z.string().trim().max(50).optional(),
  applicantIdCard: z.string().trim().max(50).optional(),
  certNo: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(1).max(1000),
  mailingAddress: z.string().trim().max(500).optional(),
  responsiblePerson: z.string().trim().max(100).optional(),
  feeCents: z.coerce.number().int().min(0).default(20000),
  mailingFeeCents: z.coerce.number().int().min(0).default(0),
});

const reissueReviewSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().trim().max(1000).optional(),
});

const reissueIssueSchema = z.object({
  mailingAddress: z.string().trim().max(500).optional(),
  responsiblePerson: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const stocktakeSchema = z.object({
  itemType: itemTypeSchema,
  stocktakeType: z.enum(['QUARTERLY', 'HALF_YEAR', 'ANNUAL', 'MANUAL']),
  actualQuantity: z.coerce.number().int().min(0),
  responsiblePerson: z.string().trim().min(1, '责任人不能为空'),
  notes: z.string().trim().max(1000).optional(),
});

const attachmentSchema = z.object({
  entityType: z.string().trim().min(1).max(100),
  entityId: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
});

const NODE_ORDER = [
  'PLAN_CREATE',
  'REGISTRATION',
  'ROOM_ARRANGE',
  'EXAM_PREPARE',
  'EXAM_DAY',
  'SCORE_RECORD',
  'SCORE_PUBLISH',
  'CERT_MANAGE',
  'COMPLETE',
];

router.get('/', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status !== 'ALL'
      ? req.query.status as CertStatus
      : undefined;

    const certificates = await prisma.certificate.findMany({
      where: {
        ...(status ? { status } : {}),
        candidate: tenantWhereForRead(req),
      },
      orderBy: { updatedAt: 'desc' },
      include: certificateInclude(),
    });

    success(res, certificates.map(sanitizeCertificate));
  } catch (err) {
    console.error('Get certificates error:', err);
    error(res, 'INTERNAL_ERROR', '获取证书列表失败', 500);
  }
});

router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.examPlan.findMany({
      where: planTenantWhereForRead(req),
      orderBy: { examDate: 'desc' },
      include: {
        tenant: { select: { id: true, code: true, name: true, type: true } },
        nodes: { where: { nodeType: 'CERT_MANAGE' }, orderBy: { createdAt: 'asc' } },
        candidates: {
          include: {
            score: { select: { isPass: true } },
            certificate: true,
          },
        },
        certificateVoidRecords: true,
        certificateReissueRequests: true,
      },
    });

    success(res, plans.map((plan) => {
      const passedCandidates = plan.candidates.filter((candidate) => isPassed(candidate));
      const certificates = plan.candidates
        .map((candidate) => candidate.certificate)
        .filter((certificate): certificate is NonNullable<typeof certificate> => Boolean(certificate));

      return {
        id: plan.id,
        title: plan.title,
        tenant: plan.tenant,
        examDate: plan.examDate,
        occupation: plan.occupation,
        profession: plan.profession,
        level: plan.level,
        status: plan.status,
        certNode: plan.nodes[0] || null,
        summary: {
          passedCount: passedCandidates.length,
          certNoCount: certificates.filter((certificate) => certificate.certNo).length,
          printedCount: certificates.filter((certificate) => ['PRINTED', 'ISSUED', 'REISSUE_REQUESTED'].includes(certificate.status)).length,
          issuedCount: certificates.filter((certificate) => certificate.status === 'ISSUED').length,
          voidCount: plan.certificateVoidRecords.reduce((sum, item) => sum + item.quantity, 0),
          reissueCount: plan.certificateReissueRequests.length,
        },
      };
    }));
  } catch (err) {
    console.error('Get certificate plans error:', err);
    error(res, 'INTERNAL_ERROR', '获取证书计划工作台失败', 500);
  }
});

router.get('/records', async (req, res) => {
  try {
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;
    if (!planId) {
      error(res, 'VALIDATION_ERROR', '缺少计划ID', 400);
      return;
    }

    const plan = await prisma.examPlan.findFirst({
      where: { id: planId, ...planTenantWhereForRead(req) },
      select: { id: true },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        planId,
        OR: [{ status: 'PASSED' }, { score: { isPass: true } }],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        plan: { select: { id: true, title: true, profession: true, level: true } },
        score: true,
        certificate: true,
      },
    });

    success(res, candidates.map((candidate) => ({
      candidate: {
        ...candidate,
        idCard: safeDecrypt(candidate.idCard),
      },
      certificate: candidate.certificate,
    })));
  } catch (err) {
    console.error('Get certificate records error:', err);
    error(res, 'INTERNAL_ERROR', '获取证书编号回填记录失败', 500);
  }
});

router.post('/records', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const result = certificateRecordSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const certificate = await upsertCertificateRecord(req, {
      candidateId: result.data.candidateId,
      certNo: result.data.certNo,
      certDisplayIssueDate: result.data.certDisplayIssueDate,
      certNoSource: result.data.certNoSource,
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_RECORD_UPSERT',
      target: 'Certificate',
      targetId: certificate.id,
      newValue: certificate,
    });

    success(res, sanitizeCertificate(certificate), 201);
  } catch (err) {
    handleRouteError(res, err, '保存证书编号失败');
  }
});

router.post('/records/import-preview', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), importUpload.single('file'), async (req, res) => {
  try {
    const planId = normalizeText(req.body.planId);
    if (!planId) {
      error(res, 'VALIDATION_ERROR', '缺少计划ID', 400);
      return;
    }
    if (!req.file) {
      error(res, 'VALIDATION_ERROR', '缺少证书编号导入文件', 400);
      return;
    }

    const rows = parseCertificateImportRows(req.file.buffer);
    const preview = await buildImportPreviewForPlan(req, planId, rows);
    success(res, preview);
  } catch (err) {
    handleRouteError(res, err, '解析证书编号导入文件失败');
  }
});

router.post('/records/import-commit', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const result = importCommitSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const preview = await buildImportPreviewForPlan(req, result.data.planId, result.data.rows);
    if (preview.summary.invalid > 0) {
      error(res, 'VALIDATION_ERROR', '导入预览存在错误，请修正后再提交', 400, JSON.stringify(preview.summary));
      return;
    }

    const rowsByCandidateId = new Map(preview.rows.map((row) => [row.candidateId!, row]));
    const certificates = [];
    for (const [candidateId, row] of rowsByCandidateId.entries()) {
      const certificate = await upsertCertificateRecord(req, {
        candidateId,
        certNo: row.certNo,
        certDisplayIssueDate: row.certDisplayIssueDate,
        certNoSource: 'LOCAL_IMPORT',
      });
      certificates.push(certificate);
    }

    await recordAudit(req, {
      action: 'CERTIFICATE_IMPORT_COMMIT',
      target: 'Certificate',
      targetId: result.data.planId,
      newValue: { planId: result.data.planId, count: certificates.length },
    });

    success(res, { count: certificates.length, certificates: certificates.map(sanitizeCertificate) });
  } catch (err) {
    handleRouteError(res, err, '提交证书编号导入失败');
  }
});

router.patch('/records/:id', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = certificateRecordPatchSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldCertificate = await findCertificateForMutation(req, id);
    if (!oldCertificate) {
      error(res, 'NOT_FOUND', '证书不存在', 404);
      return;
    }

    if (result.data.certNo && result.data.certNo !== oldCertificate.certNo) {
      await assertCertNoUsable({
        certNo: result.data.certNo,
        currentCertificateId: oldCertificate.id,
        candidateStatus: oldCertificate.candidate.status,
        scoreIsPass: oldCertificate.candidate.score?.isPass || false,
      });
    }

    const nextStatus = result.data.status;
    if (nextStatus === 'ISSUED') {
      assertCertificateReadyForDelivery(oldCertificate);
    }
    const certificate = await prisma.certificate.update({
      where: { id },
      data: {
        ...(result.data.certNo ? { certNo: result.data.certNo } : {}),
        ...(result.data.certDisplayIssueDate ? { certDisplayIssueDate: requireCertificateDisplayDate(result.data.certDisplayIssueDate) } : {}),
        ...(result.data.certNoSource ? { certNoSource: result.data.certNoSource } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextStatus === 'PRINTED' ? { printedAt: new Date() } : {}),
        ...(nextStatus === 'ISSUED' ? { issuedAt: new Date(), issuedBy: req.userId } : {}),
        deliveryMethod: result.data.deliveryMethod,
        receiverName: result.data.receiverName,
        receiverPhone: result.data.receiverPhone,
        mailingAddress: result.data.mailingAddress,
        trackingNo: result.data.trackingNo,
        printBatchNo: result.data.printBatchNo,
        verificationJson: result.data.verificationItems ? JSON.stringify(result.data.verificationItems) : undefined,
        issueNotes: result.data.issueNotes,
      },
      include: certificateInclude(),
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_RECORD_UPDATE',
      target: 'Certificate',
      targetId: certificate.id,
      oldValue: oldCertificate,
      newValue: certificate,
    });

    success(res, sanitizeCertificate(certificate));
  } catch (err) {
    handleRouteError(res, err, '更新证书记录失败');
  }
});

router.patch('/:id/status', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = z.object({ status: certStatusSchema }).safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldCertificate = await findCertificateForMutation(req, id);
    if (!oldCertificate) {
      error(res, 'NOT_FOUND', '证书不存在', 404);
      return;
    }
    if (result.data.status === 'ISSUED') {
      assertCertificateReadyForDelivery(oldCertificate);
    }

    const certificate = await prisma.certificate.update({
      where: { id },
      data: {
        status: result.data.status,
        ...(result.data.status === 'PRINTED' ? { printedAt: new Date() } : {}),
        ...(result.data.status === 'ISSUED' ? { issuedAt: new Date(), issuedBy: req.userId } : {}),
      },
      include: certificateInclude(),
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_STATUS_UPDATE',
      target: 'Certificate',
      targetId: certificate.id,
      oldValue: oldCertificate,
      newValue: certificate,
    });

    success(res, sanitizeCertificate(certificate));
  } catch (err) {
    handleRouteError(res, err, '更新证书状态失败');
  }
});

router.get('/supply-requests', async (req, res) => {
  try {
    const requests = await prisma.certificateSupplyRequest.findMany({
      where: tenantWhereForRead(req),
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { id: true, code: true, name: true, type: true } } },
    });
    success(res, requests);
  } catch (err) {
    console.error('Get certificate supply requests error:', err);
    error(res, 'INTERNAL_ERROR', '获取证书申领单失败', 500);
  }
});

router.post('/supply-requests', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), attachmentUpload.single('stampedFile'), async (req, res) => {
  try {
    const result = supplyRequestSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }
    if (!req.file) {
      error(res, 'VALIDATION_ERROR', '上传盖章后的申领单才算正式提交', 400);
      return;
    }

    const quantities = normalizeSupplyQuantities(result.data);
    if (quantities.blankCertQuantity + quantities.shellQuantity <= 0) {
      error(res, 'VALIDATION_ERROR', '空白证书和证书壳申领数量至少填写一项', 400);
      return;
    }
    const responsiblePerson = validateLedgerResponsibility(result.data.responsiblePerson);

    const { request, attachment } = await prisma.$transaction(async (tx) => {
      const created = await tx.certificateSupplyRequest.create({
        data: {
          tenantId: req.tenantId!,
          itemType: quantities.blankCertQuantity > 0 ? 'BLANK_CERT' : 'CERT_SHELL',
          quantity: quantities.blankCertQuantity > 0 ? quantities.blankCertQuantity : quantities.shellQuantity,
          blankCertQuantity: quantities.blankCertQuantity,
          shellQuantity: quantities.shellQuantity,
          responsiblePerson,
          contactName: result.data.contactName,
          contactPhone: result.data.contactPhone,
          mailingAddress: result.data.mailingAddress,
          notes: result.data.notes,
          requestedBy: req.userId,
        },
      });
      const uploaded = await tx.certificateAttachment.create({
        data: buildAttachmentData(req, {
          entityType: 'CertificateSupplyRequest',
          entityId: created.id,
          category: 'STAMPED_SUPPLY_REQUEST',
          file: req.file!,
        }),
      });
      return { request: created, attachment: uploaded };
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_SUPPLY_REQUEST_CREATE',
      target: 'CertificateSupplyRequest',
      targetId: request.id,
      newValue: { request, attachment },
    });

    success(res, { ...request, attachments: [attachment] }, 201);
  } catch (err) {
    handleRouteError(res, err, '提交证书申领失败');
  }
});

router.post('/supply-requests/:id/approve', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  await updateSupplyRequestAction(req, res, 'APPROVED');
});

router.post('/supply-requests/:id/reject', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  await updateSupplyRequestAction(req, res, 'REJECTED');
});

router.post('/supply-requests/:id/dispatch', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  await updateSupplyRequestAction(req, res, 'DISPATCHED');
});

router.post('/supply-requests/:id/receive', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const oldRequest = await prisma.certificateSupplyRequest.findFirst({
      where: certificateTenantScopedWhere(req, id),
    });

    if (!oldRequest) {
      error(res, 'NOT_FOUND', '证书申领单不存在', 404);
      return;
    }
    if (oldRequest.status !== 'DISPATCHED') {
      error(res, 'INVALID_STATUS', '只有已发出的申领单可以确认入库', 400);
      return;
    }

    const request = await prisma.$transaction(async (tx) => {
      const updated = await tx.certificateSupplyRequest.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
          receivedBy: req.userId,
        },
      });
      const blankCertQuantity = oldRequest.blankCertQuantity || (oldRequest.itemType === 'BLANK_CERT' ? oldRequest.quantity : 0);
      const shellQuantity = oldRequest.shellQuantity || (oldRequest.itemType === 'CERT_SHELL' ? oldRequest.quantity : 0);
      if (blankCertQuantity > 0) {
        await createStockMovement(tx, {
          tenantId: oldRequest.tenantId,
          itemType: 'BLANK_CERT',
          movementType: 'SUPPLY_RECEIVED',
          quantity: blankCertQuantity,
          responsiblePerson: oldRequest.responsiblePerson || req.userId || '未记录',
          relatedType: 'CertificateSupplyRequest',
          relatedId: oldRequest.id,
          notes: '申领单确认入库',
          createdBy: req.userId,
        });
      }
      if (shellQuantity > 0) {
        await createStockMovement(tx, {
          tenantId: oldRequest.tenantId,
          itemType: 'CERT_SHELL',
          movementType: 'SUPPLY_RECEIVED',
          quantity: shellQuantity,
          responsiblePerson: oldRequest.responsiblePerson || req.userId || '未记录',
          relatedType: 'CertificateSupplyRequest',
          relatedId: oldRequest.id,
          notes: '申领单确认入库',
          createdBy: req.userId,
        });
      }
      return updated;
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_SUPPLY_RECEIVE',
      target: 'CertificateSupplyRequest',
      targetId: request.id,
      oldValue: oldRequest,
      newValue: request,
    });

    success(res, request);
  } catch (err) {
    handleRouteError(res, err, '确认入库失败');
  }
});

router.get('/stock/balances', async (req, res) => {
  try {
    const tenantIdQuery = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    const tenants = await prisma.tenant.findMany({
      where: canReadCertificateAcrossTenants(req.userRole)
        ? { ...(tenantIdQuery ? { id: tenantIdQuery } : {}), type: 'BRANCH' }
        : { id: req.tenantId! },
      orderBy: { name: 'asc' },
    });

    const balances = [];
    for (const tenant of tenants) {
      const blankCert = await getStockBalance(prisma, tenant.id, 'BLANK_CERT');
      const certShell = await getStockBalance(prisma, tenant.id, 'CERT_SHELL');
      balances.push({
        tenant,
        BLANK_CERT: {
          balance: blankCert.available,
          pendingDestroy: blankCert.pendingDestroy,
          reminder: getLowStockReminder(blankCert.available),
        },
        CERT_SHELL: {
          balance: certShell.available,
          pendingDestroy: certShell.pendingDestroy,
          reminder: getLowStockReminder(certShell.available),
        },
      });
    }

    success(res, balances);
  } catch (err) {
    console.error('Get certificate stock balances error:', err);
    error(res, 'INTERNAL_ERROR', '获取证书库存失败', 500);
  }
});

router.get('/stock/ledger', async (req, res) => {
  try {
    const tenantIdQuery = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    const ledgers = await prisma.certificateStockLedger.findMany({
      where: {
        ...tenantWhereForRead(req),
        ...(canReadCertificateAcrossTenants(req.userRole) && tenantIdQuery ? { tenantId: tenantIdQuery } : {}),
        ...(typeof req.query.itemType === 'string' && req.query.itemType !== 'ALL'
          ? { itemType: req.query.itemType as CertificateItemType }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { tenant: { select: { id: true, code: true, name: true, type: true } } },
    });

    success(res, ledgers);
  } catch (err) {
    console.error('Get certificate stock ledger error:', err);
    error(res, 'INTERNAL_ERROR', '获取证书库存台账失败', 500);
  }
});

router.get('/print-records', async (req, res) => {
  try {
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;
    const records = await prisma.certificatePrintRecord.findMany({
      where: {
        ...tenantWhereForRead(req),
        ...(planId ? { planId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, code: true, name: true, type: true } },
        plan: { select: { id: true, title: true } },
      },
    });
    success(res, records);
  } catch (err) {
    handleRouteError(res, err, '获取打印领用记录失败');
  }
});

router.post('/print-records', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const result = printRecordSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const plan = await prisma.examPlan.findFirst({
      where: { id: result.data.planId, tenantId: req.tenantId! },
      include: { candidates: { include: { score: true } } },
    });
    if (!plan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    const passedCount = plan.candidates.filter((candidate) => isPassed(candidate)).length;
    const printUsage = validatePrintUsage({
      passedCount,
      requestedBlankCount: result.data.blankCertUsed,
      overrideReason: result.data.overrideReason,
    });
    if (printUsage.requiresOverrideReason) {
      error(res, 'OVERRIDE_REASON_REQUIRED', printUsage.warning || '超量领用需登记原因', 400);
      return;
    }
    const settlement = validatePrintRecordSettlement(result.data);
    if (!settlement.ok) {
      error(res, 'VALIDATION_ERROR', settlement.errors.join('；'), 400);
      return;
    }
    const planCertificates = await prisma.certificate.findMany({
      where: {
        candidate: { planId: plan.id, tenantId: req.tenantId! },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, certNo: true, certDisplayIssueDate: true, status: true },
    });

    const selection = validatePrintCertificateSelection({
      actualPrintedCount: result.data.actualPrintedCount,
      certificateIds: result.data.certificateIds,
      eligibleCertificates: planCertificates,
    });
    if (!selection.ok) {
      error(res, 'VALIDATION_ERROR', selection.errors.join('；'), 400);
      return;
    }

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.certificatePrintRecord.create({
        data: {
          tenantId: req.tenantId!,
          planId: plan.id,
          passedCount,
          blankCertUsed: result.data.blankCertUsed,
          shellUsed: result.data.shellUsed,
          blankCertReturned: result.data.blankCertReturned,
          shellReturned: result.data.shellReturned,
          blankCertVoided: result.data.blankCertVoided,
          shellVoided: result.data.shellVoided,
          actualPrintedCount: result.data.actualPrintedCount,
          overrideReason: result.data.overrideReason,
          verificationJson: result.data.verificationItems ? JSON.stringify(result.data.verificationItems) : undefined,
          notes: result.data.notes,
          handledBy: req.userId,
          responsiblePerson: result.data.responsiblePerson,
        },
      });

      await applyPrintStockMovements(tx, req.tenantId!, created.id, result.data, req.userId);
      await createVoidRecordsForPrint(tx, req.tenantId!, plan.id, created.id, result.data, req.userId);
      const printedCertificateIds = result.data.certificateIds;
      if (printedCertificateIds.length > 0) {
        await tx.certificate.updateMany({
          where: { id: { in: printedCertificateIds } },
          data: { status: 'PRINTED', printedAt: new Date(), printBatchNo: created.id },
        });
      }
      return created;
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_PRINT_RECORD_CREATE',
      target: 'CertificatePrintRecord',
      targetId: record.id,
      newValue: record,
    });

    success(res, { ...record, warning: printUsage.warning }, 201);
  } catch (err) {
    handleRouteError(res, err, '保存打印发放记录失败');
  }
});

router.get('/void-records', async (req, res) => {
  try {
    const records = await prisma.certificateVoidRecord.findMany({
      where: tenantWhereForRead(req),
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, code: true, name: true, type: true } },
        plan: { select: { id: true, title: true } },
        certificate: true,
      },
    });
    success(res, records);
  } catch (err) {
    console.error('Get certificate void records error:', err);
    error(res, 'INTERNAL_ERROR', '获取作废记录失败', 500);
  }
});

router.post('/void-records', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const result = voidRecordSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    if (result.data.planId) {
      const plan = await prisma.examPlan.findFirst({ where: { id: result.data.planId, tenantId: req.tenantId! } });
      if (!plan) {
        error(res, 'NOT_FOUND', '计划不存在', 404);
        return;
      }
    }

    if (result.data.certificateId) {
      const cert = await prisma.certificate.findFirst({
        where: { id: result.data.certificateId, candidate: { tenantId: req.tenantId! } },
      });
      if (!cert) {
        error(res, 'NOT_FOUND', '证书不存在', 404);
        return;
      }
    }

    const responsiblePerson = validateLedgerResponsibility(result.data.responsiblePerson);
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.certificateVoidRecord.create({
        data: {
          tenantId: req.tenantId!,
          planId: result.data.planId,
          certificateId: result.data.certificateId,
          itemType: result.data.itemType,
          quantity: result.data.quantity,
          reason: result.data.reason,
          recordedBy: req.userId,
          responsiblePerson,
        },
      });
      await createStockMovement(tx, {
        tenantId: req.tenantId!,
        itemType: result.data.itemType,
        movementType: 'PRINT_USE',
        quantity: -result.data.quantity,
        responsiblePerson,
        relatedType: 'CertificateVoidRecord',
        relatedId: created.id,
        notes: `作废扣减可用库存：${result.data.reason}`,
        createdBy: req.userId,
      });
      await createStockMovement(tx, {
        tenantId: req.tenantId!,
        itemType: result.data.itemType,
        movementType: 'PRINT_VOID',
        quantity: result.data.quantity,
        responsiblePerson,
        relatedType: 'CertificateVoidRecord',
        relatedId: created.id,
        notes: result.data.reason,
        createdBy: req.userId,
      });
      return created;
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_VOID_RECORD_CREATE',
      target: 'CertificateVoidRecord',
      targetId: record.id,
      newValue: record,
    });

    success(res, record, 201);
  } catch (err) {
    handleRouteError(res, err, '登记作废记录失败');
  }
});

router.get('/destroy-batches', async (req, res) => {
  try {
    const batches = await prisma.certificateDestroyBatch.findMany({
      where: canReadCertificateAcrossTenants(req.userRole) ? {} : { tenantId: req.tenantId! },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, code: true, name: true, type: true } },
        voidRecords: { include: { tenant: { select: { id: true, code: true, name: true, type: true } } } },
      },
    });
    success(res, batches);
  } catch (err) {
    console.error('Get destroy batches error:', err);
    error(res, 'INTERNAL_ERROR', '获取销毁批次失败', 500);
  }
});

router.post('/destroy-batches', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  try {
    const result = destroyBatchSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.certificateDestroyBatch.create({
        data: {
          tenantId: req.tenantId!,
          title: result.data.title,
          responsiblePerson: result.data.responsiblePerson,
          notes: result.data.notes,
          createdBy: req.userId,
        },
      });

      if (result.data.voidRecordIds.length > 0) {
        await tx.certificateVoidRecord.updateMany({
          where: {
            id: { in: result.data.voidRecordIds },
            status: 'PENDING_DESTROY',
          },
          data: { destroyBatchId: created.id },
        });
      }

      return created;
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_DESTROY_BATCH_CREATE',
      target: 'CertificateDestroyBatch',
      targetId: batch.id,
      newValue: { ...batch, voidRecordIds: result.data.voidRecordIds },
    });

    success(res, batch, 201);
  } catch (err) {
    handleRouteError(res, err, '创建销毁批次失败');
  }
});

router.post('/destroy-batches/:id/close', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const oldBatch = await prisma.certificateDestroyBatch.findFirst({
      where: { id },
      include: { voidRecords: true },
    });

    if (!oldBatch) {
      error(res, 'NOT_FOUND', '销毁批次不存在', 404);
      return;
    }
    if (oldBatch.status === 'CLOSED') {
      error(res, 'ALREADY_CLOSED', '销毁批次已关闭', 400);
      return;
    }

    const batch = await prisma.$transaction(async (tx) => {
      for (const record of oldBatch.voidRecords) {
        await createStockMovement(tx, {
          tenantId: record.tenantId,
          itemType: record.itemType,
          movementType: 'DESTROY',
          quantity: -record.quantity,
          responsiblePerson: oldBatch.responsiblePerson || req.userId || '未记录',
          relatedType: 'CertificateDestroyBatch',
          relatedId: id,
          notes: oldBatch.title,
          createdBy: req.userId,
        });
      }
      await tx.certificateVoidRecord.updateMany({
        where: { destroyBatchId: id },
        data: { status: 'DESTROYED' },
      });

      return tx.certificateDestroyBatch.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: req.userId,
        },
        include: { voidRecords: true },
      });
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_DESTROY_BATCH_CLOSE',
      target: 'CertificateDestroyBatch',
      targetId: batch.id,
      oldValue: oldBatch,
      newValue: batch,
    });

    success(res, batch);
  } catch (err) {
    handleRouteError(res, err, '关闭销毁批次失败');
  }
});

router.get('/reissue-requests', async (req, res) => {
  try {
    const requests = await prisma.certificateReissueRequest.findMany({
      where: tenantWhereForRead(req),
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, code: true, name: true, type: true } },
        plan: { select: { id: true, title: true } },
        candidate: { select: { id: true, name: true } },
        certificate: true,
      },
    });
    success(res, requests);
  } catch (err) {
    console.error('Get reissue requests error:', err);
    error(res, 'INTERNAL_ERROR', '获取补办申请失败', 500);
  }
});

router.post('/reissue-requests', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const result = reissueRequestSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const calendar = await getWorkdayCalendarConfig(req.tenantId!);
    const request = await prisma.certificateReissueRequest.create({
      data: {
        tenantId: req.tenantId!,
        planId: result.data.planId,
        candidateId: result.data.candidateId,
        certificateId: result.data.certificateId,
        applicantName: result.data.applicantName,
        applicantPhone: result.data.applicantPhone,
        applicantIdCard: result.data.applicantIdCard,
        certNo: result.data.certNo,
        reason: result.data.reason,
        mailingAddress: result.data.mailingAddress,
        responsiblePerson: result.data.responsiblePerson,
        feeCents: result.data.feeCents,
        mailingFeeCents: result.data.mailingFeeCents,
        reviewDueAt: addWorkDaysWithCalendar(new Date(), 15, calendar),
      },
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_REISSUE_CREATE',
      target: 'CertificateReissueRequest',
      targetId: request.id,
      newValue: request,
    });

    success(res, request, 201);
  } catch (err) {
    handleRouteError(res, err, '提交补办申请失败');
  }
});

router.post('/reissue-requests/:id/review', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = reissueReviewSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldRequest = await prisma.certificateReissueRequest.findFirst({
      where: { id, tenantId: req.tenantId! },
    });
    if (!oldRequest) {
      error(res, 'NOT_FOUND', '补办申请不存在', 404);
      return;
    }

    const calendar = await getWorkdayCalendarConfig(req.tenantId!);
    const request = await prisma.certificateReissueRequest.update({
      where: { id },
      data: {
        status: result.data.approved ? 'APPROVED' : 'REJECTED',
        reviewNotes: result.data.reviewNotes,
        reviewedBy: req.userId,
        reviewedAt: new Date(),
        remakeDueAt: result.data.approved ? addWorkDaysWithCalendar(new Date(), 10, calendar) : null,
      },
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_REISSUE_REVIEW',
      target: 'CertificateReissueRequest',
      targetId: request.id,
      oldValue: oldRequest,
      newValue: request,
    });

    success(res, request);
  } catch (err) {
    handleRouteError(res, err, '审核补办申请失败');
  }
});

router.post('/reissue-requests/:id/issue', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = reissueIssueSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldRequest = await prisma.certificateReissueRequest.findFirst({
      where: { id, tenantId: req.tenantId! },
    });
    if (!oldRequest) {
      error(res, 'NOT_FOUND', '补办申请不存在', 404);
      return;
    }
    if (oldRequest.status !== 'APPROVED') {
      error(res, 'INVALID_STATUS', '只有审核通过的补办申请可以发放', 400);
      return;
    }

    const request = await prisma.$transaction(async (tx) => {
      const responsiblePerson = result.data.responsiblePerson || oldRequest.responsiblePerson || req.userId || '未记录';
      await createStockMovement(tx, {
        tenantId: req.tenantId!,
        itemType: 'BLANK_CERT',
        movementType: 'REISSUE_USE',
        quantity: -1,
        responsiblePerson,
        relatedType: 'CertificateReissueRequest',
        relatedId: oldRequest.id,
        notes: result.data.notes || '补办证书领用',
        createdBy: req.userId,
      });
      await createStockMovement(tx, {
        tenantId: req.tenantId!,
        itemType: 'CERT_SHELL',
        movementType: 'REISSUE_USE',
        quantity: -1,
        responsiblePerson,
        relatedType: 'CertificateReissueRequest',
        relatedId: oldRequest.id,
        notes: result.data.notes || '补办证书壳领用',
        createdBy: req.userId,
      });

      return tx.certificateReissueRequest.update({
        where: { id },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
          issuedBy: req.userId,
          responsiblePerson,
          mailingAddress: result.data.mailingAddress || oldRequest.mailingAddress,
        },
      });
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_REISSUE_ISSUE',
      target: 'CertificateReissueRequest',
      targetId: request.id,
      oldValue: oldRequest,
      newValue: request,
    });

    success(res, request);
  } catch (err) {
    handleRouteError(res, err, '发放补办证书失败');
  }
});

router.get('/stocktakes', async (req, res) => {
  try {
    const records = await prisma.certificateStocktake.findMany({
      where: tenantWhereForRead(req),
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { id: true, code: true, name: true, type: true } } },
    });
    success(res, records);
  } catch (err) {
    console.error('Get certificate stocktakes error:', err);
    error(res, 'INTERNAL_ERROR', '获取盘点记录失败', 500);
  }
});

router.post('/stocktakes', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const result = stocktakeSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const record = await prisma.$transaction(async (tx) => {
      const bookBalance = (await getStockBalance(tx, req.tenantId!, result.data.itemType)).available;
      const variance = result.data.actualQuantity - bookBalance;
      const responsiblePerson = validateLedgerResponsibility(result.data.responsiblePerson);
      const created = await tx.certificateStocktake.create({
        data: {
          tenantId: req.tenantId!,
          itemType: result.data.itemType,
          stocktakeType: result.data.stocktakeType,
          bookBalance,
          actualQuantity: result.data.actualQuantity,
          variance,
          notes: result.data.notes,
          handledBy: req.userId,
          responsiblePerson,
        },
      });
      if (variance !== 0) {
        await createStockMovement(tx, {
          tenantId: req.tenantId!,
          itemType: result.data.itemType,
          movementType: 'STOCKTAKE_ADJUST',
          quantity: variance,
          responsiblePerson,
          relatedType: 'CertificateStocktake',
          relatedId: created.id,
          notes: result.data.notes || '盘点差异调整',
          createdBy: req.userId,
        });
      }
      return created;
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_STOCKTAKE_CREATE',
      target: 'CertificateStocktake',
      targetId: record.id,
      newValue: record,
    });

    success(res, record, 201);
  } catch (err) {
    handleRouteError(res, err, '保存盘点记录失败');
  }
});

router.post('/attachments', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), attachmentUpload.single('file'), async (req, res) => {
  try {
    const result = attachmentSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }
    if (!req.file) {
      error(res, 'VALIDATION_ERROR', '缺少附件文件', 400);
      return;
    }

    const attachment = await prisma.certificateAttachment.create({
      data: buildAttachmentData(req, {
        entityType: result.data.entityType,
        entityId: result.data.entityId,
        category: result.data.category,
        file: req.file,
      }),
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_ATTACHMENT_UPLOAD',
      target: 'CertificateAttachment',
      targetId: attachment.id,
      newValue: attachment,
    });

    success(res, attachment, 201);
  } catch (err) {
    handleRouteError(res, err, '上传证书附件失败');
  }
});

router.get('/attachments', async (req, res) => {
  try {
    const entityType = normalizeText(req.query.entityType);
    const entityId = normalizeText(req.query.entityId);
    if (!entityType || !entityId) {
      error(res, 'VALIDATION_ERROR', '缺少附件业务对象', 400);
      return;
    }
    const attachments = await prisma.certificateAttachment.findMany({
      where: { ...tenantWhereForRead(req), entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
    success(res, attachments);
  } catch (err) {
    handleRouteError(res, err, '获取证书附件失败');
  }
});

router.get('/attachments/:id/download', async (req, res) => {
  try {
    const attachment = await prisma.certificateAttachment.findFirst({
      where: { id: String(req.params.id), ...tenantWhereForRead(req) },
    });
    if (!attachment) {
      error(res, 'NOT_FOUND', '附件不存在', 404);
      return;
    }
    const filename = path.basename(attachment.filePath);
    res.download(path.join(certificateUploadDir, filename), attachment.originalName);
  } catch (err) {
    handleRouteError(res, err, '下载证书附件失败');
  }
});

router.get('/exports/supply-request-template.pdf', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst({ where: req.userRole === 'SYS_ADMIN' ? { id: req.tenantId! } : { id: req.tenantId! } });
    if (!tenant) {
      error(res, 'NOT_FOUND', '机构不存在', 404);
      return;
    }
    const request = {
      tenant,
      blankCertQuantity: Number(req.query.blankCertQuantity || 0),
      shellQuantity: Number(req.query.shellQuantity || 0),
      responsiblePerson: normalizeText(req.query.responsiblePerson),
      contactName: normalizeText(req.query.contactName),
      contactPhone: normalizeText(req.query.contactPhone),
      mailingAddress: normalizeText(req.query.mailingAddress),
      notes: normalizeText(req.query.notes),
      requestedAt: new Date(),
    };
    sendPdf(res, `空白证书证书壳申请表.pdf`, (doc) => renderSupplyRequestPdf(doc, request));
  } catch (err) {
    handleRouteError(res, err, '生成申领 PDF 失败');
  }
});

router.get('/exports/supply-request/:id.pdf', async (req, res) => {
  try {
    const id = String(req.params.id);
    const request = await prisma.certificateSupplyRequest.findFirst({
      where: certificateTenantScopedWhere(req, id),
      include: { tenant: true },
    });
    if (!request) {
      error(res, 'NOT_FOUND', '证书申领单不存在', 404);
      return;
    }

    sendPdf(res, `证书申领单-${request.id}.pdf`, (doc) => renderSupplyRequestPdf(doc, request));
  } catch (err) {
    console.error('Export supply request error:', err);
    error(res, 'INTERNAL_ERROR', '导出证书申领单失败', 500);
  }
});

router.get('/exports/certificate-import-template.xlsx', async (_req, res) => {
  const workbook = XLSX.utils.book_new();
  const rows = [
    { 姓名: '张三', 证件号码: '110101199001010011', 证书编号: 'S0000000001', 证书版面发证日期: '2026-05-10' },
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '证书编号导入模板');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', encodeContentDisposition('证书编号导入模板.xlsx'));
  res.send(buffer);
});

router.get('/exports/reissue-request/:id.doc', async (req, res) => {
  try {
    const id = String(req.params.id);
    const request = await prisma.certificateReissueRequest.findFirst({
      where: certificateTenantScopedWhere(req, id),
      include: { tenant: true, plan: true, candidate: true },
    });
    if (!request) {
      error(res, 'NOT_FOUND', '补办申请不存在', 404);
      return;
    }

    sendWordHtml(res, `补办申请-${request.id}.doc`, renderReissueRequestDoc(request));
  } catch (err) {
    console.error('Export reissue request error:', err);
    error(res, 'INTERNAL_ERROR', '导出补办申请失败', 500);
  }
});

router.get('/exports/ledger.xlsx', async (req, res) => {
  try {
    const tenantIdQuery = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    const ledgers = await prisma.certificateStockLedger.findMany({
      where: {
        ...tenantWhereForRead(req),
        ...(canReadCertificateAcrossTenants(req.userRole) && tenantIdQuery ? { tenantId: tenantIdQuery } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { tenant: true },
    });

    const rows = ledgers.map((row) => ({
      机构: row.tenant.name,
      物品: itemTypeLabel(row.itemType),
      流水类型: row.movementType,
      数量: row.quantity,
      可用结余: row.availableBalanceAfter || row.balanceAfter,
      待销毁: row.pendingDestroyBalanceAfter,
      责任人: row.responsiblePerson,
      操作人: row.createdBy || '',
      关联对象: row.relatedType || '',
      备注: row.notes || '',
      时间: row.createdAt.toISOString(),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '证书库存台账');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', encodeContentDisposition('证书库存台账.xlsx'));
    res.send(buffer);
  } catch (err) {
    console.error('Export stock ledger error:', err);
    error(res, 'INTERNAL_ERROR', '导出证书库存台账失败', 500);
  }
});

router.get('/exports/delivery.xlsx', async (req, res) => {
  try {
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;
    const certificates = await prisma.certificate.findMany({
      where: {
        ...(planId ? { candidate: { planId, ...tenantWhereForRead(req) } } : { candidate: tenantWhereForRead(req) }),
        status: 'ISSUED',
      },
      orderBy: { issuedAt: 'asc' },
      include: certificateInclude(),
    });
    const rows = certificates.map((certificate) => ({
      姓名: certificate.candidate.name,
      证件类型: '居民身份证',
      证件号码: safeDecrypt(certificate.candidate.idCard),
      职业: certificate.candidate.plan.occupation,
      职业工种名称: certificate.candidate.plan.profession,
      认定等级: certificate.candidate.plan.level,
      证书编号: certificate.certNo,
      发证日期: formatDateOnly(certificate.certDisplayIssueDate),
      实际发放时间: certificate.issuedAt ? certificate.issuedAt.toISOString() : '',
      领取方式: certificate.deliveryMethod || '',
      领取人: certificate.receiverName || '',
      联系电话: certificate.receiverPhone || '',
      邮寄地址: certificate.mailingAddress || '',
      快递单号: certificate.trackingNo || '',
      备注: certificate.issueNotes || '',
    }));
    sendWorkbook(res, '证书发放清单.xlsx', '证书发放清单', rows);
  } catch (err) {
    handleRouteError(res, err, '导出证书发放清单失败');
  }
});

router.get('/exports/print-record/:id/signature.pdf', async (req, res) => {
  try {
    const record = await prisma.certificatePrintRecord.findFirst({
      where: { id: String(req.params.id), ...tenantWhereForRead(req) },
      include: { tenant: true, plan: true },
    });
    if (!record) {
      error(res, 'NOT_FOUND', '打印记录不存在', 404);
      return;
    }
    const certificates = await prisma.certificate.findMany({
      where: { printBatchNo: record.id, candidate: tenantWhereForRead(req) },
      orderBy: { updatedAt: 'asc' },
      include: certificateInclude(),
    });
    sendPdf(res, `证书领取签字表-${record.id}.pdf`, (doc) => renderPrintSignaturePdf(doc, record, certificates));
  } catch (err) {
    handleRouteError(res, err, '生成证书领取签字表失败');
  }
});

router.get('/exports/print-record/:id/certificates.pdf', async (req, res) => {
  try {
    const record = await prisma.certificatePrintRecord.findFirst({
      where: { id: String(req.params.id), ...tenantWhereForRead(req) },
      include: { tenant: true, plan: true },
    });
    if (!record) {
      error(res, 'NOT_FOUND', '打印记录不存在', 404);
      return;
    }
    const certificates = await prisma.certificate.findMany({
      where: { printBatchNo: record.id, candidate: tenantWhereForRead(req) },
      orderBy: { updatedAt: 'asc' },
      include: certificateInclude(),
    });
    const calibration = parseCertificatePrintCalibration(req);
    sendPdf(
      res,
      `证书套打-${record.id}.pdf`,
      (doc) => renderCertificatePrintPdf(doc, certificates, calibration),
      { layout: 'landscape', margin: 0 },
    );
  } catch (err) {
    handleRouteError(res, err, '生成证书套打 PDF 失败');
  }
});

router.get('/exports/certificate-print-trial.pdf', async (req, res) => {
  try {
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;
    const certificateId = typeof req.query.certificateId === 'string' ? req.query.certificateId : undefined;
    if (!planId) {
      error(res, 'VALIDATION_ERROR', '缺少计划ID', 400);
      return;
    }
    const certificate = await prisma.certificate.findFirst({
      where: {
        ...(certificateId ? { id: certificateId } : {}),
        certNo: { not: '' },
        certDisplayIssueDate: { not: null },
        candidate: { planId, ...tenantWhereForRead(req) },
      },
      orderBy: { createdAt: 'asc' },
      include: certificateInclude(),
    });
    if (!certificate) {
      error(res, 'NOT_FOUND', '当前计划没有可用于试打的完整证书记录', 404);
      return;
    }
    const calibration = parseCertificatePrintCalibration(req);
    sendPdf(
      res,
      `证书套打试打-${certificate.candidate.name}.pdf`,
      (doc) => renderCertificatePrintPdf(doc, [certificate], calibration),
      { layout: 'landscape', margin: 0 },
    );
  } catch (err) {
    handleRouteError(res, err, '生成证书套打试打 PDF 失败');
  }
});

router.get('/exports/destroy-batch/:id.pdf', async (req, res) => {
  try {
    const batch = await prisma.certificateDestroyBatch.findFirst({
      where: canReadCertificateAcrossTenants(req.userRole) ? { id: String(req.params.id) } : { id: String(req.params.id), tenantId: req.tenantId! },
      include: {
        tenant: true,
        voidRecords: { include: { tenant: true, plan: { select: { title: true } } } },
      },
    });
    if (!batch) {
      error(res, 'NOT_FOUND', '销毁批次不存在', 404);
      return;
    }
    sendPdf(res, `证书销毁登记表-${batch.id}.pdf`, (doc) => renderDestroyBatchPdf(doc, batch));
  } catch (err) {
    handleRouteError(res, err, '生成销毁登记表失败');
  }
});

router.get('/exports/stocktakes.xlsx', async (req, res) => {
  try {
    const tenantIdQuery = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    const records = await prisma.certificateStocktake.findMany({
      where: {
        ...tenantWhereForRead(req),
        ...(canReadCertificateAcrossTenants(req.userRole) && tenantIdQuery ? { tenantId: tenantIdQuery } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { tenant: true },
    });
    const rows = records.map((record) => ({
      机构: record.tenant.name,
      物品: itemTypeLabel(record.itemType),
      盘点类型: record.stocktakeType,
      账面数量: record.bookBalance,
      实盘数量: record.actualQuantity,
      差异: record.variance,
      责任人: record.responsiblePerson,
      操作人: record.handledBy || '',
      备注: record.notes || '',
      时间: record.createdAt.toISOString(),
    }));
    sendWorkbook(res, '证书盘点记录.xlsx', '证书盘点记录', rows);
  } catch (err) {
    handleRouteError(res, err, '导出盘点记录失败');
  }
});

router.post('/plans/:id/complete-node', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const planId = String(req.params.id);
    const notes = normalizeText(req.body?.notes) || '证书管理模块确认完成';
    const plan = await prisma.examPlan.findFirst({
      where: { id: planId, tenantId: req.tenantId! },
      include: { nodes: { orderBy: { createdAt: 'asc' } } },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }
    if (plan.status !== 'PUBLISHED') {
      error(res, 'PLAN_NOT_PUBLISHED', '计划发布后才能完成证书管理节点', 400);
      return;
    }

    const certNode = plan.nodes.find((node) => node.nodeType === 'CERT_MANAGE');
    if (!certNode) {
      error(res, 'CERT_NODE_MISSING', '未找到证书管理节点', 400);
      return;
    }
    if (certNode.status === 'COMPLETED') {
      error(res, 'ALREADY_COMPLETED', '证书管理节点已完成', 400);
      return;
    }
    if (certNode.status !== 'IN_PROGRESS') {
      error(res, 'NODE_NOT_CURRENT', '只能按顺序完成当前进行中的节点', 400);
      return;
    }

    const certNodeIndex = plan.nodes.findIndex((node) => node.id === certNode.id);
    const hasIncompletePrevious = plan.nodes.slice(0, certNodeIndex).some((node) => node.status !== 'COMPLETED');
    if (hasIncompletePrevious) {
      error(res, 'NODE_SEQUENCE_REQUIRED', '前置节点未完成，不能跳过流程', 400);
      return;
    }

    const writeResult = await prisma.$transaction(async (tx) => {
      const completed = await tx.examNode.update({
        where: { id: certNode.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes,
        },
      });

      const nextNode = plan.nodes
        .filter((node) => node.status === 'PENDING' && nodeOrder(node.nodeType) > nodeOrder('CERT_MANAGE'))
        .sort((a, b) => nodeOrder(a.nodeType) - nodeOrder(b.nodeType))[0];

      const activatedNextNode = nextNode
        ? await tx.examNode.update({ where: { id: nextNode.id }, data: { status: 'IN_PROGRESS' } })
        : null;

      return { completed, activatedNextNode };
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_NODE_COMPLETE',
      target: 'ExamNode',
      targetId: writeResult.completed.id,
      examNodeId: writeResult.completed.id,
      newValue: writeResult,
    });

    success(res, writeResult);
  } catch (err) {
    handleRouteError(res, err, '完成证书管理节点失败');
  }
});

async function updateSupplyRequestAction(req: Request, res: Response, status: 'APPROVED' | 'REJECTED' | 'DISPATCHED'): Promise<void> {
  try {
    const id = String(req.params.id);
    const result = supplyActionSchema.safeParse(req.body || {});
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldRequest = await prisma.certificateSupplyRequest.findFirst({ where: { id } });
    if (!oldRequest) {
      error(res, 'NOT_FOUND', '证书申领单不存在', 404);
      return;
    }

    if (status === 'APPROVED' && oldRequest.status !== 'PENDING') {
      error(res, 'INVALID_STATUS', '只有待审批申领单可以审批通过', 400);
      return;
    }
    if (status === 'REJECTED' && oldRequest.status !== 'PENDING') {
      error(res, 'INVALID_STATUS', '只有待审批申领单可以驳回', 400);
      return;
    }
    if (status === 'DISPATCHED' && oldRequest.status !== 'APPROVED') {
      error(res, 'INVALID_STATUS', '只有已审批申领单可以登记发出', 400);
      return;
    }

    const request = await prisma.certificateSupplyRequest.update({
      where: { id },
      data: {
        status,
        notes: result.data.notes ?? oldRequest.notes,
        rejectReason: status === 'REJECTED' ? result.data.rejectReason : oldRequest.rejectReason,
        approvedAt: status === 'APPROVED' ? new Date() : oldRequest.approvedAt,
        approvedBy: status === 'APPROVED' ? req.userId : oldRequest.approvedBy,
        dispatchedAt: status === 'DISPATCHED' ? new Date() : oldRequest.dispatchedAt,
        dispatchedBy: status === 'DISPATCHED' ? req.userId : oldRequest.dispatchedBy,
      },
    });

    await recordAudit(req, {
      action: `CERTIFICATE_SUPPLY_${status}`,
      target: 'CertificateSupplyRequest',
      targetId: request.id,
      oldValue: oldRequest,
      newValue: request,
    });

    success(res, request);
  } catch (err) {
    handleRouteError(res, err, '更新证书申领单失败');
  }
}

async function upsertCertificateRecord(
  req: Request,
  input: { candidateId: string; certNo: string; certDisplayIssueDate: string; certNoSource: CertNoSource }
) {
  const candidate = await prisma.candidate.findFirst({
    where: req.userRole === 'SYS_ADMIN'
      ? { id: input.candidateId }
      : { id: input.candidateId, tenantId: req.tenantId! },
    include: {
      score: true,
      certificate: true,
      plan: { select: { id: true, title: true, profession: true, level: true } },
    },
  });

  if (!candidate) {
    throw new RouteError('NOT_FOUND', '考生不存在', 404);
  }

  await assertCertNoUsable({
    certNo: input.certNo,
    currentCertificateId: candidate.certificate?.id,
    candidateStatus: candidate.status,
    scoreIsPass: candidate.score?.isPass || false,
  });

  return prisma.certificate.upsert({
    where: { candidateId: candidate.id },
    update: {
      certNo: input.certNo,
      certDisplayIssueDate: requireCertificateDisplayDate(input.certDisplayIssueDate),
      certNoSource: input.certNoSource,
    },
    create: {
      candidateId: candidate.id,
      certNo: input.certNo,
      certDisplayIssueDate: requireCertificateDisplayDate(input.certDisplayIssueDate),
      certNoSource: input.certNoSource,
      status: 'PENDING',
    },
    include: certificateInclude(),
  });
}

async function assertCertNoUsable(input: {
  certNo: string;
  currentCertificateId?: string;
  candidateStatus?: string | null;
  scoreIsPass?: boolean | null;
}): Promise<void> {
  const existing = await prisma.certificate.findFirst({
    where: {
      certNo: input.certNo,
      ...(input.currentCertificateId ? { id: { not: input.currentCertificateId } } : {}),
    },
    select: { certNo: true },
  });

  const result = validateCertificateAssignment({
    candidateStatus: input.candidateStatus,
    scoreIsPass: input.scoreIsPass,
    certNo: input.certNo,
    existingCertNos: new Set(existing ? [existing.certNo] : []),
  });

  if (!result.ok) {
    throw new RouteError('VALIDATION_ERROR', result.errors.join('；'), 400);
  }
}

async function buildImportPreviewForPlan(req: Request, planId: string, rows: CertificateImportRow[]) {
  const plan = await prisma.examPlan.findFirst({
    where: {
      id: planId,
      ...(req.userRole === 'SYS_ADMIN' ? {} : planTenantWhereForRead(req)),
    },
    select: { id: true },
  });

  if (!plan) {
    throw new RouteError('NOT_FOUND', '计划不存在', 404);
  }

  const candidates = await prisma.candidate.findMany({
    where: { planId },
    include: {
      score: true,
      certificate: true,
    },
  });

  const importCandidates: CertificateImportCandidate[] = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    idCard: safeDecrypt(candidate.idCard),
    status: candidate.status,
    scoreIsPass: candidate.score?.isPass || false,
  }));

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const existingCertNos = await prisma.certificate.findMany({
    where: { candidateId: { notIn: Array.from(candidateIds) } },
    select: { certNo: true },
  });

  return buildCertificateImportPreview({
    rows,
    candidates: importCandidates,
    existingCertNos: new Set(existingCertNos.map((certificate) => certificate.certNo)),
  });
}

function parseCertificateImportRows(buffer: Buffer): CertificateImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', blankrows: false, raw: false, dateNF: 'yyyy-mm-dd' });
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    name: pickCell(row, ['姓名', '考生姓名', 'name']),
    idCard: pickCell(row, ['证件号码', '身份证号', '身份证号码', 'idCard']),
    certNo: pickCell(row, ['证书编号', '证书号码', 'certNo']),
    certDisplayIssueDate: pickCell(row, ['证书版面发证日期', '发证日期', 'certDisplayIssueDate']),
  })).filter((row) => row.name || row.idCard || row.certNo || row.certDisplayIssueDate);
}

function pickCell(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && normalizeText(row[key])) return normalizeText(row[key]);
  }
  return '';
}

async function findCertificateForMutation(req: Request, id: string) {
  return prisma.certificate.findFirst({
    where: req.userRole === 'SYS_ADMIN' ? { id } : { id, candidate: { tenantId: req.tenantId! } },
    include: certificateInclude(),
  });
}

function certificateInclude() {
  return {
    candidate: {
      include: {
        plan: {
          select: { id: true, title: true, examDate: true, occupation: true, profession: true, level: true },
        },
        score: true,
      },
    },
  } satisfies Prisma.CertificateInclude;
}

function sanitizeCertificate<T extends { candidate?: { idCard?: string | null } | null }>(certificate: T): T {
  if (certificate.candidate?.idCard) {
    return {
      ...certificate,
      candidate: {
        ...certificate.candidate,
        idCard: safeDecrypt(certificate.candidate.idCard),
      },
    };
  }
  return certificate;
}

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

function requireCertificateDisplayDate(value: string): Date {
  const date = parseCertificateDisplayDate(value);
  if (!date) {
    throw new RouteError('VALIDATION_ERROR', '证书版面发证日期格式应为 YYYY-MM-DD', 400);
  }
  return date;
}

function assertCertificateReadyForDelivery(certificate: { status: string; printedAt?: Date | null; certDisplayIssueDate?: Date | null }): void {
  if (certificate.status !== 'PRINTED' || !certificate.printedAt) {
    throw new RouteError('PRINT_SETTLEMENT_REQUIRED', '证书打印结算后才能发放', 400);
  }
  if (!certificate.certDisplayIssueDate) {
    throw new RouteError('CERT_DISPLAY_DATE_REQUIRED', '证书版面发证日期缺失，不能发放', 400);
  }
}

function isPassed(candidate: { status: string; score?: { isPass: boolean } | null }): boolean {
  return candidate.status === 'PASSED' || candidate.score?.isPass === true;
}

function certificateTenantScopedWhere(req: Request, id: string): { id: string; tenantId?: string } {
  return canReadCertificateAcrossTenants(req.userRole) ? { id } : { id, tenantId: req.tenantId! };
}

async function applyPrintStockMovements(
  tx: Prisma.TransactionClient,
  tenantId: string,
  recordId: string,
  data: z.infer<typeof printRecordSchema>,
  userId?: string
): Promise<void> {
  if (data.blankCertUsed > 0) {
    await createStockMovement(tx, {
      tenantId,
      itemType: 'BLANK_CERT',
      movementType: 'PRINT_USE',
      quantity: -data.blankCertUsed,
      responsiblePerson: data.responsiblePerson,
      relatedType: 'CertificatePrintRecord',
      relatedId: recordId,
      notes: '打印领用空白证书',
      createdBy: userId,
    });
  }
  if (data.shellUsed > 0) {
    await createStockMovement(tx, {
      tenantId,
      itemType: 'CERT_SHELL',
      movementType: 'PRINT_USE',
      quantity: -data.shellUsed,
      responsiblePerson: data.responsiblePerson,
      relatedType: 'CertificatePrintRecord',
      relatedId: recordId,
      notes: '打印领用证书壳',
      createdBy: userId,
    });
  }
  if (data.blankCertReturned > 0) {
    await createStockMovement(tx, {
      tenantId,
      itemType: 'BLANK_CERT',
      movementType: 'PRINT_RETURN',
      quantity: data.blankCertReturned,
      responsiblePerson: data.responsiblePerson,
      relatedType: 'CertificatePrintRecord',
      relatedId: recordId,
      notes: '未用空白证书退回',
      createdBy: userId,
    });
  }
  if (data.shellReturned > 0) {
    await createStockMovement(tx, {
      tenantId,
      itemType: 'CERT_SHELL',
      movementType: 'PRINT_RETURN',
      quantity: data.shellReturned,
      responsiblePerson: data.responsiblePerson,
      relatedType: 'CertificatePrintRecord',
      relatedId: recordId,
      notes: '未用证书壳退回',
      createdBy: userId,
    });
  }
}

async function createVoidRecordsForPrint(
  tx: Prisma.TransactionClient,
  tenantId: string,
  planId: string,
  recordId: string,
  data: z.infer<typeof printRecordSchema>,
  userId?: string
): Promise<void> {
  if (data.blankCertVoided > 0) {
    const record = await tx.certificateVoidRecord.create({
      data: {
        tenantId,
        planId,
        itemType: 'BLANK_CERT',
        quantity: data.blankCertVoided,
        reason: `打印记录 ${recordId} 登记作废`,
        recordedBy: userId,
        responsiblePerson: data.responsiblePerson,
      },
    });
    await createStockMovement(tx, {
      tenantId,
      itemType: 'BLANK_CERT',
      movementType: 'PRINT_VOID',
      quantity: data.blankCertVoided,
      responsiblePerson: data.responsiblePerson,
      relatedType: 'CertificateVoidRecord',
      relatedId: record.id,
      notes: `打印记录 ${recordId} 登记作废`,
      createdBy: userId,
    });
  }
  if (data.shellVoided > 0) {
    const record = await tx.certificateVoidRecord.create({
      data: {
        tenantId,
        planId,
        itemType: 'CERT_SHELL',
        quantity: data.shellVoided,
        reason: `打印记录 ${recordId} 登记作废`,
        recordedBy: userId,
        responsiblePerson: data.responsiblePerson,
      },
    });
    await createStockMovement(tx, {
      tenantId,
      itemType: 'CERT_SHELL',
      movementType: 'PRINT_VOID',
      quantity: data.shellVoided,
      responsiblePerson: data.responsiblePerson,
      relatedType: 'CertificateVoidRecord',
      relatedId: record.id,
      notes: `打印记录 ${recordId} 登记作废`,
      createdBy: userId,
    });
  }
}

async function createStockMovement(
  client: Prisma.TransactionClient,
  input: {
    tenantId: string;
    itemType: CertificateItemType;
    movementType: CertificateStockMovementType;
    quantity: number;
    responsiblePerson: string;
    relatedType?: string;
    relatedId?: string;
    notes?: string;
    createdBy?: string;
  }
) {
  const currentBalance = await getStockBalance(client, input.tenantId, input.itemType);
  const responsiblePerson = validateLedgerResponsibility(input.responsiblePerson);
  const nextBalance = nextStockBalance(currentBalance, input.movementType, input.quantity);
  if (nextBalance.available < 0) {
    throw new RouteError('INSUFFICIENT_STOCK', `${itemTypeLabel(input.itemType)}库存不足`, 400);
  }
  if (nextBalance.pendingDestroy < 0) {
    throw new RouteError('INSUFFICIENT_PENDING_DESTROY', `${itemTypeLabel(input.itemType)}待销毁数量不足`, 400);
  }

  return client.certificateStockLedger.create({
    data: {
      tenantId: input.tenantId,
      itemType: input.itemType,
      movementType: input.movementType,
      quantity: input.quantity,
      balanceAfter: nextBalance.available,
      availableBalanceAfter: nextBalance.available,
      pendingDestroyBalanceAfter: nextBalance.pendingDestroy,
      responsiblePerson,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      notes: input.notes,
      createdBy: input.createdBy,
    },
  });
}

async function getStockBalance(
  client: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  itemType: CertificateItemType
): Promise<{ available: number; pendingDestroy: number }> {
  const last = await client.certificateStockLedger.findFirst({
    where: { tenantId, itemType },
    orderBy: { createdAt: 'desc' },
  });
  if (last) {
    return {
      available: last.availableBalanceAfter || last.balanceAfter || 0,
      pendingDestroy: last.pendingDestroyBalanceAfter || 0,
    };
  }
  const movements = await client.certificateStockLedger.findMany({
    where: { tenantId, itemType },
    orderBy: { createdAt: 'asc' },
    select: { movementType: true, quantity: true },
  });
  return computeStockBalance(movements);
}

function nextStockBalance(
  current: { available: number; pendingDestroy: number },
  movementType: CertificateStockMovementType,
  quantity: number
): { available: number; pendingDestroy: number } {
  if (movementType === 'PRINT_VOID') {
    return { available: current.available, pendingDestroy: current.pendingDestroy + quantity };
  }
  if (movementType === 'DESTROY') {
    return { available: current.available, pendingDestroy: current.pendingDestroy + quantity };
  }
  return { available: current.available + quantity, pendingDestroy: current.pendingDestroy };
}

function normalizeSupplyQuantities(data: z.infer<typeof supplyRequestSchema>): { blankCertQuantity: number; shellQuantity: number } {
  if (data.quantity && data.itemType) {
    return {
      blankCertQuantity: data.itemType === 'BLANK_CERT' ? data.quantity : data.blankCertQuantity,
      shellQuantity: data.itemType === 'CERT_SHELL' ? data.quantity : data.shellQuantity,
    };
  }
  return {
    blankCertQuantity: data.blankCertQuantity,
    shellQuantity: data.shellQuantity,
  };
}

function buildAttachmentData(req: Request, input: {
  entityType: string;
  entityId: string;
  category: string;
  file: Express.Multer.File;
}) {
  return {
    tenantId: req.tenantId!,
    entityType: input.entityType,
    entityId: input.entityId,
    category: input.category,
    originalName: input.file.originalname,
    filePath: `/uploads/certificates/${input.file.filename}`,
    mimeType: input.file.mimetype,
    fileSize: input.file.size,
    uploadedBy: req.userId,
  };
}

function sendWorkbook(res: Response, filename: string, sheetName: string, rows: Record<string, unknown>[]): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', encodeContentDisposition(filename));
  res.send(buffer);
}

function sendPdf(
  res: Response,
  filename: string,
  render: (doc: PDFKit.PDFDocument) => void,
  options: PDFKit.PDFDocumentOptions = { size: 'A4', margin: 42 },
): void {
  const doc = new PDFDocument({ size: 'A4', margin: 42, ...options });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', encodeContentDisposition(filename));
    res.send(Buffer.concat(chunks));
  });
  const fontPath = findChineseFontPath();
  if (fontPath) doc.font(fontPath);
  render(doc);
  doc.end();
}

function findChineseFontPath(): string | null {
  const candidates = [
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  ];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function findCertificatePrintFontPath(): string | null {
  const candidates = [
    '/System/Library/Fonts/Supplemental/NotoSansKaithi-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Songti.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
    '/System/Library/Fonts/PingFang.ttc',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  ];
  return candidates.find((candidate) => existsSync(candidate)) || findChineseFontPath();
}

function parseCertificatePrintCalibration(req: Request): CertificatePrintCalibration {
  return {
    offsetX: certificatePrintMmToPt(parseNumberQuery(req.query.offsetXMm, 0)),
    offsetY: certificatePrintMmToPt(parseNumberQuery(req.query.offsetYMm, 0)),
    fontScale: clamp(parseNumberQuery(req.query.fontScale, 1), 0.8, 1.2),
  };
}

function parseNumberQuery(value: unknown, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function renderSupplyRequestPdf(
  doc: PDFKit.PDFDocument,
  request: {
    tenant: { name: string; contactPhone?: string | null; address?: string | null };
    blankCertQuantity?: number | null;
    shellQuantity?: number | null;
    responsiblePerson?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    mailingAddress?: string | null;
    notes?: string | null;
    requestedAt: Date;
  }
): void {
  renderPdfTitle(doc, '空白职业技能等级证书、证书壳申请表');
  renderPdfRows(doc, [
    ['申请单位', request.tenant.name],
    ['申请时间', formatDateOnly(request.requestedAt)],
    ['申请空白证书数量', String(request.blankCertQuantity || 0)],
    ['申请证书壳数量', String(request.shellQuantity || 0)],
    ['责任人', request.responsiblePerson || ''],
    ['联系人', request.contactName || ''],
    ['联系电话', request.contactPhone || request.tenant.contactPhone || ''],
    ['邮寄地址', request.mailingAddress || request.tenant.address || ''],
    ['备注', request.notes || ''],
  ]);
  doc.moveDown(2);
  doc.fontSize(12).text('分支机构确认：', { continued: false });
  doc.moveDown(2);
  doc.text('负责人签字：____________________        单位盖章：____________________');
}

function renderPrintSignaturePdf(
  doc: PDFKit.PDFDocument,
  record: { plan: { title: string; occupation: string; profession: string; level: string }; responsiblePerson: string; actualPrintedCount: number; createdAt: Date },
  certificates: Array<{ certNo: string; certDisplayIssueDate: Date | null; candidate: { name: string; idCard: string } }>
): void {
  renderPdfTitle(doc, '职业技能等级证书领取签字记录');
  doc.fontSize(11).text(`考评计划：${record.plan.title}`);
  doc.text(`职业/工种/等级：${record.plan.occupation} / ${record.plan.profession} / ${record.plan.level}`);
  doc.text(`打印责任人：${record.responsiblePerson}    实际打印数量：${record.actualPrintedCount}    日期：${formatDateOnly(record.createdAt)}`);
  doc.moveDown();
  renderPdfTable(doc, ['姓名', '证件号码', '证书编号', '版面发证日期', '领取签字'], certificates.map((certificate) => [
    certificate.candidate.name,
    safeDecrypt(certificate.candidate.idCard),
    certificate.certNo,
    formatDateOnly(certificate.certDisplayIssueDate),
    '',
  ]));
}

const certificatePrintFields = {
  name: { x: 544.25, y: 191.6, width: 198.4, height: 34, size: 14, font: 'regular' },
  idType: { x: 544.25, y: 227.9, width: 198.4, height: 34, size: 14, font: 'regular' },
  idCard: { x: 544.25, y: 266.45, width: 198.4, height: 34, size: 14, font: 'regular' },
  occupation: { x: 544.25, y: 302.15, width: 198.4, height: 34, size: 14, font: 'regular' },
  profession: { x: 544.25, y: 339, width: 198.4, height: 34, size: 14, font: 'regular' },
  level: { x: 544.25, y: 377, width: 198.4, height: 34, size: 14, font: 'regular' },
  certNo: { x: 544.25, y: 415, width: 198.4, height: 34, size: 14, font: 'regular' },
  date: { x: 584.8, y: 486.15, width: 114.4, height: 22.85, size: 12, font: 'regular' },
} as const;

interface CertificatePrintCalibration {
  offsetX: number;
  offsetY: number;
  fontScale: number;
}

function renderCertificatePrintPdf(
  doc: PDFKit.PDFDocument,
  certificates: Array<{
    certNo: string;
    certDisplayIssueDate: Date | null;
    candidate: {
      name: string;
      idCard: string;
      plan: { occupation: string; profession: string; level: string };
    };
  }>,
  calibration: CertificatePrintCalibration,
): void {
  const certificateFontPath = findCertificatePrintFontPath();
  if (certificateFontPath) doc.font(certificateFontPath);
  certificates.forEach((certificate, index) => {
    if (index > 0) doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
    if (certificateFontPath) doc.font(certificateFontPath);
    drawTemplateField(doc, certificatePrintFields.name, certificate.candidate.name, calibration);
    drawTemplateField(doc, certificatePrintFields.idType, '居民身份证', calibration);
    drawTemplateField(doc, certificatePrintFields.idCard, safeDecrypt(certificate.candidate.idCard), calibration);
    drawTemplateField(doc, certificatePrintFields.occupation, certificate.candidate.plan.occupation, calibration);
    drawTemplateField(doc, certificatePrintFields.profession, certificate.candidate.plan.profession, calibration);
    drawTemplateField(doc, certificatePrintFields.level, certificate.candidate.plan.level, calibration);
    drawTemplateField(doc, certificatePrintFields.certNo, certificate.certNo, calibration);
    drawTemplateField(doc, certificatePrintFields.date, formatCertificatePrintDate(certificate.certDisplayIssueDate), calibration);
  });
}

function drawTemplateField(
  doc: PDFKit.PDFDocument,
  field: { x: number; y: number; width: number; height: number; size: number },
  value: string,
  calibration: CertificatePrintCalibration,
): void {
  const text = value || '';
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
      align: 'center',
      lineBreak: false,
    });
}

function renderDestroyBatchPdf(
  doc: PDFKit.PDFDocument,
  batch: { title: string; responsiblePerson: string | null; notes: string | null; createdAt: Date; voidRecords: Array<{ tenant: { name: string }; plan?: { title: string } | null; itemType: CertificateItemType; quantity: number; reason: string }> }
): void {
  renderPdfTitle(doc, '职业技能等级证书作废销毁登记表');
  doc.fontSize(11).text(`销毁批次：${batch.title}`);
  doc.text(`责任人：${batch.responsiblePerson || ''}    创建时间：${formatDateOnly(batch.createdAt)}`);
  if (batch.notes) doc.text(`备注：${batch.notes}`);
  doc.moveDown();
  renderPdfTable(doc, ['机构', '计划', '物品', '数量', '作废原因'], batch.voidRecords.map((record) => [
    record.tenant.name,
    record.plan?.title || '',
    itemTypeLabel(record.itemType),
    String(record.quantity),
    record.reason,
  ]));
  doc.moveDown(2);
  doc.text('销毁负责人签字：____________________        监督人签字：____________________');
}

function renderPdfTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();
}

function renderPdfRows(doc: PDFKit.PDFDocument, rows: Array<[string, string]>): void {
  rows.forEach(([label, value]) => {
    doc.fontSize(11).text(`${label}：${value || ''}`);
    doc.moveDown(0.45);
  });
}

function renderPdfTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]): void {
  const startX = doc.x;
  const widths = headers.map((_, index) => index === headers.length - 1 ? 90 : 95);
  let y = doc.y;
  const drawRow = (cells: string[], header = false) => {
    let x = startX;
    const height = 28;
    cells.forEach((cell, index) => {
      doc.rect(x, y, widths[index], height).stroke();
      doc.fontSize(header ? 10 : 9).text(cell, x + 4, y + 7, { width: widths[index] - 8, ellipsis: true });
      x += widths[index];
    });
    y += height;
  };
  drawRow(headers, true);
  rows.forEach((row) => {
    if (y > 760) {
      doc.addPage();
      y = doc.y;
      drawRow(headers, true);
    }
    drawRow(row);
  });
  doc.y = y + 8;
}

function renderReissueRequestDoc(request: {
  tenant: { name: string };
  applicantName: string;
  applicantPhone: string | null;
  applicantIdCard: string | null;
  certNo: string | null;
  reason: string;
  mailingAddress: string | null;
  feeCents: number;
  mailingFeeCents: number;
  status: string;
}): string {
  return renderWordDocument('职业技能等级证书补办申请表', [
    ['申请机构', request.tenant.name],
    ['申请人', request.applicantName],
    ['联系电话', request.applicantPhone || ''],
    ['身份证号', request.applicantIdCard || ''],
    ['原证书编号', request.certNo || ''],
    ['补办原因', request.reason],
    ['邮寄地址', request.mailingAddress || ''],
    ['补办费用', `${(request.feeCents / 100).toFixed(2)}元`],
    ['邮寄费用', `${(request.mailingFeeCents / 100).toFixed(2)}元`],
    ['状态', request.status],
  ]);
}

function renderWordDocument(title: string, rows: Array<[string, string]>): string {
  const tableRows = rows
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:"Microsoft YaHei",sans-serif;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #333;padding:8px;text-align:left;}th{width:180px;background:#f3f4f6;}h1{text-align:center;}</style></head><body><h1>${escapeHtml(title)}</h1><table>${tableRows}</table></body></html>`;
}

function sendWordHtml(res: Response, filename: string, html: string): void {
  res.setHeader('Content-Type', 'application/msword; charset=utf-8');
  res.setHeader('Content-Disposition', encodeContentDisposition(filename));
  res.send(Buffer.from(html, 'utf8'));
}

function encodeContentDisposition(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function formatDateOnly(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function itemTypeLabel(itemType: CertificateItemType): string {
  return itemType === 'BLANK_CERT' ? '空白证书' : '证书壳';
}

function nodeOrder(nodeType: string): number {
  const index = NODE_ORDER.indexOf(nodeType);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function handleRouteError(res: Response, err: unknown, fallbackMessage: string): void {
  if (err instanceof RouteError) {
    error(res, err.code, err.message, err.statusCode);
    return;
  }
  console.error(fallbackMessage, err);
  error(res, 'INTERNAL_ERROR', fallbackMessage, 500);
}

class RouteError extends Error {
  constructor(public code: string, message: string, public statusCode = 400) {
    super(message);
  }
}

export default router;
