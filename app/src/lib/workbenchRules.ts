import type {
  Candidate,
  DashboardStats,
  ExamNode,
  ExamPlan,
  NodeStatus,
  NodeType,
  ProspectiveCandidate,
  UserRole,
} from '../shared';

type WorkbenchPlan = Pick<ExamPlan, 'id' | 'status' | 'title' | 'examDate' | 'registrationDeadline' | 'registrationClosed'>;
type WorkbenchNode = Pick<ExamNode, 'id' | 'planId' | 'nodeType' | 'status' | 'deadline' | 'isOverdue'>;
type RegistrationCandidate = Pick<Candidate, 'id' | 'status' | 'registrationProfile'>;
type ProspectRow = Pick<ProspectiveCandidate, 'id' | 'phone' | 'status'>;

export type WorkbenchTaskTone = 'critical' | 'warning' | 'primary' | 'success' | 'neutral';

export interface WorkbenchTask {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: WorkbenchTaskTone;
  priority: number;
  count?: number;
}

export interface BranchWorkbenchInput {
  stats?: DashboardStats | null;
  plans?: WorkbenchPlan[];
  nodes?: WorkbenchNode[];
  now?: Date;
}

export interface PlanStageSummary {
  totalPublished: number;
  registrationOpen: number;
  registrationClosed: number;
  registrationClosingSoon: number;
  draft: number;
  nextExamPlan?: WorkbenchPlan;
}

export interface CandidateRegistrationSummary {
  total: number;
  templateIncomplete: number;
  materialIncomplete: number;
  pendingReview: number;
  approved: number;
  unpaid: number;
  exportEligible: number;
}

export interface ProspectSummary {
  total: number;
  following: number;
  converted: number;
  notInterested: number;
  duplicatePhones: string[];
}

const BRANCH_ROLES: UserRole[] = ['BRANCH_ADMIN', 'BRANCH_STAFF'];
const NODE_ORDER: NodeType[] = [
  'PLAN_CREATE',
  'REGISTRATION',
  'ROOM_ARRANGE',
  'EXAM_PREPARE',
  'EXAM_DAY',
  'SCORE_RECORD',
  'SCORE_PUBLISH',
  'CERT_MANAGE',
  'COMPLETE',
];
const NODE_LABELS: Record<NodeType, string> = {
  PLAN_CREATE: '制定计划',
  REGISTRATION: '考试报名',
  ROOM_ARRANGE: '考场编排',
  EXAM_PREPARE: '考务安排',
  EXAM_DAY: '考试',
  SCORE_RECORD: '成绩检录',
  SCORE_PUBLISH: '成绩公示',
  CERT_MANAGE: '证书管理',
  COMPLETE: '完成认定',
};
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function isBranchRole(role?: UserRole | string | null): boolean {
  return BRANCH_ROLES.includes(role as UserRole);
}

export function getPlanStageSummary(plans: WorkbenchPlan[] = [], now = new Date()): PlanStageSummary {
  const published = plans.filter((plan) => plan.status === 'PUBLISHED');
  const registrationOpenPlans = published.filter((plan) => !plan.registrationClosed);
  const futureOrCurrentPlans = published
    .filter((plan) => new Date(plan.examDate).getTime() >= startOfDay(now).getTime())
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());

  return {
    totalPublished: published.length,
    registrationOpen: registrationOpenPlans.length,
    registrationClosed: published.length - registrationOpenPlans.length,
    registrationClosingSoon: registrationOpenPlans.filter((plan) => isDateWithinDays(plan.registrationDeadline, now, 7)).length,
    draft: plans.filter((plan) => plan.status === 'DRAFT').length,
    nextExamPlan: futureOrCurrentPlans[0],
  };
}

export function deriveBranchWorkbenchTasks(input: BranchWorkbenchInput): WorkbenchTask[] {
  const now = input.now || new Date();
  const nodes = input.nodes || [];
  const plans = input.plans || [];
  const stats = input.stats;
  const planSummary = getPlanStageSummary(plans, now);
  const overdueNodes = nodes.filter((node) => isNodeOverdue(node, now));
  const inProgressNodes = nodes.filter((node) => node.status === 'IN_PROGRESS' && !isNodeOverdue(node, now));
  const scoreRecordNodes = nodes.filter((node) => (
    node.nodeType === 'SCORE_RECORD'
    && node.status !== 'COMPLETED'
    && node.status !== 'SKIPPED'
  ));
  const tasks: WorkbenchTask[] = [];

  if (overdueNodes.length > 0 || (stats?.overdueNodes || 0) > 0) {
    tasks.push({
      id: 'overdue-nodes',
      title: '处理逾期节点',
      description: `有 ${Math.max(overdueNodes.length, stats?.overdueNodes || 0)} 个节点已超过截止时间，先补录完成情况或异常说明。`,
      href: '/nodes',
      actionLabel: '查看节点',
      tone: 'critical',
      priority: 10,
      count: Math.max(overdueNodes.length, stats?.overdueNodes || 0),
    });
  }

  if (scoreRecordNodes.length > 0) {
    tasks.push({
      id: 'score-recording',
      title: '完成成绩检录',
      description: `有 ${scoreRecordNodes.length} 个计划进入成绩检录，先导入预览、核对未完成项，再结束节点。`,
      href: '/scores',
      actionLabel: '去检录',
      tone: scoreRecordNodes.some((node) => isNodeOverdue(node, now)) ? 'critical' : 'warning',
      priority: 20,
      count: scoreRecordNodes.length,
    });
  }

  if (planSummary.registrationClosingSoon > 0) {
    tasks.push({
      id: 'registration-closing-soon',
      title: '报名即将截止',
      description: `${planSummary.registrationClosingSoon} 个计划 7 天内截止，核对模板资料、材料、审核和导出状态。`,
      href: '/candidates',
      actionLabel: '处理资料',
      tone: 'warning',
      priority: 30,
      count: planSummary.registrationClosingSoon,
    });
  }

  if (planSummary.registrationOpen > 0) {
    tasks.push({
      id: 'registration-open',
      title: '推进报名资料',
      description: `当前 ${planSummary.registrationOpen} 个计划仍可报名，可继续从意向考生转正式并整理资料。`,
      href: '/candidates',
      actionLabel: '继续处理',
      tone: 'primary',
      priority: 40,
      count: planSummary.registrationOpen,
    });
  }

  if (inProgressNodes.length > 0 || (stats?.pendingNodes || 0) > 0) {
    tasks.push({
      id: 'in-progress-nodes',
      title: '跟进进行中节点',
      description: `还有 ${Math.max(inProgressNodes.length, stats?.pendingNodes || 0)} 个节点需要持续跟进。`,
      href: '/nodes',
      actionLabel: '看时间线',
      tone: 'neutral',
      priority: 50,
      count: Math.max(inProgressNodes.length, stats?.pendingNodes || 0),
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: 'steady-state',
      title: '今日暂无高优先级待办',
      description: '可以检查即将报名截止的计划，或维护意向考生池，为下一批认定做准备。',
      href: '/plans',
      actionLabel: '查看计划',
      tone: 'success',
      priority: 90,
    });
  }

  return dedupeTasks(tasks).sort((a, b) => a.priority - b.priority);
}

export function summarizeCandidateRegistration(candidates: RegistrationCandidate[] = []): CandidateRegistrationSummary {
  return candidates.reduce<CandidateRegistrationSummary>((summary, candidate) => {
    const completeness = candidate.registrationProfile?.completeness;
    const paymentStatus = candidate.registrationProfile?.paymentStatus;
    summary.total += 1;
    if (!completeness?.templateComplete) summary.templateIncomplete += 1;
    if (!completeness?.materialComplete) summary.materialIncomplete += 1;
    if (candidate.status === 'PENDING') summary.pendingReview += 1;
    if (candidate.status === 'APPROVED') summary.approved += 1;
    if (paymentStatus && paymentStatus !== 'PAID') summary.unpaid += 1;
    if (candidate.status === 'APPROVED' && completeness?.isEligible) summary.exportEligible += 1;
    return summary;
  }, {
    total: 0,
    templateIncomplete: 0,
    materialIncomplete: 0,
    pendingReview: 0,
    approved: 0,
    unpaid: 0,
    exportEligible: 0,
  });
}

export function summarizeProspects(candidates: ProspectRow[] = []): ProspectSummary {
  const phones = new Map<string, number>();
  const summary = candidates.reduce<ProspectSummary>((current, candidate) => {
    current.total += 1;
    if (candidate.status === 'FOLLOWING') current.following += 1;
    if (candidate.status === 'CONVERTED') current.converted += 1;
    if (candidate.status === 'NOT_INTERESTED') current.notInterested += 1;
    const phone = candidate.phone.trim();
    if (phone) phones.set(phone, (phones.get(phone) || 0) + 1);
    return current;
  }, {
    total: 0,
    following: 0,
    converted: 0,
    notInterested: 0,
    duplicatePhones: [],
  });

  summary.duplicatePhones = Array.from(phones.entries())
    .filter(([, count]) => count > 1)
    .map(([phone]) => phone);
  return summary;
}

export function getCurrentNode(nodes: WorkbenchNode[] = [], now = new Date()): WorkbenchNode | undefined {
  return orderNodes(nodes, now).find((node) => node.status === 'IN_PROGRESS')
    || orderNodes(nodes, now).find((node) => node.status !== 'COMPLETED' && node.status !== 'SKIPPED');
}

export function getNextNode(nodes: WorkbenchNode[] = [], now = new Date()): WorkbenchNode | undefined {
  const orderedNodes = orderNodes(nodes, now);
  const currentNode = getCurrentNode(orderedNodes, now);
  if (!currentNode) return undefined;
  const index = orderedNodes.findIndex((node) => node.id === currentNode.id);
  return orderedNodes.slice(index + 1).find((node) => node.status !== 'COMPLETED' && node.status !== 'SKIPPED');
}

export function getNodeLabel(nodeType?: NodeType | string): string {
  return NODE_LABELS[nodeType as NodeType] || String(nodeType || '待确认');
}

export function getNodeTone(status: NodeStatus | 'OVERDUE', isOverdue?: boolean): WorkbenchTaskTone {
  if (isOverdue || status === 'OVERDUE') return 'critical';
  if (status === 'IN_PROGRESS') return 'primary';
  if (status === 'COMPLETED') return 'success';
  return 'neutral';
}

function orderNodes(nodes: WorkbenchNode[], now: Date): WorkbenchNode[] {
  return nodes
    .slice()
    .sort((a, b) => NODE_ORDER.indexOf(a.nodeType) - NODE_ORDER.indexOf(b.nodeType))
    .map((node) => ({ ...node, isOverdue: isNodeOverdue(node, now) }));
}

function isNodeOverdue(node: WorkbenchNode, now: Date): boolean {
  if (node.status === 'COMPLETED' || node.status === 'SKIPPED') return false;
  return node.isOverdue === true || new Date(node.deadline).getTime() < now.getTime();
}

function isDateWithinDays(value: string, now: Date, days: number): boolean {
  const date = new Date(value).getTime();
  const today = startOfDay(now).getTime();
  return date >= today && date <= today + days * ONE_DAY_MS;
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dedupeTasks(tasks: WorkbenchTask[]): WorkbenchTask[] {
  const byId = new Map<string, WorkbenchTask>();
  tasks.forEach((task) => {
    if (!byId.has(task.id)) byId.set(task.id, task);
  });
  return Array.from(byId.values());
}
