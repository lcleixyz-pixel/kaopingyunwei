export const ARCHIVE_REPORT_HEADERS = [
  '姓名',
  '证件类型',
  '证件号码',
  '所在单位',
  '职业名称',
  '工种名称',
  '职业技能等级',
  '证书编号',
  '发证日期',
  '评价机构',
  '发证机构',
] as const;

export type ArchiveReportHeader = typeof ARCHIVE_REPORT_HEADERS[number];

export type ArchiveReportRow = Record<ArchiveReportHeader, string>;

export interface ArchiveCertificateLike {
  certNo?: string | null;
  certDisplayIssueDate?: Date | string | null;
  candidate: {
    name: string;
    idCard: string;
    registrationProfile?: { fieldsJson?: string | null } | null;
    plan: {
      tenant: { name: string };
      occupation: string;
      profession: string;
      level: string;
    };
  };
}

export interface ArchiveSummaryRow {
  occupation: string;
  profession: string;
  level: string;
  quantity: number;
}

const ARCHIVE_MANAGERS = new Set(['BRANCH_ADMIN', 'BRANCH_STAFF']);
const ARCHIVE_REVIEWERS = new Set(['SYS_ADMIN', 'HQ_ADMIN']);
const ARCHIVE_CROSS_TENANT_READERS = new Set(['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF']);
const DEFAULT_ISSUER = '国家珠宝玉石首饰检验集团有限公司';

export function canManageArchiveReportBatch(role?: string): boolean {
  return ARCHIVE_MANAGERS.has(String(role || ''));
}

export function canReviewArchiveReportBatch(role?: string): boolean {
  return ARCHIVE_REVIEWERS.has(String(role || ''));
}

export function canReadArchiveReportAcrossTenants(role?: string): boolean {
  return ARCHIVE_CROSS_TENANT_READERS.has(String(role || ''));
}

export function filterCompleteArchiveCertificates<T extends ArchiveCertificateLike>(certificates: T[]): T[] {
  return certificates.filter((certificate) => Boolean(normalizeText(certificate.certNo) && certificate.certDisplayIssueDate));
}

export function buildArchiveReportRows(certificates: ArchiveCertificateLike[]): ArchiveReportRow[] {
  return certificates.map((certificate) => {
    const fields = parseRegistrationFields(certificate.candidate.registrationProfile?.fieldsJson);
    return {
      姓名: normalizeText(certificate.candidate.name),
      证件类型: '201',
      证件号码: normalizeText(certificate.candidate.idCard),
      所在单位: normalizeText(fields.所在单位) || '其他',
      职业名称: normalizeText(certificate.candidate.plan.occupation),
      工种名称: normalizeText(certificate.candidate.plan.profession),
      职业技能等级: normalizeLevelNumber(certificate.candidate.plan.level),
      证书编号: normalizeText(certificate.certNo),
      发证日期: formatDateOnly(certificate.certDisplayIssueDate),
      评价机构: normalizeText(certificate.candidate.plan.tenant.name),
      发证机构: DEFAULT_ISSUER,
    };
  });
}

export function buildArchiveSummaryRows(certificates: ArchiveCertificateLike[]): ArchiveSummaryRow[] {
  const rows = new Map<string, ArchiveSummaryRow>();
  certificates.forEach((certificate) => {
    const occupation = normalizeText(certificate.candidate.plan.occupation);
    const profession = normalizeText(certificate.candidate.plan.profession);
    const level = normalizeLevelLabel(certificate.candidate.plan.level);
    const key = `${occupation}|${profession}|${level}`;
    const existing = rows.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      rows.set(key, { occupation, profession, level, quantity: 1 });
    }
  });
  return Array.from(rows.values());
}

export function buildArchiveBatchDataType(): string {
  return '新增';
}

export function validateArchiveBatchDraft(input: {
  batchNo?: string | null;
  planTenantIds: string[];
  completeRecordCount: number;
}): string[] {
  const errors: string[] = [];
  if (!normalizeText(input.batchNo)) {
    errors.push('请先向本地上级部门报备并填写批次号');
  }
  if (new Set(input.planTenantIds.filter(Boolean)).size > 1) {
    errors.push('一个证书上报批次只能合并同一分支机构的考试计划');
  }
  if (input.completeRecordCount < 1) {
    errors.push('批次内没有完整的证书编号和证书版面发证日期记录');
  }
  return errors;
}

export function buildSuggestedArchiveBatchTitle(input: {
  tenantName: string;
  batchNo: string;
  recordCount: number;
}): string {
  return `${normalizeText(input.tenantName)}（新增${input.recordCount}条，${normalizeText(input.batchNo)}）`;
}

export function normalizeLevelNumber(level: string): string {
  const label = normalizeLevelLabel(level);
  const match = /^([一二三四五])级/.exec(label);
  if (!match) return normalizeText(level);
  return ({ 一: '1', 二: '2', 三: '3', 四: '4', 五: '5' } as const)[match[1] as '一' | '二' | '三' | '四' | '五'];
}

export function normalizeLevelLabel(level: string): string {
  const text = normalizeText(level);
  return text.includes('/') ? text.split('/')[0] : text;
}

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

export function formatDateOnly(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function parseRegistrationFields(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
