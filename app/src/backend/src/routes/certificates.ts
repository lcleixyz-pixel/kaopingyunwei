// ═══════════════════════════════════════════════════
// 证书路由 — 赋码、打印、发放、补办
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import type { CertStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { recordAudit } from '../utils/audit.js';

const router = Router();

router.use(authenticate);

const createCertificateSchema = z.object({
  candidateId: z.string().min(1),
  certNo: z.string().optional(),
});

const updateCertificateSchema = z.object({
  status: z.enum(['PENDING', 'PRINTED', 'ISSUED', 'REISSUE_REQUESTED']),
});

router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const certificateStatus = status && status !== 'ALL' ? status as CertStatus : undefined;

    const certificates = await prisma.certificate.findMany({
      where: {
        ...(certificateStatus ? { status: certificateStatus } : {}),
        candidate: { tenantId },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        candidate: {
          include: {
            plan: {
              select: { id: true, title: true, examDate: true, profession: true, level: true },
            },
            score: true,
          },
        },
      },
    });

    success(res, certificates);
  } catch (err) {
    console.error('Get certificates error:', err);
    error(res, 'INTERNAL_ERROR', '获取证书列表失败', 500);
  }
});

router.post('/', requireRoles('SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const result = createCertificateSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: result.data.candidateId, tenantId },
      include: { score: true, certificate: true },
    });

    if (!candidate) {
      error(res, 'NOT_FOUND', '考生不存在', 404);
      return;
    }

    if (!candidate.score?.isPass && candidate.status !== 'PASSED') {
      error(res, 'VALIDATION_ERROR', '仅合格考生可生成证书', 400);
      return;
    }

    const certNo = result.data.certNo || generateCertNo(candidate.id);
    const certificate = await prisma.certificate.upsert({
      where: { candidateId: candidate.id },
      update: { certNo },
      create: {
        candidateId: candidate.id,
        certNo,
        status: 'PENDING',
      },
      include: {
        candidate: {
          include: {
            plan: {
              select: { id: true, title: true, examDate: true, profession: true, level: true },
            },
            score: true,
          },
        },
      },
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_CREATE',
      target: 'Certificate',
      targetId: certificate.id,
      oldValue: candidate.certificate,
      newValue: certificate,
    });

    success(res, certificate, candidate.certificate ? 200 : 201);
  } catch (err) {
    console.error('Create certificate error:', err);
    error(res, 'INTERNAL_ERROR', '生成证书失败', 500);
  }
});

router.patch('/:id/status', requireRoles('SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const id = String(req.params.id);
    const result = updateCertificateSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldCertificate = await prisma.certificate.findFirst({
      where: { id, candidate: { tenantId } },
    });

    if (!oldCertificate) {
      error(res, 'NOT_FOUND', '证书不存在', 404);
      return;
    }

    const certificate = await prisma.certificate.update({
      where: { id },
      data: {
        status: result.data.status,
        issueDate: result.data.status === 'ISSUED' ? new Date() : oldCertificate.issueDate,
        issuedBy: result.data.status === 'ISSUED' ? req.userId : oldCertificate.issuedBy,
      },
      include: {
        candidate: {
          include: {
            plan: {
              select: { id: true, title: true, examDate: true, profession: true, level: true },
            },
            score: true,
          },
        },
      },
    });

    await recordAudit(req, {
      action: 'CERTIFICATE_STATUS_UPDATE',
      target: 'Certificate',
      targetId: certificate.id,
      oldValue: oldCertificate,
      newValue: certificate,
    });

    success(res, certificate);
  } catch (err) {
    console.error('Update certificate status error:', err);
    error(res, 'INTERNAL_ERROR', '更新证书状态失败', 500);
  }
});

function generateCertNo(candidateId: string): string {
  const year = new Date().getFullYear();
  const suffix = candidateId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `CERT-${year}-${suffix}`;
}

export default router;
