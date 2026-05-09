// ═══════════════════════════════════════════════════
// 档案路由 — 归档、封存、调阅状态
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { sha256 } from '../utils/crypto.js';
import { recordAudit } from '../utils/audit.js';

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

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'files', 'archives');

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
    console.error('Get archives error:', err);
    error(res, 'INTERNAL_ERROR', '获取档案列表失败', 500);
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
    console.error('Create archive error:', err);
    error(res, 'INTERNAL_ERROR', '封存档案失败', 500);
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
    console.error('Update archive status error:', err);
    error(res, 'INTERNAL_ERROR', '更新档案状态失败', 500);
  }
});

export default router;
