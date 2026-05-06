// ═══════════════════════════════════════════════════
// 考评计划路由 — CRUD + 审批
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { calculateNodeDeadline } from '../utils/dateUtils.js';

const router = Router();

router.use(authenticate);

// 节点元数据定义
const NODE_DEFINITIONS = [
  { type: 'PLAN_CREATE', deadlineDays: -10, isMandatory: false },
  { type: 'REGISTRATION', deadlineDays: -7, isMandatory: false },
  { type: 'ROOM_ARRANGE', deadlineDays: -5, isMandatory: false },
  { type: 'EXAM_PREPARE', deadlineDays: -5, isMandatory: false },
  { type: 'EXAM_DAY', deadlineDays: 0, isMandatory: true },
  { type: 'SCORE_RECORD', deadlineDays: 3, isMandatory: true },
  { type: 'SCORE_PUBLISH', deadlineDays: 5, isMandatory: true },
  { type: 'CERT_MANAGE', deadlineDays: 10, isMandatory: true },
  { type: 'COMPLETE', deadlineDays: 10, isMandatory: true },
];

const createPlanSchema = z.object({
  title: z.string().min(1, '计划标题不能为空'),
  examDate: z.string().datetime(),
  profession: z.string().min(1, '工种不能为空'),
  level: z.string().min(1, '等级不能为空'),
  examType: z.enum(['THEORY', 'PRACTICE', 'COMPREHENSIVE']),
  location: z.string().min(1, '考试地点不能为空'),
  maxCandidates: z.number().int().min(1).default(50),
  notes: z.string().optional(),
});

/**
 * GET /api/exam-plans — 考评计划列表
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { status, search } = req.query;

    const where: any = { tenantId };
    
    if (status && status !== 'ALL') {
      where.status = status;
    }
    
    if (search) {
      where.title = { contains: search as string };
    }

    const plans = await prisma.examPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            candidates: true,
            nodes: true,
          },
        },
      },
    });

    success(res, plans);
  } catch (err) {
    console.error('Get plans error:', err);
    error(res, 'INTERNAL_ERROR', '获取计划列表失败', 500);
  }
});

/**
 * POST /api/exam-plans — 创建考评计划
 */
router.post('/', requireRoles(['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN']), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const result = createPlanSchema.safeParse(req.body);
    
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const data = result.data;
    const examDate = new Date(data.examDate);

    // 创建计划
    const plan = await prisma.examPlan.create({
      data: {
        tenantId,
        title: data.title,
        examDate,
        profession: data.profession,
        level: data.level,
        examType: data.examType,
        location: data.location,
        maxCandidates: data.maxCandidates,
        notes: data.notes,
        status: req.userRole === 'BRANCH_ADMIN' ? 'PENDING' : 'PUBLISHED',
        createdBy: req.userId!,
      },
    });

    // 自动创建9大节点
    const nodeData = NODE_DEFINITIONS.map((def) => ({
      planId: plan.id,
      nodeType: def.type,
      deadline: calculateNodeDeadline(examDate, def.deadlineDays),
      status: 'PENDING' as const,
    }));

    await prisma.examNode.createMany({
      data: nodeData,
    });

    success(res, plan, 201);
  } catch (err) {
    console.error('Create plan error:', err);
    error(res, 'INTERNAL_ERROR', '创建计划失败', 500);
  }
});

/**
 * GET /api/exam-plans/:id — 计划详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const plan = await prisma.examPlan.findFirst({
      where: { id, tenantId },
      include: {
        nodes: {
          orderBy: { createdAt: 'asc' },
        },
        candidates: true,
        _count: {
          select: { candidates: true, nodes: true },
        },
      },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    success(res, plan);
  } catch (err) {
    console.error('Get plan error:', err);
    error(res, 'INTERNAL_ERROR', '获取计划详情失败', 500);
  }
});

/**
 * PATCH /api/exam-plans/:id/approve — 审批计划
 */
router.patch('/:id/approve', requireRoles(['SYS_ADMIN', 'HQ_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      error(res, 'VALIDATION_ERROR', '审批状态无效', 400);
      return;
    }

    const plan = await prisma.examPlan.updateMany({
      where: { id, tenantId },
      data: { status },
    });

    if (plan.count === 0) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    success(res, { message: `计划已${status === 'APPROVED' ? '审批通过' : '驳回'}` });
  } catch (err) {
    console.error('Approve plan error:', err);
    error(res, 'INTERNAL_ERROR', '审批失败', 500);
  }
});

export default router;
