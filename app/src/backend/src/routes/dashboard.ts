// ═══════════════════════════════════════════════════
// 仪表盘路由 — 数据聚合
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { canReadAcrossTenants, planTenantWhereForRead, tenantWhereForRead } from '../services/accessScope.js';
import { normalizeLevelLabel } from '../services/phase1Rules.js';

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
    const tenantScope = tenantWhereForRead(req);

    const totalPlans = await prisma.examPlan.count({
      where: planScope,
    });
    
    const activePlans = await prisma.examPlan.count({
      where: {
        ...planScope,
        status: 'PUBLISHED',
      },
    });
    
    const completedPlans = await prisma.examPlan.count({
      where: {
        ...planScope,
        status: 'PUBLISHED',
      },
    });

    const overdueNodes = await prisma.examNode.count({
      where: {
        plan: planScope,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        deadline: { lt: new Date() },
      },
    });

    const pendingNodes = await prisma.examNode.count({
      where: {
        plan: planScope,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    const totalCandidates = await prisma.candidate.count({
      where: tenantScope,
    });

    const pendingReminders = await prisma.reminder.count({
      where: {
        status: 'PENDING',
        node: { plan: planScope },
      },
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: canReadAcrossTenants(req.userRole) ? {} : { tenantId },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { realName: true, username: true },
        },
      },
    });

    const recentActivities = auditLogs.map((log: any) => ({
      id: log.id,
      type: mapAuditActionToActivityType(log.action),
      title: mapAuditActionToTitle(log.action),
      description: `${log.target}${log.targetId ? ` #${log.targetId.slice(0, 8)}` : ''}`,
      timestamp: log.createdAt.toISOString(),
      userName: log.user?.realName || log.user?.username,
    }));

    success(res, {
      totalPlans,
      activePlans,
      completedPlans,
      overdueNodes,
      pendingNodes,
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
      where: planTenantWhereForRead(req),
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

function mapAuditActionToActivityType(action: string): string {
  if (action.includes('NODE')) return action.includes('COMPLETE') ? 'NODE_COMPLETE' : 'NODE_OVERDUE';
  if (action.includes('PLAN')) return 'PLAN_CREATE';
  if (action.includes('CANDIDATE')) return 'CANDIDATE_REGISTER';
  if (action.includes('SCORE')) return 'SCORE_RECORD';
  return 'SYSTEM';
}

function mapAuditActionToTitle(action: string): string {
  const labels: Record<string, string> = {
    EXAM_PLAN_CREATE: '新计划创建',
    EXAM_PLAN_APPROVE: '计划审批',
    EXAM_NODE_COMPLETE: '节点已完成',
    CANDIDATE_CREATE: '新考生报名',
    CANDIDATE_APPROVE: '考生审核',
    SCORE_UPSERT: '成绩录入',
    SCORE_VERIFY: '成绩复核',
    CERTIFICATE_CREATE: '证书生成',
    CERTIFICATE_STATUS_UPDATE: '证书状态更新',
    ARCHIVE_SEAL: '档案封存',
    ARCHIVE_STATUS_UPDATE: '档案状态更新',
    BACKUP_CREATE: '数据备份',
    RESTORE_BACKUP: '数据恢复',
    EXPORT_CREATE: '迁移包导出',
    SETTINGS_UPDATE: '系统设置更新',
  };

  return labels[action] || action;
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
