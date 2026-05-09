// ═══════════════════════════════════════════════════
// 提醒路由 — 节点提醒列表与已读处理
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { canReadAcrossTenants } from '../services/accessScope.js';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const where: any = {
      node: { plan: canReadAcrossTenants(req.userRole) ? {} : { tenantId } },
    };

    if (!canReadAcrossTenants(req.userRole) && req.userRole !== 'BRANCH_ADMIN') {
      where.userId = req.userId;
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const reminders = await prisma.reminder.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        node: {
          include: {
            plan: {
              select: { id: true, title: true, examDate: true },
            },
          },
        },
      },
    });

    success(res, reminders);
  } catch (err) {
    console.error('Get reminders error:', err);
    error(res, 'INTERNAL_ERROR', '获取提醒失败', 500);
  }
});

router.get('/count', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const where: any = {
      status: 'PENDING',
      node: { plan: canReadAcrossTenants(req.userRole) ? {} : { tenantId } },
    };

    if (!canReadAcrossTenants(req.userRole) && req.userRole !== 'BRANCH_ADMIN') {
      where.userId = req.userId;
    }

    const count = await prisma.reminder.count({ where });
    success(res, { count });
  } catch (err) {
    console.error('Get reminder count error:', err);
    error(res, 'INTERNAL_ERROR', '获取提醒数量失败', 500);
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const id = String(req.params.id);

    const reminder = await prisma.reminder.findFirst({
      where: {
        id,
        node: { plan: canReadAcrossTenants(req.userRole) ? {} : { tenantId } },
      },
    });

    if (!reminder) {
      error(res, 'NOT_FOUND', '提醒不存在', 404);
      return;
    }

    if (reminder.userId !== req.userId && !canReadAcrossTenants(req.userRole) && req.userRole !== 'BRANCH_ADMIN') {
      error(res, 'FORBIDDEN', '无权限处理该提醒', 403);
      return;
    }

    const updatedReminder = await prisma.reminder.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    success(res, updatedReminder);
  } catch (err) {
    console.error('Mark reminder read error:', err);
    error(res, 'INTERNAL_ERROR', '处理提醒失败', 500);
  }
});

export default router;
