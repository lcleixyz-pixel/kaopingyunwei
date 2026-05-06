// ═══════════════════════════════════════════════════
// 考评节点路由 — 节点追踪与完成
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';

const router = Router();

router.use(authenticate);

const completeNodeSchema = z.object({
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

/**
 * GET /api/exam-nodes — 考评节点列表
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { planId, status } = req.query;

    const where: any = {
      plan: { tenantId },
    };

    if (planId) {
      where.planId = planId as string;
    }

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    const nodes = await prisma.examNode.findMany({
      where,
      orderBy: { deadline: 'asc' },
      include: {
        plan: {
          select: {
            id: true,
            title: true,
            examDate: true,
            profession: true,
            level: true,
          },
        },
      },
    });

    success(res, nodes);
  } catch (err) {
    console.error('Get nodes error:', err);
    error(res, 'INTERNAL_ERROR', '获取节点列表失败', 500);
  }
});

/**
 * POST /api/exam-nodes/:id/complete — 完成节点
 */
router.post('/:id/complete', requireRoles(['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF']), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const result = completeNodeSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const { notes, attachments } = result.data;

    // 查找节点并验证权限
    const node = await prisma.examNode.findFirst({
      where: {
        id,
        plan: { tenantId },
      },
      include: { plan: true },
    });

    if (!node) {
      error(res, 'NOT_FOUND', '节点不存在', 404);
      return;
    }

    if (node.status === 'COMPLETED') {
      error(res, 'ALREADY_COMPLETED', '节点已完成', 400);
      return;
    }

    // 更新节点状态
    const updatedNode = await prisma.examNode.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: notes || node.notes,
        attachments: attachments ? JSON.stringify(attachments) : node.attachments,
      },
    });

    // 触发下一个节点提醒（简单实现：将下一个节点标记为IN_PROGRESS）
    const nextNode = await prisma.examNode.findFirst({
      where: {
        planId: node.planId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (nextNode) {
      await prisma.examNode.update({
        where: { id: nextNode.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    success(res, updatedNode);
  } catch (err) {
    console.error('Complete node error:', err);
    error(res, 'INTERNAL_ERROR', '完成节点失败', 500);
  }
});

/**
 * GET /api/exam-nodes/overdue — 逾期节点
 */
router.get('/overdue/list', async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const nodes = await prisma.examNode.findMany({
      where: {
        plan: { tenantId },
        status: 'OVERDUE',
      },
      include: {
        plan: {
          select: {
            id: true,
            title: true,
            examDate: true,
          },
        },
      },
    });

    success(res, nodes);
  } catch (err) {
    console.error('Get overdue nodes error:', err);
    error(res, 'INTERNAL_ERROR', '获取逾期节点失败', 500);
  }
});

export default router;
