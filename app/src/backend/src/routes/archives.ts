// ═══════════════════════════════════════════════════
// 档案路由 — 证书上报批次、旧档案封存、调阅状态
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
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { decrypt, sha256 } from '../utils/crypto.js';
import { recordAudit } from '../utils/audit.js';
import { planTenantWhereForRead } from '../services/accessScope.js';
import {
  ARCHIVE_REPORT_HEADERS,
  buildArchiveReportRows,
  buildArchiveSummaryRows,
  buildSuggestedArchiveBatchTitle,
  canReadArchiveReportAcrossTenants,
  filterCompleteArchiveCertificates,
  normalizeText,
  validateArchiveBatchDraft,
  type ArchiveReportRow,
  type ArchiveSummaryRow,
} from '../services/archiveReportRules.js';

const router = Router();

router.use(authenticate);

const archiveSchema = z.object({
  planId: z.string().min(1),
  filePath: z.string().optional(),
  fileSize: z.number().int().min(0).optional(),
});

const statusSchema = z.object({
  status: z.enum(['SEALED', 'OPENED']),
});

const reportBatchSchema = z.object({
  planIds: z.array(z.string().min(1)).min(1, '至少选择一个考试计划'),
  batchNo: z.string().trim().min(1, '批次号不能为空'),
  title: z.string().trim().max(200).optional(),
  uploadDate: z.string().trim().optional(),
  unitLeader: z.string().trim().min(1, '单位负责人不能为空').max(100),
  informationManager: z.string().trim().min(1, '信息管理员不能为空').max(100),
});

const reportBatchPatchSchema = reportBatchSchema.partial().extend({
  planIds: z.array(z.string().min(1)).min(1).optional(),
});

const reviewSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().trim().max(1000).optional(),
});

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'files', 'archives');
const ARCHIVE_REPORT_DIR = path.join(DATA_DIR, 'files', 'archive-reports');
const ARCHIVE_REPORT_SIGNED_DIR = path.join(ARCHIVE_REPORT_DIR, 'signed');
const ARCHIVE_REPORT_SNAPSHOT_DIR = path.join(ARCHIVE_REPORT_DIR, 'snapshots');

const signedUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdir(ARCHIVE_REPORT_SIGNED_DIR, { recursive: true })
        .then(() => callback(null, ARCHIVE_REPORT_SIGNED_DIR))
        .catch((err: Error) => callback(err, ARCHIVE_REPORT_SIGNED_DIR));
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${path.extname(file.originalname || '')}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
    const allowedMimes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (allowedExts.has(ext) || allowedMimes.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new RouteError('INVALID_FILE_TYPE', '盖章件仅支持 PDF/JPG/PNG', 400));
  },
});

router.get('/reportable-plans', async (req, res) => {
  try {
    const plans = await prisma.examPlan.findMany({
      where: {
        ...planTenantWhereForRead(req),
        nodes: {
          some: {
            nodeType: 'CERT_MANAGE',
            status: { in: ['IN_PROGRESS', 'COMPLETED'] },
          },
        },
      },
      orderBy: { examDate: 'desc' },
      include: {
        tenant: { select: { id: true, code: true, name: true, type: true } },
        nodes: { where: { nodeType: 'CERT_MANAGE' }, orderBy: { createdAt: 'asc' } },
        candidates: { include: { certificate: true } },
        archiveReportBatchPlans: {
          include: { batch: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    success(res, plans.map((plan) => {
      const completeRecordCount = plan.candidates.filter((candidate) => (
        candidate.certificate?.certNo && candidate.certificate.certDisplayIssueDate
      )).length;
      const activeBatch = plan.archiveReportBatchPlans.find((item) => item.batch.status !== 'REJECTED')?.batch || null;
      return {
        id: plan.id,
        title: plan.title,
        tenant: plan.tenant,
        examDate: plan.examDate,
        occupation: plan.occupation,
        profession: plan.profession,
        level: plan.level,
        certNode: plan.nodes[0] || null,
        completeRecordCount,
        reminder: completeRecordCount > 0 && !activeBatch ? '请先向本地上级部门报备获取批次号' : null,
        activeBatch: activeBatch ? {
          id: activeBatch.id,
          batchNo: activeBatch.batchNo,
          title: activeBatch.title,
          status: activeBatch.status,
        } : null,
      };
    }));
  } catch (err) {
    handleRouteError(res, err, '获取可上报计划失败');
  }
});

router.get('/batches', async (req, res) => {
  try {
    const batches = await prisma.archiveReportBatch.findMany({
      where: archiveReportTenantWhere(req),
      orderBy: { createdAt: 'desc' },
      include: archiveReportBatchInclude(),
    });
    success(res, batches.map(formatArchiveReportBatch));
  } catch (err) {
    handleRouteError(res, err, '获取证书上报批次失败');
  }
});

router.post('/batches', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const result = reportBatchSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const context = await buildBatchContext(req, result.data.planIds);
    const errors = validateArchiveBatchDraft({
      batchNo: result.data.batchNo,
      planTenantIds: context.plans.map((plan) => plan.tenantId),
      completeRecordCount: context.completeCertificates.length,
    });
    if (errors.length > 0) {
      error(res, 'VALIDATION_ERROR', errors.join('；'), 400);
      return;
    }
    await assertNoActivePlanBatch(result.data.planIds);

    const batch = await prisma.archiveReportBatch.create({
      data: {
        tenantId: req.tenantId!,
        batchNo: result.data.batchNo,
        title: normalizeText(result.data.title) || buildSuggestedArchiveBatchTitle({
          tenantName: context.tenant.name,
          batchNo: result.data.batchNo,
          recordCount: context.completeCertificates.length,
        }),
        uploadDate: parseDateInput(result.data.uploadDate) || new Date(),
        dataType: '新增',
        unitLeader: result.data.unitLeader,
        informationManager: result.data.informationManager,
        recordCount: context.completeCertificates.length,
        plans: {
          create: result.data.planIds.map((planId) => ({ planId })),
        },
      },
      include: archiveReportBatchInclude(),
    });

    await recordAudit(req, {
      action: 'ARCHIVE_REPORT_BATCH_CREATE',
      target: 'ArchiveReportBatch',
      targetId: batch.id,
      newValue: batch,
    });

    success(res, formatArchiveReportBatch(batch), 201);
  } catch (err) {
    handleRouteError(res, err, '创建证书上报批次失败');
  }
});

router.patch('/batches/:id', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = reportBatchPatchSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldBatch = await prisma.archiveReportBatch.findFirst({
      where: { id, tenantId: req.tenantId! },
      include: archiveReportBatchInclude(),
    });
    if (!oldBatch) {
      error(res, 'NOT_FOUND', '证书上报批次不存在', 404);
      return;
    }
    if (!['DRAFT', 'REJECTED'].includes(oldBatch.status)) {
      error(res, 'INVALID_STATUS', '只有草稿或已驳回批次可以修改', 400);
      return;
    }

    const nextPlanIds = result.data.planIds || oldBatch.plans.map((item) => item.planId);
    const context = await buildBatchContext(req, nextPlanIds);
    const nextBatchNo = result.data.batchNo ?? oldBatch.batchNo;
    const errors = validateArchiveBatchDraft({
      batchNo: nextBatchNo,
      planTenantIds: context.plans.map((plan) => plan.tenantId),
      completeRecordCount: context.completeCertificates.length,
    });
    if (errors.length > 0) {
      error(res, 'VALIDATION_ERROR', errors.join('；'), 400);
      return;
    }
    await assertNoActivePlanBatch(nextPlanIds, oldBatch.id);

    const batch = await prisma.$transaction(async (tx) => {
      if (result.data.planIds) {
        await tx.archiveReportBatchPlan.deleteMany({ where: { batchId: oldBatch.id } });
        await tx.archiveReportBatchPlan.createMany({
          data: result.data.planIds.map((planId) => ({ batchId: oldBatch.id, planId })),
        });
      }
      return tx.archiveReportBatch.update({
        where: { id: oldBatch.id },
        data: {
          batchNo: nextBatchNo,
          title: normalizeText(result.data.title) || oldBatch.title,
          uploadDate: result.data.uploadDate ? parseDateInput(result.data.uploadDate)! : oldBatch.uploadDate,
          unitLeader: result.data.unitLeader ?? oldBatch.unitLeader,
          informationManager: result.data.informationManager ?? oldBatch.informationManager,
          recordCount: context.completeCertificates.length,
          status: oldBatch.status === 'REJECTED' ? 'DRAFT' : oldBatch.status,
          reviewNotes: oldBatch.status === 'REJECTED' ? null : oldBatch.reviewNotes,
          reviewedAt: oldBatch.status === 'REJECTED' ? null : oldBatch.reviewedAt,
          reviewedBy: oldBatch.status === 'REJECTED' ? null : oldBatch.reviewedBy,
        },
        include: archiveReportBatchInclude(),
      });
    });

    await recordAudit(req, {
      action: 'ARCHIVE_REPORT_BATCH_UPDATE',
      target: 'ArchiveReportBatch',
      targetId: batch.id,
      oldValue: oldBatch,
      newValue: batch,
    });

    success(res, formatArchiveReportBatch(batch));
  } catch (err) {
    handleRouteError(res, err, '更新证书上报批次失败');
  }
});

router.get('/batches/:id/table5.pdf', async (req, res) => {
  try {
    const batch = await findArchiveReportBatch(req, String(req.params.id));
    if (!batch) {
      error(res, 'NOT_FOUND', '证书上报批次不存在', 404);
      return;
    }

    const summaryRows = await getBatchSummaryRows(batch);
    const total = summaryRows.reduce((sum, row) => sum + row.quantity, 0);
    sendPdf(res, `表5-职业技能等级证书数据审核确认表-${batch.batchNo}.pdf`, (doc) => {
      renderTable5Pdf(doc, batch, summaryRows, total);
    });
  } catch (err) {
    handleRouteError(res, err, '生成表5 PDF失败');
  }
});

router.get('/batches/:id/data.xlsx', async (req, res) => {
  try {
    const batch = await findArchiveReportBatch(req, String(req.params.id));
    if (!batch) {
      error(res, 'NOT_FOUND', '证书上报批次不存在', 404);
      return;
    }

    if (batch.dataSnapshotPath) {
      const filePath = path.join(DATA_DIR, batch.dataSnapshotPath);
      res.download(filePath, `${sanitizeFilename(batch.title)}.xlsx`);
      return;
    }

    const rows = await buildRowsForBatch(batch);
    sendArchiveWorkbook(res, `${sanitizeFilename(batch.title)}.xlsx`, rows);
  } catch (err) {
    handleRouteError(res, err, '导出总部上报数据表失败');
  }
});

router.get('/batches/:id/signed-file', async (req, res) => {
  try {
    const batch = await findArchiveReportBatch(req, String(req.params.id));
    if (!batch || !batch.signedFilePath) {
      error(res, 'NOT_FOUND', '盖章件不存在', 404);
      return;
    }
    res.download(path.join(DATA_DIR, batch.signedFilePath), batch.signedOriginalName || '表5盖章件');
  } catch (err) {
    handleRouteError(res, err, '下载表5盖章件失败');
  }
});

router.post('/batches/:id/submit', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), signedUpload.single('signedFile'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const oldBatch = await prisma.archiveReportBatch.findFirst({
      where: { id, tenantId: req.tenantId! },
      include: archiveReportBatchInclude(),
    });
    if (!oldBatch) {
      error(res, 'NOT_FOUND', '证书上报批次不存在', 404);
      return;
    }
    if (!['DRAFT', 'REJECTED'].includes(oldBatch.status)) {
      error(res, 'INVALID_STATUS', '只有草稿或已驳回批次可以提交', 400);
      return;
    }
    if (!req.file) {
      error(res, 'VALIDATION_ERROR', '请上传签字盖章后的表5文件', 400);
      return;
    }

    const rows = await buildRowsForBatch(oldBatch);
    if (rows.length === 0) {
      error(res, 'VALIDATION_ERROR', '批次内没有完整的证书编号和证书版面发证日期记录', 400);
      return;
    }
    const summaryRows = buildArchiveSummaryRows(await getCompleteCertificatesForBatch(oldBatch));
    await fs.mkdir(ARCHIVE_REPORT_SNAPSHOT_DIR, { recursive: true });
    const snapshotBuffer = buildArchiveWorkbookBuffer(rows);
    const snapshotFileName = `${randomUUID()}.xlsx`;
    const snapshotPath = path.join(ARCHIVE_REPORT_SNAPSHOT_DIR, snapshotFileName);
    await fs.writeFile(snapshotPath, snapshotBuffer);

    const batch = await prisma.archiveReportBatch.update({
      where: { id: oldBatch.id },
      data: {
        status: 'SUBMITTED',
        recordCount: rows.length,
        summarySnapshotJson: JSON.stringify(summaryRows),
        signedFilePath: dataRelativePath(req.file.path),
        signedOriginalName: req.file.originalname,
        signedMimeType: req.file.mimetype,
        signedFileSize: req.file.size,
        dataSnapshotPath: dataRelativePath(snapshotPath),
        dataSnapshotSize: snapshotBuffer.byteLength,
        dataSnapshotHash: sha256(snapshotBuffer.toString('base64')),
        submittedBy: req.userId,
        submittedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      },
      include: archiveReportBatchInclude(),
    });

    await recordAudit(req, {
      action: 'ARCHIVE_REPORT_BATCH_SUBMIT',
      target: 'ArchiveReportBatch',
      targetId: batch.id,
      oldValue: oldBatch,
      newValue: batch,
    });

    success(res, formatArchiveReportBatch(batch));
  } catch (err) {
    handleRouteError(res, err, '提交证书上报批次失败');
  }
});

router.post('/batches/:id/review', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  try {
    const result = reviewSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldBatch = await prisma.archiveReportBatch.findFirst({
      where: { id: String(req.params.id) },
      include: archiveReportBatchInclude(),
    });
    if (!oldBatch) {
      error(res, 'NOT_FOUND', '证书上报批次不存在', 404);
      return;
    }
    if (oldBatch.status !== 'SUBMITTED') {
      error(res, 'INVALID_STATUS', '只有已提交总部的批次可以审批', 400);
      return;
    }

    const batch = await prisma.archiveReportBatch.update({
      where: { id: oldBatch.id },
      data: {
        status: result.data.approved ? 'APPROVED' : 'REJECTED',
        reviewNotes: result.data.reviewNotes,
        reviewedBy: req.userId,
        reviewedAt: new Date(),
      },
      include: archiveReportBatchInclude(),
    });

    await recordAudit(req, {
      action: result.data.approved ? 'ARCHIVE_REPORT_BATCH_APPROVE' : 'ARCHIVE_REPORT_BATCH_REJECT',
      target: 'ArchiveReportBatch',
      targetId: batch.id,
      oldValue: oldBatch,
      newValue: batch,
    });

    success(res, formatArchiveReportBatch(batch));
  } catch (err) {
    handleRouteError(res, err, '审批证书上报批次失败');
  }
});

router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const archives = await prisma.archive.findMany({
      where: {
        plan: { tenantId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          select: { id: true, title: true, examDate: true, profession: true, level: true },
        },
      },
    });

    success(res, archives);
  } catch (err) {
    handleRouteError(res, err, '获取档案列表失败');
  }
});

router.post('/', requireRoles('SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const result = archiveSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const plan = await prisma.examPlan.findFirst({
      where: { id: result.data.planId, tenantId },
      include: {
        _count: {
          select: { candidates: true, nodes: true },
        },
      },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '考评计划不存在', 404);
      return;
    }

    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    const payload = JSON.stringify({
      planId: plan.id,
      title: plan.title,
      examDate: plan.examDate,
      candidates: plan._count.candidates,
      nodes: plan._count.nodes,
      sealedAt: new Date().toISOString(),
    }, null, 2);
    const fileName = `archive-${plan.id}-${Date.now()}.json`;
    const generatedPath = path.join(ARCHIVE_DIR, fileName);
    await fs.writeFile(generatedPath, payload);

    const filePath = result.data.filePath || `files/archives/${fileName}`;
    const fileSize = result.data.fileSize ?? Buffer.byteLength(payload);
    const sealHash = sha256(`${filePath}:${fileSize}:${payload}`);

    const archive = await prisma.archive.create({
      data: {
        planId: plan.id,
        filePath,
        fileSize,
        sealHash,
        status: 'SEALED',
      },
      include: {
        plan: {
          select: { id: true, title: true, examDate: true, profession: true, level: true },
        },
      },
    });

    await recordAudit(req, {
      action: 'ARCHIVE_SEAL',
      target: 'Archive',
      targetId: archive.id,
      newValue: archive,
    });

    success(res, archive, 201);
  } catch (err) {
    handleRouteError(res, err, '封存档案失败');
  }
});

router.patch('/:id/status', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const id = String(req.params.id);
    const result = statusSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldArchive = await prisma.archive.findFirst({
      where: { id, plan: { tenantId } },
    });

    if (!oldArchive) {
      error(res, 'NOT_FOUND', '档案不存在', 404);
      return;
    }

    const archive = await prisma.archive.update({
      where: { id },
      data: { status: result.data.status },
      include: {
        plan: {
          select: { id: true, title: true, examDate: true, profession: true, level: true },
        },
      },
    });

    await recordAudit(req, {
      action: 'ARCHIVE_STATUS_UPDATE',
      target: 'Archive',
      targetId: archive.id,
      oldValue: oldArchive,
      newValue: archive,
    });

    success(res, archive);
  } catch (err) {
    handleRouteError(res, err, '更新档案状态失败');
  }
});

function archiveReportTenantWhere(req: Request): { tenantId?: string } {
  return canReadArchiveReportAcrossTenants(req.userRole) ? {} : { tenantId: req.tenantId! };
}

function archiveReportBatchInclude() {
  return {
    tenant: { select: { id: true, code: true, name: true, type: true } },
    plans: {
      include: {
        plan: {
          select: {
            id: true,
            title: true,
            examDate: true,
            occupation: true,
            profession: true,
            level: true,
            tenantId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
  } satisfies Prisma.ArchiveReportBatchInclude;
}

type ArchiveReportBatchWithInclude = Prisma.ArchiveReportBatchGetPayload<{
  include: ReturnType<typeof archiveReportBatchInclude>;
}>;

function formatArchiveReportBatch(batch: ArchiveReportBatchWithInclude) {
  return {
    ...batch,
    planIds: batch.plans.map((item) => item.planId),
    plans: batch.plans.map((item) => item.plan),
    summaryRows: parseSummarySnapshot(batch.summarySnapshotJson),
    signedFile: batch.signedFilePath ? {
      originalName: batch.signedOriginalName,
      mimeType: batch.signedMimeType,
      fileSize: batch.signedFileSize,
    } : null,
    dataSnapshot: batch.dataSnapshotPath ? {
      fileSize: batch.dataSnapshotSize,
      hash: batch.dataSnapshotHash,
    } : null,
  };
}

async function buildBatchContext(req: Request, planIds: string[]) {
  const uniquePlanIds = Array.from(new Set(planIds));
  const plans = await prisma.examPlan.findMany({
    where: {
      id: { in: uniquePlanIds },
      ...(req.userRole === 'SYS_ADMIN' ? {} : { tenantId: req.tenantId! }),
    },
    include: { tenant: true },
  });
  if (plans.length !== uniquePlanIds.length) {
    throw new RouteError('NOT_FOUND', '所选考试计划不存在或无权访问', 404);
  }
  const completeCertificates = await getCompleteCertificatesForPlanIds(uniquePlanIds, req.tenantId!);
  return { plans, tenant: plans[0].tenant, completeCertificates };
}

async function assertNoActivePlanBatch(planIds: string[], currentBatchId?: string): Promise<void> {
  const existing = await prisma.archiveReportBatchPlan.findFirst({
    where: {
      planId: { in: planIds },
      ...(currentBatchId ? { batchId: { not: currentBatchId } } : {}),
      batch: { status: { not: 'REJECTED' } },
    },
    include: { batch: true, plan: { select: { title: true } } },
  });
  if (existing) {
    throw new RouteError('PLAN_ALREADY_REPORTED', `计划“${existing.plan.title}”已在批次“${existing.batch.title}”中`, 400);
  }
}

async function findArchiveReportBatch(req: Request, id: string): Promise<ArchiveReportBatchWithInclude | null> {
  return prisma.archiveReportBatch.findFirst({
    where: {
      id,
      ...archiveReportTenantWhere(req),
    },
    include: archiveReportBatchInclude(),
  });
}

async function getCompleteCertificatesForBatch(batch: ArchiveReportBatchWithInclude) {
  return getCompleteCertificatesForPlanIds(batch.plans.map((item) => item.planId), batch.tenantId);
}

async function getCompleteCertificatesForPlanIds(planIds: string[], tenantId: string) {
  const certificates = await prisma.certificate.findMany({
    where: {
      certNo: { not: '' },
      certDisplayIssueDate: { not: null },
      candidate: {
        tenantId,
        planId: { in: planIds },
      },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      candidate: {
        include: {
          registrationProfile: true,
          plan: {
            include: {
              tenant: true,
            },
          },
        },
      },
    },
  });
  return filterCompleteArchiveCertificates(certificates.map((certificate) => ({
    ...certificate,
    candidate: {
      ...certificate.candidate,
      idCard: safeDecrypt(certificate.candidate.idCard),
    },
  })));
}

async function buildRowsForBatch(batch: ArchiveReportBatchWithInclude): Promise<ArchiveReportRow[]> {
  return buildArchiveReportRows(await getCompleteCertificatesForBatch(batch));
}

async function getBatchSummaryRows(batch: ArchiveReportBatchWithInclude): Promise<ArchiveSummaryRow[]> {
  const snapshotRows = parseSummarySnapshot(batch.summarySnapshotJson);
  if (snapshotRows.length > 0) return snapshotRows;
  return buildArchiveSummaryRows(await getCompleteCertificatesForBatch(batch));
}

function buildArchiveWorkbookBuffer(rows: ArchiveReportRow[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...ARCHIVE_REPORT_HEADERS] });
  sheet['!cols'] = [
    { wch: 8.5 },
    { wch: 8.8 },
    { wch: 18 },
    { wch: 35 },
    { wch: 22 },
    { wch: 10 },
    { wch: 13 },
    { wch: 22 },
    { wch: 10 },
    { wch: 41 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function sendArchiveWorkbook(res: Response, filename: string, rows: ArchiveReportRow[]): void {
  const buffer = buildArchiveWorkbookBuffer(rows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', encodeContentDisposition(filename));
  res.send(buffer);
}

function sendPdf(
  res: Response,
  filename: string,
  render: (doc: PDFKit.PDFDocument) => void,
): void {
  const doc = new PDFDocument({ size: 'A4', margin: 32 });
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

function renderTable5Pdf(
  doc: PDFKit.PDFDocument,
  batch: ArchiveReportBatchWithInclude,
  summaryRows: ArchiveSummaryRow[],
  total: number,
): void {
  const left = 48;
  const top = 38;
  const widths = [86, 160, 86, 130, 64];
  const rowHeights = [38, 34, 34, 34, 34, 34, 34, 42, 62, 62];
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  doc.fontSize(11).text('表5', left, top);
  doc.fontSize(18).text('职业技能等级证书数据审核确认表', left, top + 24, { width: tableWidth, align: 'center' });

  let y = top + 66;
  drawCell(doc, left, y, widths[0], rowHeights[0], '基本信息');
  drawCell(doc, left + widths[0], y, widths[1], rowHeights[0], '单位名称');
  drawCell(doc, left + widths[0] + widths[1], y, widths[2] + widths[3] + widths[4], rowHeights[0], batch.tenant.name);
  y += rowHeights[0];

  drawCell(doc, left, y, widths[0], rowHeights[1], '');
  drawCell(doc, left + widths[0], y, widths[1], rowHeights[1], '单位负责人');
  drawCell(doc, left + widths[0] + widths[1], y, widths[2], rowHeights[1], batch.unitLeader);
  drawCell(doc, left + widths[0] + widths[1] + widths[2], y, widths[3], rowHeights[1], '信息管理员');
  drawCell(doc, left + widths[0] + widths[1] + widths[2] + widths[3], y, widths[4], rowHeights[1], batch.informationManager);
  y += rowHeights[1];

  drawCell(doc, left, y, widths[0], rowHeights[2], '');
  drawCell(doc, left + widths[0], y, widths[1], rowHeights[2], '标题名称');
  drawCell(doc, left + widths[0] + widths[1], y, widths[2] + widths[3] + widths[4], rowHeights[2], batch.title);
  y += rowHeights[2];

  drawCell(doc, left, y, widths[0], rowHeights[3], '');
  drawCell(doc, left + widths[0], y, widths[1], rowHeights[3], '上传日期');
  drawCell(doc, left + widths[0] + widths[1], y, widths[2] + widths[3] + widths[4], rowHeights[3], formatChineseDate(batch.uploadDate));
  y += rowHeights[3];

  drawCell(doc, left, y, widths[0], rowHeights[4] * 4, '数据信息');
  drawCell(doc, left + widths[0], y, widths[1], rowHeights[4], '数据类型');
  drawCell(doc, left + widths[0] + widths[1], y, widths[2] + widths[3] + widths[4], rowHeights[4], batch.dataType);
  y += rowHeights[4];

  drawCell(doc, left + widths[0], y, widths[1], rowHeights[5], '职业名称');
  drawCell(doc, left + widths[0] + widths[1], y, widths[2], rowHeights[5], '工种名称');
  drawCell(doc, left + widths[0] + widths[1] + widths[2], y, widths[3], rowHeights[5], '级别');
  drawCell(doc, left + widths[0] + widths[1] + widths[2] + widths[3], y, widths[4], rowHeights[5], '数量');
  y += rowHeights[5];

  const visibleRows = [...summaryRows];
  while (visibleRows.length < 2) visibleRows.push({ occupation: '', profession: '', level: '', quantity: 0 });
  visibleRows.slice(0, 2).forEach((row) => {
    drawCell(doc, left + widths[0], y, widths[1], rowHeights[6], row.occupation);
    drawCell(doc, left + widths[0] + widths[1], y, widths[2], rowHeights[6], row.profession);
    drawCell(doc, left + widths[0] + widths[1] + widths[2], y, widths[3], rowHeights[6], row.level);
    drawCell(doc, left + widths[0] + widths[1] + widths[2] + widths[3], y, widths[4], rowHeights[6], row.quantity ? String(row.quantity) : '');
    y += rowHeights[6];
  });

  drawCell(doc, left, y, widths[0], rowHeights[7], '合计');
  drawCell(doc, left + widths[0], y, widths[1] + widths[2] + widths[3] + widths[4], rowHeights[7], String(total));
  y += rowHeights[7];

  drawCell(doc, left, y, widths[0], rowHeights[8], '信息管理员意见');
  drawCell(doc, left + widths[0], y, widths[1] + widths[2] + widths[3] + widths[4], rowHeights[8], '签字：                           年      月      日', 'left');
  y += rowHeights[8];

  drawCell(doc, left, y, widths[0], rowHeights[9], '单位意见');
  drawCell(doc, left + widths[0], y, widths[1] + widths[2] + widths[3] + widths[4], rowHeights[9], '中心领导签字：                    单位盖章：                    年      月      日', 'left');

  if (summaryRows.length > 2) {
    doc.fontSize(9).fillColor('#475569').text(`注：本批次共 ${summaryRows.length} 个职业/工种/等级汇总项，表格仅显示前 2 项，完整明细以数据表为准。`, left, y + rowHeights[9] + 8);
    doc.fillColor('#111827');
  }
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
  doc.fontSize(10).text(text, x + 6, y + 8, {
    width: width - 12,
    height: height - 12,
    align,
  });
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

function parseSummarySnapshot(value?: string | null): ArchiveSummaryRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dataRelativePath(filePath: string): string {
  return path.relative(DATA_DIR, filePath).split(path.sep).join('/');
}

function parseDateInput(value?: string | null): Date | null {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatChineseDate(value?: Date | string | null): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

function sanitizeFilename(value: string): string {
  return normalizeText(value).replace(/[\\/:*?"<>|]/g, '_') || '证书上报数据表';
}

function encodeContentDisposition(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
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
