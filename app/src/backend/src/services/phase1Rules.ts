import type { NodeStatus, NodeType, PlanStatus, UserRole } from '@prisma/client';

const BRANCH_NODE_OPERATORS: UserRole[] = ['BRANCH_ADMIN', 'BRANCH_STAFF'];
const HEADQUARTERS_READ_ONLY_ROLES: UserRole[] = ['HQ_ADMIN', 'HQ_STAFF'];
const PRECIOUS_METAL_AND_GEMSTONE_OCCUPATION = '贵金属首饰与宝玉石检测员';
const ENTRY_LEVEL_WORK_TYPE = '贵金属首饰与宝玉石检测员';
const ADVANCED_WORK_TYPES = [
  '贵金属首饰检验员',
  '钻石检验员',
  '宝石检验员',
  '玉石检验员',
  '有机宝石检验员',
] as const;

export const LEVEL_OPTIONS = ['一级/高级技师', '二级/技师', '三级/高级工', '四级/中级工', '五级/初级工'] as const;

export const OCCUPATION_OPTIONS = [
  {
    occupation: PRECIOUS_METAL_AND_GEMSTONE_OCCUPATION,
    workTypes: [
      ENTRY_LEVEL_WORK_TYPE,
      ...ADVANCED_WORK_TYPES,
    ],
  },
  {
    occupation: '首饰设计师',
    workTypes: ['首饰设计师'],
  },
] as const;

export interface PublishNodeInput {
  id: string;
  nodeType: NodeType;
  status: NodeStatus;
}

export interface PublishNodeUpdate {
  id: string;
  status: NodeStatus;
  shouldStampCompletedAt?: boolean;
  notes?: string;
}

export interface RegistrationNodeLike {
  nodeType: string;
  status: string;
}

export type CancelPlanBlockReason =
  | 'PUBLISHED_PLAN_MUST_ROLLBACK_FIRST'
  | 'PLAN_HAS_CANDIDATES'
  | 'CANCEL_REASON_REQUIRED'
  | 'INVALID_PLAN_STATUS';

export interface CancelPlanCheckInput {
  status: PlanStatus;
  candidateCount: number;
  reason?: string | null;
}

export function getInitialPlanStatus(_role: UserRole): PlanStatus {
  return 'DRAFT';
}

export function isHeadquartersReadOnlyRole(role: string): boolean {
  return HEADQUARTERS_READ_ONLY_ROLES.includes(role as UserRole);
}

export function canCompleteNode(role: string): boolean {
  return BRANCH_NODE_OPERATORS.includes(role as UserRole);
}

export function getPublishNodeStatuses(nodes: PublishNodeInput[]): PublishNodeUpdate[] {
  let activatedRegistrationNode = false;

  return nodes.map((node) => {
    if (node.status === 'COMPLETED') {
      return { id: node.id, status: 'COMPLETED' };
    }

    if (node.nodeType === 'PLAN_CREATE') {
      return {
        id: node.id,
        status: 'COMPLETED',
        shouldStampCompletedAt: true,
        notes: '计划发布时自动登记制定计划节点完成',
      };
    }

    if (!activatedRegistrationNode && node.nodeType === 'REGISTRATION') {
      activatedRegistrationNode = true;
      return { id: node.id, status: 'IN_PROGRESS' };
    }

    return { id: node.id, status: 'PENDING' };
  });
}

export function canAddCandidateToPlan(status: PlanStatus, registrationClosed = false): boolean {
  return status === 'PUBLISHED' && !registrationClosed;
}

export function isRegistrationClosed(nodes: RegistrationNodeLike[]): boolean {
  return nodes.some((node) => node.nodeType === 'REGISTRATION' && node.status === 'COMPLETED');
}

export function canRollbackPlan(status: PlanStatus): boolean {
  return status === 'PUBLISHED';
}

export function getCancelPlanBlockReason(input: CancelPlanCheckInput): CancelPlanBlockReason | null {
  if (input.status === 'PUBLISHED') return 'PUBLISHED_PLAN_MUST_ROLLBACK_FIRST';
  if (input.status !== 'DRAFT') return 'INVALID_PLAN_STATUS';
  if (input.candidateCount > 0) return 'PLAN_HAS_CANDIDATES';
  if (!input.reason?.trim()) return 'CANCEL_REASON_REQUIRED';
  return null;
}

export function isCorePlanField(field: string): boolean {
  return ['title', 'occupation', 'profession', 'level', 'examDate', 'registrationDeadline', 'location', 'maxCandidates'].includes(field);
}

export function getWorkTypesForOccupation(occupation: string, level?: string): string[] {
  if (occupation === PRECIOUS_METAL_AND_GEMSTONE_OCCUPATION) {
    const normalizedLevel = normalizeLevelLabel(level || '');
    if (normalizedLevel === '五级/初级工') return [ENTRY_LEVEL_WORK_TYPE];
    if (normalizedLevel) return [...ADVANCED_WORK_TYPES];
  }

  return OCCUPATION_OPTIONS.find((item) => item.occupation === occupation)?.workTypes.slice() || [];
}

export function normalizeLevelLabel(value?: string | null): string {
  if (!value) return '';
  const text = String(value).trim();
  if (LEVEL_OPTIONS.includes(text as typeof LEVEL_OPTIONS[number])) return text;
  const clean = text.replace(/级/g, '').trim();
  const labels: Record<string, string> = {
    '1': '一级/高级技师',
    '2': '二级/技师',
    '3': '三级/高级工',
    '4': '四级/中级工',
    '5': '五级/初级工',
  };
  return labels[clean] || text;
}
