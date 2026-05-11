type ActivityType = 'NODE_COMPLETE' | 'NODE_OVERDUE' | 'PLAN_CREATE' | 'CANDIDATE_REGISTER' | 'SCORE_RECORD' | 'SYSTEM';

interface DashboardActivityLog {
  id: string;
  action: string;
  target: string;
  targetId?: string | null;
  createdAt: Date;
  user?: {
    realName?: string | null;
    username?: string | null;
  } | null;
}

interface DashboardActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  userName?: string;
}

const ACTION_LABELS: Record<string, string> = {
  EXAM_PLAN_CREATE: '新建计划',
  EXAM_PLAN_UPDATE: '更新计划',
  EXAM_PLAN_PUBLISH: '发布计划',
  EXAM_PLAN_ROLLBACK: '回退计划',
  EXAM_PLAN_CANCEL: '取消计划',
  EXAM_PLAN_APPROVE: '计划审批',
  EXAM_NODE_COMPLETE: '完成节点',
  CERTIFICATE_NODE_COMPLETE: '完成证书节点',
  LOCAL_UPLOAD_BATCH_VIEW: '查看回填记录',
  LOCAL_UPLOAD_BATCH_CREATE: '上传回填记录',

  PROSPECTIVE_CANDIDATE_CREATE: '新增意向考生',
  PROSPECTIVE_CANDIDATE_UPDATE: '更新意向考生',
  PROSPECTIVE_CANDIDATE_DELETE: '删除意向考生',
  PROSPECTIVE_CANDIDATE_CONVERT: '转为正式考生',
  CANDIDATE_SENSITIVE_LIST: '查看考生信息',
  CANDIDATE_CREATE: '新增考生',
  CANDIDATE_EXPORT: '导出报名资料',
  CANDIDATE_REGISTRATION_PROFILE_UPDATE: '更新报名资料',
  CANDIDATE_APPROVE: '考生审核通过',
  CANDIDATE_REJECT: '驳回考生',

  SCORE_IMPORT_COMMIT: '确认成绩导入',
  SCORE_BATCH_UPSERT: '批量录入成绩',
  SCORE_UPSERT: '录入成绩',
  SCORE_VERIFY: '复核成绩',

  CERTIFICATE_CREATE: '生成证书',
  CERTIFICATE_RECORD_UPSERT: '更新证书记录',
  CERTIFICATE_IMPORT_COMMIT: '确认本地证书导入',
  CERTIFICATE_RECORD_UPDATE: '编辑证书记录',
  CERTIFICATE_STATUS_UPDATE: '更新证书状态',
  CERTIFICATE_SUPPLY_REQUEST_CREATE: '创建证书申领',
  CERTIFICATE_SUPPLY_RECEIVE: '确认空白证书入库',
  CERTIFICATE_PRINT_RECORD_CREATE: '登记证书打印',
  CERTIFICATE_VOID_RECORD_CREATE: '登记证书作废',
  CERTIFICATE_DESTROY_BATCH_CREATE: '创建证书销毁批次',
  CERTIFICATE_DESTROY_BATCH_CLOSE: '办结证书销毁批次',
  CERTIFICATE_REISSUE_CREATE: '提交证书补发',
  CERTIFICATE_REISSUE_REVIEW: '审核证书补发',
  CERTIFICATE_REISSUE_ISSUE: '发放补发证书',
  CERTIFICATE_STOCKTAKE_CREATE: '登记证书盘点',
  CERTIFICATE_ATTACHMENT_UPLOAD: '上传证书附件',

  ARCHIVE_REPORT_BATCH_CREATE: '创建归档上报',
  ARCHIVE_REPORT_BATCH_UPDATE: '更新归档上报',
  ARCHIVE_REPORT_BATCH_SUBMIT: '提交归档上报',
  ARCHIVE_REPORT_BATCH_APPROVE: '通过归档上报',
  ARCHIVE_REPORT_BATCH_REJECT: '退回归档上报',
  ARCHIVE_SEAL: '封存档案',
  ARCHIVE_STATUS_UPDATE: '更新档案状态',

  EXPORT_TEMPLATE_CREATE: '创建导出模板',
  EXPORT_TEMPLATE_SET_DEFAULT: '设置默认模板',
  EXPORT_TEMPLATE_DELETE: '删除导出模板',
  HQ_REGISTRATION_PROGRESS_REPORT_VIEW: '查看总部报名进度',
  SETTINGS_UPDATE: '更新系统设置',
  WORKDAY_CALENDAR_UPDATE: '更新工作日历',
  USER_CREATE: '新建账号',
  USER_UPDATE: '更新账号',
  USER_PASSWORD_RESET: '重置账号密码',
  BACKUP_CREATE: '创建数据备份',
  RESTORE_BACKUP: '恢复数据备份',
  EXPORT_CREATE: '创建迁移包',
};

const TARGET_LABELS: Record<string, string> = {
  ExamPlan: '考评计划',
  ExamNode: '考评节点',
  LocalUploadBatch: '回填记录',
  ProspectiveCandidate: '意向考生',
  Candidate: '考生',
  CandidateRegistrationProfile: '报名资料',
  Score: '成绩',
  Certificate: '证书',
  CertificateSupplyRequest: '证书申领',
  CertificatePrintRecord: '证书打印记录',
  CertificateVoidRecord: '证书作废记录',
  CertificateDestroyBatch: '证书销毁批次',
  CertificateReissueRequest: '证书补发申请',
  CertificateStocktake: '证书盘点',
  CertificateAttachment: '证书附件',
  ArchiveReportBatch: '归档上报批次',
  Archive: '档案',
  ExportTemplate: '导出模板',
  Report: '报表',
  Config: '系统配置',
  WorkdayCalendar: '工作日历',
  User: '账号',
  Backup: '数据备份',
  ExportPackage: '迁移包',
};

const BUSINESS_PROGRESS_ACTIONS = new Set([
  'EXAM_PLAN_CREATE',
  'EXAM_PLAN_PUBLISH',
  'EXAM_PLAN_ROLLBACK',
  'EXAM_PLAN_CANCEL',
  'EXAM_PLAN_APPROVE',
  'EXAM_NODE_COMPLETE',
  'CERTIFICATE_NODE_COMPLETE',
  'LOCAL_UPLOAD_BATCH_CREATE',

  'PROSPECTIVE_CANDIDATE_CREATE',
  'PROSPECTIVE_CANDIDATE_CONVERT',
  'CANDIDATE_CREATE',
  'CANDIDATE_APPROVE',
  'CANDIDATE_REJECT',

  'SCORE_IMPORT_COMMIT',
  'SCORE_BATCH_UPSERT',
  'SCORE_UPSERT',
  'SCORE_VERIFY',

  'CERTIFICATE_CREATE',
  'CERTIFICATE_RECORD_UPSERT',
  'CERTIFICATE_IMPORT_COMMIT',
  'CERTIFICATE_STATUS_UPDATE',
  'CERTIFICATE_SUPPLY_REQUEST_CREATE',
  'CERTIFICATE_SUPPLY_RECEIVE',
  'CERTIFICATE_PRINT_RECORD_CREATE',
  'CERTIFICATE_VOID_RECORD_CREATE',
  'CERTIFICATE_DESTROY_BATCH_CREATE',
  'CERTIFICATE_DESTROY_BATCH_CLOSE',
  'CERTIFICATE_REISSUE_CREATE',
  'CERTIFICATE_REISSUE_REVIEW',
  'CERTIFICATE_REISSUE_ISSUE',
  'CERTIFICATE_STOCKTAKE_CREATE',

  'ARCHIVE_REPORT_BATCH_CREATE',
  'ARCHIVE_REPORT_BATCH_SUBMIT',
  'ARCHIVE_REPORT_BATCH_APPROVE',
  'ARCHIVE_REPORT_BATCH_REJECT',
  'ARCHIVE_SEAL',
  'ARCHIVE_STATUS_UPDATE',
]);

export function formatDashboardActivities(logs: DashboardActivityLog[], limit = 8): DashboardActivity[] {
  return logs
    .filter((log) => BUSINESS_PROGRESS_ACTIONS.has(log.action))
    .slice(0, limit)
    .map(formatDashboardActivity);
}

export function formatDashboardActivity(log: DashboardActivityLog): DashboardActivity {
  return {
    id: log.id,
    type: mapAuditActionToActivityType(log.action),
    title: getActionLabel(log.action),
    description: getTargetDescription(log.target, log.targetId),
    timestamp: log.createdAt.toISOString(),
    userName: log.user?.realName || log.user?.username || undefined,
  };
}

function mapAuditActionToActivityType(action: string): ActivityType {
  if (action.includes('NODE')) return action.includes('COMPLETE') ? 'NODE_COMPLETE' : 'NODE_OVERDUE';
  if (action.includes('PLAN')) return 'PLAN_CREATE';
  if (action.includes('CANDIDATE')) return 'CANDIDATE_REGISTER';
  if (action.includes('SCORE')) return 'SCORE_RECORD';
  return 'SYSTEM';
}

function getActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith('CERTIFICATE_SUPPLY_')) return '更新证书申领状态';
  if (action.startsWith('CERTIFICATE_')) return '处理证书业务';
  if (action.startsWith('ARCHIVE_REPORT_BATCH_')) return '处理归档上报';
  if (action.startsWith('ARCHIVE_')) return '处理档案业务';
  if (action.startsWith('EXAM_PLAN_')) return '处理考评计划';
  if (action.startsWith('EXAM_NODE_')) return '处理考评节点';
  if (action.startsWith('CANDIDATE_')) return '处理考生业务';
  if (action.startsWith('PROSPECTIVE_CANDIDATE_')) return '处理意向考生';
  if (action.startsWith('SCORE_')) return '处理成绩业务';
  if (action.startsWith('USER_')) return '账号管理';
  return '系统操作';
}

function getTargetDescription(target: string, targetId?: string | null): string {
  const label = TARGET_LABELS[target] || '业务记录';
  return targetId ? `${label} #${targetId.slice(0, 8)}` : label;
}
