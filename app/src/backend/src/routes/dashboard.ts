// ═══════════════════════════════════════════════════
// 仪表盘路由 — 数据聚合
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/dashboard — 仪表盘数据聚合
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      error(res, 'UNAUTHORIZED', '未授权', 401);
      return;
    }

    // 统计当前租户的数据
    const totalPlans = await prisma.examPlan.count({
      where: { tenantId },
    });
    
    const activePlans = await prisma.examPlan.count({
      where: {
        tenantId,
        status: { in: ['PENDING', 'APPROVED', 'PUBLISHED'] },
      },
    });
    
    const completedPlans = await prisma.examPlan.count({
      where: {
        tenantId,
        status: { in: ['APPROVED', 'PUBLISHED'] },
      },
    });

    const overdueNodes = await prisma.examNode.count({
      where: {
        plan: { tenantId },
        status: 'OVERDUE',
      },
    });

    const pendingNodes = await prisma.examNode.count({
      where: {
        plan: { tenantId },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    const totalCandidates = await prisma.candidate.count({
      where: { tenantId },
    });

    // 最近动态（模拟）
    const recentActivities = [
      { id: '1', type: 'NODE_OVERDUE', title: '节点逾期提醒', description: '成绩检录节点已逾期', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: '2', type: 'NODE_COMPLETE', title: '节点已完成', description: '证书管理节点已完成', timestamp: new Date(Date.now() - 86400000).toISOString() },
      { id: '3', type: 'PLAN_CREATE', title: '新计划创建', description: 'Q3钳工认定计划已创建', timestamp: new Date(Date.now() - 172800000).toISOString() },
      { id: '4', type: 'CANDIDATE_REGISTER', title: '新考生报名', description: '15名考生报名参加认定', timestamp: new Date(Date.now() - 259200000).toISOString() },
    ];

    success(res, {
      totalPlans,
      activePlans,
      completedPlans,
      overdueNodes,
      pendingNodes,
      totalCandidates,
      totalBranches: 1, // 后续从租户统计
      recentActivities,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    error(res, 'INTERNAL_ERROR', '获取仪表盘数据失败', 500);
  }
});

export default router;
