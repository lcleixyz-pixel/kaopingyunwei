// ═══════════════════════════════════════════════════
// 共享类型定义 — 前后端通用
// ═══════════════════════════════════════════════════

// ─── 通用响应格式 ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

// ─── 租户 ───
export type TenantType = 'HQ' | 'BRANCH';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface Tenant {
  id: string;
  code: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 用户 ───
export type UserRole = 'SYS_ADMIN' | 'HQ_ADMIN' | 'HQ_STAFF' | 'BRANCH_ADMIN' | 'BRANCH_STAFF' | 'EXAMINER' | 'INSPECTOR';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface User {
  id: string;
  tenantId: string;
  tenant?: Tenant;
  username: string;
  realName: string;
  role: UserRole;
  phone?: string;
  email?: string;
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 考评计划 ───
export type ExamType = 'THEORY' | 'PRACTICE' | 'COMPREHENSIVE';
export type PlanStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'CANCELLED';

export interface ExamPlan {
  id: string;
  tenantId: string;
  tenant?: Tenant;
  title: string;
  examDate: string;
  profession: string;
  level: string;
  examType: ExamType;
  location: string;
  maxCandidates: number;
  status: PlanStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 考评节点（核心业务） ───
export type NodeType =
  | 'PLAN_CREATE'
  | 'REGISTRATION'
  | 'ROOM_ARRANGE'
  | 'EXAM_PREPARE'
  | 'EXAM_DAY'
  | 'SCORE_RECORD'
  | 'SCORE_PUBLISH'
  | 'CERT_MANAGE'
  | 'COMPLETE';

export type NodeStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';

export interface ExamNode {
  id: string;
  planId: string;
  plan?: ExamPlan;
  nodeType: NodeType;
  deadline: string;
  completedAt?: string;
  status: NodeStatus;
  assignedTo?: string;
  notes?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

// 节点元数据（前端展示用）
export interface NodeMeta {
  type: NodeType;
  label: string;
  description: string;
  deadlineDays: number;  // 相对考试日期的天数（考前为负，考后为正）
  isMandatory: boolean;  // 是否强制执行
}

// ─── 考生 ───
export type CandidateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXAMINED' | 'PASSED' | 'FAILED';

export interface Candidate {
  id: string;
  tenantId: string;
  planId: string;
  name: string;
  idCard: string;
  phone?: string;
  gender: string;
  education?: string;
  workYears?: number;
  photo?: string;
  applyLevel: string;
  status: CandidateStatus;
  examRoom?: string;
  seatNo?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 成绩 ───
export interface Score {
  id: string;
  candidateId: string;
  candidate?: Candidate;
  theoryScore?: number;
  practiceScore?: number;
  totalScore?: number;
  isPass: boolean;
  evaluatedBy?: string;
  verifiedBy?: string;
  evaluatedAt?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 证书 ───
export type CertStatus = 'PENDING' | 'PRINTED' | 'ISSUED' | 'REISSUE_REQUESTED';

export interface Certificate {
  id: string;
  candidateId: string;
  candidate?: Candidate;
  certNo: string;
  issueDate?: string;
  status: CertStatus;
  issuedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 档案 ───
export type ArchiveStatus = 'SEALED' | 'OPENED';

export interface Archive {
  id: string;
  planId: string;
  plan?: ExamPlan;
  filePath: string;
  fileSize: number;
  sealHash: string;
  status: ArchiveStatus;
  createdAt: string;
}

// ─── 提醒 ───
export type ReminderType = 'NODE_START' | 'NODE_DEADLINE' | 'NODE_OVERDUE' | 'SYSTEM_NOTICE';
export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface Reminder {
  id: string;
  nodeId: string;
  userId: string;
  user?: User;
  type: ReminderType;
  content: string;
  scheduledAt: string;
  sentAt?: string;
  channel: string;
  status: ReminderStatus;
  createdAt: string;
}

// ─── 审计日志 ───
export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  user?: User;
  action: string;
  target: string;
  targetId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  createdAt: string;
}

// ─── 仪表盘数据 ───
export interface DashboardStats {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  overdueNodes: number;
  pendingNodes: number;
  totalCandidates: number;
  totalBranches: number;
  recentActivities: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'NODE_COMPLETE' | 'NODE_OVERDUE' | 'PLAN_CREATE' | 'CANDIDATE_REGISTER' | 'SCORE_RECORD' | 'SYSTEM';
  title: string;
  description: string;
  timestamp: string;
  userName?: string;
}

// ─── AI运维 ───
export interface HealthStatus {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  database: { status: string; latency: number };
  disk: { used: number; total: number; percent: number };
  memory: { used: number; total: number; percent: number };
  uptime: number;
  version: string;
}

export interface BackupInfo {
  id: string;
  type: 'FULL' | 'DATA';
  size: number;
  createdAt: string;
  status: 'SUCCESS' | 'FAILED';
}

// ─── 认证 ───
export interface LoginRequest {
  username: string;
  password: string;
  tenantCode?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  tenant: Tenant;
}
