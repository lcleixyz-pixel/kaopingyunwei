// ═══════════════════════════════════════════════════
// 仪表盘路由 — 数据聚合
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import {
  canReadAcrossTenants,
  planTenantWhereForRead,
  publishedPlanWhereForRead,
  tenantWhereForRead,
} from '../services/accessScope.js';
import { normalizeLevelLabel } from '../services/phase1Rules.js';
import { calculateDashboardPlanMetrics } from '../services/dashboardPlanMetrics.js';
import { formatDashboardActivities } from '../services/dashboardActivities.js';

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

    const planScope = planTenantWhereForRead(req);
    const workflowPlanScope = publishedPlanWhereForRead(req);
    const tenantScope = tenantWhereForRead(req);
    const now = new Date();

    const [
      plans,
      overdueNodes,
      inProgressNodes,
      riskPlanRows,
      totalCandidates,
      pendingReminders,
    ] = await Promise.all([
      prisma.examPlan.findMany({
        where: planScope,
        select: {
          id: true,
          status: true,
          examDate: true,
          nodes: {
            where: { nodeType: 'COMPLETE', status: 'COMPLETED' },
            select: { id: true },
            take: 1,
          },
        },
      }),
      prisma.examNode.count({
        where: {
          plan: workflowPlanScope,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deadline: { lt: now },
        },
      }),
      prisma.examNode.count({
        where: {
          plan: workflowPlanScope,
          status: 'IN_PROGRESS',
        },
      }),
      prisma.examNode.findMany({
        where: {
          plan: workflowPlanScope,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deadline: { lt: now },
        },
        distinct: ['planId'],
        select: { planId: true },
      }),
      prisma.candidate.count({
        where: tenantScope,
      }),
      prisma.reminder.count({
        where: {
          status: 'PENDING',
          node: { plan: workflowPlanScope },
        },
      }),
    ]);

    const planMetrics = calculateDashboardPlanMetrics(
      plans.map((plan) => ({
        id: plan.id,
        status: plan.status,
        examDate: plan.examDate,
        isComplete: plan.nodes.length > 0,
      })),
      riskPlanRows.map((row) => row.planId),
      now
    );
    const completedPlans = plans.filter((plan) => plan.nodes.length > 0).length;

    const auditLogs = await prisma.auditLog.findMany({
      where: canReadAcrossTenants(req.userRole) ? {} : { tenantId },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { realName: true, username: true },
        },
      },
    });

    const recentActivities = formatDashboardActivities(auditLogs);

    success(res, {
      totalPlans: plans.length,
      activePlans: planMetrics.preExamPlans + planMetrics.postExamPlans,
      completedPlans,
      overdueNodes,
      pendingNodes: inProgressNodes,
      draftPlans: planMetrics.draftPlans,
      publishedPlans: planMetrics.publishedPlans,
      preExamPlans: planMetrics.preExamPlans,
      postExamPlans: planMetrics.postExamPlans,
      riskPlans: planMetrics.riskPlans,
      pendingReminders,
      totalCandidates,
      totalBranches: canReadAcrossTenants(req.userRole)
        ? await prisma.tenant.count({ where: { type: 'BRANCH' } })
        : 1,
      recentActivities,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    error(res, 'INTERNAL_ERROR', '获取仪表盘数据失败', 500);
  }
});

/**
 * GET /api/dashboard/reports — 轻量报表统计
 */
router.get('/reports', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      error(res, 'UNAUTHORIZED', '未授权', 401);
      return;
    }

    const plans = await prisma.examPlan.findMany({
      where: publishedPlanWhereForRead(req),
      include: {
        candidates: {
          include: { score: true },
        },
        nodes: true,
      },
    });

    const byProfession = new Map<string, ReportRow>();
    const byQuarter = new Map<string, ReportRow>();

    for (const plan of plans) {
      const professionKey = `${plan.profession}${normalizeLevelLabel(plan.level)}`;
      const quarterKey = getQuarterKey(plan.examDate);
      const candidateCount = plan.candidates.length;
      const passCount = plan.candidates.filter((candidate) => candidate.score?.isPass || candidate.status === 'PASSED').length;
      const overdueCount = plan.nodes.filter((node) => (
        node.status !== 'COMPLETED' && node.deadline < new Date()
      )).length;

      addReportRow(byProfession, professionKey, candidateCount, passCount, overdueCount);
      addReportRow(byQuarter, quarterKey, candidateCount, passCount, overdueCount);
    }

    success(res, {
      byProfession: Array.from(byProfession.values()),
      byQuarter: Array.from(byQuarter.values()).sort((a, b) => a.label.localeCompare(b.label)),
    });
  } catch (err) {
    console.error('Dashboard reports error:', err);
    error(res, 'INTERNAL_ERROR', '获取报表统计失败', 500);
  }
});

export default router;

interface ReportRow {
  label: string;
  planCount: number;
  candidateCount: number;
  passCount: number;
  overdueNodes: number;
}

function addReportRow(
  map: Map<string, ReportRow>,
  label: string,
  candidateCount: number,
  passCount: number,
  overdueNodes: number
): void {
  const current = map.get(label) || {
    label,
    planCount: 0,
    candidateCount: 0,
    passCount: 0,
    overdueNodes: 0,
  };

  current.planCount += 1;
  current.candidateCount += candidateCount;
  current.passCount += passCount;
  current.overdueNodes += overdueNodes;
  map.set(label, current);
}

function getQuarterKey(date: Date): string {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `${date.getFullYear()} Q${quarter}`;
}
