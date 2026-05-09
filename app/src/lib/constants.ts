// ═══════════════════════════════════════════════════
// 常量定义
// ═══════════════════════════════════════════════════

import type { NodeMeta } from '@/shared';

/** 9大考评节点元数据 */
export const NODE_METADATA: Record<string, NodeMeta> = {
  PLAN_CREATE: {
    type: 'PLAN_CREATE',
    label: '制定计划',
    description: '每季度初上报当季度考核计划',
    deadlineDays: -10,
    isMandatory: false,
  },
  REGISTRATION: {
    type: 'REGISTRATION',
    label: '考试报名',
    description: '完成考生资料初审并上报',
    deadlineDays: -7,
    isMandatory: false,
  },
  ROOM_ARRANGE: {
    type: 'ROOM_ARRANGE',
    label: '考场编排',
    description: '完成考场编排与考评员派遣',
    deadlineDays: -5,
    isMandatory: false,
  },
  EXAM_PREPARE: {
    type: 'EXAM_PREPARE',
    label: '考务安排',
    description: '做好保密及留痕工作',
    deadlineDays: -5,
    isMandatory: false,
  },
  EXAM_DAY: {
    type: 'EXAM_DAY',
    label: '考试',
    description: '考试当天，做好考评及留痕工作',
    deadlineDays: 0,
    isMandatory: true,
  },
  SCORE_RECORD: {
    type: 'SCORE_RECORD',
    label: '成绩检录',
    description: '考评员阅卷后成绩上报总部',
    deadlineDays: 3,
    isMandatory: true,
  },
  SCORE_PUBLISH: {
    type: 'SCORE_PUBLISH',
    label: '成绩公示',
    description: '公示期不少于5个工作日',
    deadlineDays: 5,
    isMandatory: true,
  },
  CERT_MANAGE: {
    type: 'CERT_MANAGE',
    label: '证书管理',
    description: '完成上传数据填报',
    deadlineDays: 10,
    isMandatory: true,
  },
  COMPLETE: {
    type: 'COMPLETE',
    label: '完成认定',
    description: '做好档案封存、留痕工作',
    deadlineDays: 10,
    isMandatory: true,
  },
};

/** 节点类型排序 */
export const NODE_ORDER: string[] = [
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

/** 计划状态标签 */
export const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '已审批',
  REJECTED: '已驳回',
  PUBLISHED: '已发布',
  CANCELLED: '已取消',
};

/** 节点状态标签 */
export const NODE_STATUS_LABELS: Record<string, string> = {
  PENDING: '待执行',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  OVERDUE: '已逾期',
  SKIPPED: '已跳过',
};

/** 用户角色标签 */
export const ROLE_LABELS: Record<string, string> = {
  SYS_ADMIN: '系统管理员',
  HQ_ADMIN: '总部管理员',
  HQ_STAFF: '总部工作人员',
  BRANCH_ADMIN: '分支管理员',
  BRANCH_STAFF: '分支工作人员',
  EXAMINER: '考评员',
  INSPECTOR: '质量督导员',
};

/** 节点状态颜色 */
export const NODE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700 border-gray-300',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-300',
  COMPLETED: 'bg-green-50 text-green-700 border-green-300',
  OVERDUE: 'bg-red-50 text-red-700 border-red-300',
  SKIPPED: 'bg-yellow-50 text-yellow-700 border-yellow-300',
};

/** 分页默认值 */
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
