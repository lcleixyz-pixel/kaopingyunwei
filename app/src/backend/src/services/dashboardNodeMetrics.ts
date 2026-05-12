import type { Prisma } from '@prisma/client';

type DashboardNodeMetricRow = {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';
  deadline: Date;
};

export function isDashboardOverdueNode(node: DashboardNodeMetricRow, now = new Date()): boolean {
  if (node.status === 'COMPLETED' || node.status === 'SKIPPED') return false;
  return node.status === 'OVERDUE' || node.deadline.getTime() < now.getTime();
}

export function dashboardOverdueNodeWhere(now = new Date()): Prisma.ExamNodeWhereInput {
  return {
    OR: [
      { status: 'OVERDUE' },
      {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        deadline: { lt: now },
      },
    ],
  };
}
