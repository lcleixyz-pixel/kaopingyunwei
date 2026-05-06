// ═══════════════════════════════════════════════════
// 考生路由 — 报名、审核、管理
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { encrypt } from '../utils/crypto.js';

const router = Router();

router.use(authenticate);

const candidateSchema = z.object({
  planId: z.string().uuid(),
  name: z.string().min(1, '姓名不能为空'),
  idCard: z.string().min(15, '身份证号格式不正确').max(18),
  phone: z.string().optional(),
  gender: z.enum(['M', 'F']),
  education: z.string().optional(),
  workYears: z.number().int().optional(),
  applyLevel: z.string().min(1, '申报等级不能为空'),
});

/**
 * GET /api/candidates — 考生列表
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { planId, status, search } = req.query;

    const where: any = { tenantId };

    if (planId) {
      where.planId = planId as string;
    }

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (search) {
      where.name = { contains: search as string };
    }

    const candidates = await prisma.candidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          select: { title: true, examDate: true },
        },
        score: {
          select: { totalScore: true, isPass: true },
        },
      },
    });

    // 脱敏处理
    const sanitizedCandidates = candidates.map((c) => ({
      ...c,
      idCard: c.idCard.length > 8
        ? `${c.idCard.slice(0, 4)}****${c.idCard.slice(-4)}`
        : c.idCard,
      phone: c.phone
        ? `${c.phone.slice(0, 3)}****${c.phone.slice(-4)}`
        : null,
    }));

    success(res, sanitizedCandidates);
  } catch (err) {
    console.error('Get candidates error:', err);
    error(res, 'INTERNAL_ERROR', '获取考生列表失败', 500);
  }
});

/**
 * POST /api/candidates — 添加考生
 */
router.post('/', requireRoles(['BRANCH_ADMIN', 'BRANCH_STAFF', 'SYS_ADMIN']), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const result = candidateSchema.safeParse(req.body);

    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const data = result.data;

    // 验证计划是否属于当前租户
    const plan = await prisma.examPlan.findFirst({
      where: { id: data.planId, tenantId },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '考评计划不存在', 404);
      return;
    }

    // 加密身份证号
    const encryptedIdCard = encrypt(data.idCard);

    const candidate = await prisma.candidate.create({
      data: {
        tenantId,
        planId: data.planId,
        name: data.name,
        idCard: encryptedIdCard,
        phone: data.phone,
        gender: data.gender,
        education: data.education,
        workYears: data.workYears,
        applyLevel: data.applyLevel,
        status: 'PENDING',
      },
    });

    success(res, candidate, 201);
  } catch (err) {
    console.error('Create candidate error:', err);
    error(res, 'INTERNAL_ERROR', '添加考生失败', 500);
  }
});

/**
 * POST /api/candidates/:id/approve — 审核考生
 */
router.post('/:id/approve', requireRoles(['BRANCH_ADMIN', 'SYS_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      error(res, 'VALIDATION_ERROR', '审核状态无效', 400);
      return;
    }

    const candidate = await prisma.candidate.updateMany({
      where: { id, tenantId },
      data: { status },
    });

    if (candidate.count === 0) {
      error(res, 'NOT_FOUND', '考生不存在', 404);
      return;
    }

    success(res, { message: `考生已${status === 'APPROVED' ? '审核通过' : '审核驳回'}` });
  } catch (err) {
    console.error('Approve candidate error:', err);
    error(res, 'INTERNAL_ERROR', '审核失败', 500);
  }
});

export default router;
