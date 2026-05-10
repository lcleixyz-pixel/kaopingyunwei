export type CertificateOperatorRole =
  | 'SYS_ADMIN'
  | 'HQ_ADMIN'
  | 'HQ_STAFF'
  | 'BRANCH_ADMIN'
  | 'BRANCH_STAFF'
  | 'EXAMINER'
  | 'INSPECTOR'
  | string;

export interface CertificateAssignmentInput {
  candidateStatus?: string | null;
  scoreIsPass?: boolean | null;
  certNo?: string | null;
  existingCertNos: Set<string>;
}

export interface CertificateAssignmentResult {
  ok: boolean;
  errors: string[];
}

export interface CertificateImportCandidate {
  id: string;
  name: string;
  idCard: string;
  status?: string | null;
  scoreIsPass?: boolean | null;
}

export interface CertificateImportRow {
  rowNumber: number;
  name: string;
  idCard: string;
  certNo: string;
  certDisplayIssueDate: string;
}

export interface CertificateImportPreviewRow {
  rowNumber: number;
  name: string;
  idCard: string;
  certNo: string;
  certDisplayIssueDate: string;
  candidateId?: string;
  matched: boolean;
  valid: boolean;
  errors: string[];
}

export interface CertificateImportPreview {
  rows: CertificateImportPreviewRow[];
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
}

export interface PrintUsageInput {
  passedCount: number;
  requestedBlankCount: number;
  overrideReason?: string | null;
}

export interface PrintUsageResult {
  allowed: boolean;
  limit: number;
  requiresOverrideReason: boolean;
  warning: string | null;
}

export interface CertificateImportRowValidationInput {
  name: string;
  idCard: string;
  certNo: string;
  certDisplayIssueDate: string;
}

export interface CertificateStockMovementLike {
  movementType: string;
  quantity: number;
}

export interface CertificateStockBalanceSummary {
  available: number;
  pendingDestroy: number;
}

export interface PrintSettlementInput {
  blankCertUsed: number;
  blankCertReturned: number;
  blankCertVoided: number;
  actualPrintedCount: number;
}

export interface PrintSettlementResult {
  ok: boolean;
  errors: string[];
}

export interface PrintCertificateSelectionInput {
  actualPrintedCount: number;
  certificateIds: string[];
  eligibleCertificates: Array<{
    id: string;
    certNo?: string | null;
    certDisplayIssueDate?: Date | string | null;
    status?: string | null;
  }>;
}

const BRANCH_CERTIFICATE_OPERATORS = new Set(['BRANCH_ADMIN', 'BRANCH_STAFF']);
const SUPPLY_APPROVERS = new Set(['SYS_ADMIN', 'HQ_ADMIN']);
const LOW_STOCK_THRESHOLD = 50;

export function canOperateBranchCertificates(role?: CertificateOperatorRole): boolean {
  return BRANCH_CERTIFICATE_OPERATORS.has(String(role || ''));
}

export function canApproveCertificateSupply(role?: CertificateOperatorRole): boolean {
  return SUPPLY_APPROVERS.has(String(role || ''));
}

export function canReadCertificateAcrossTenants(role?: CertificateOperatorRole): boolean {
  return role === 'SYS_ADMIN' || role === 'HQ_ADMIN' || role === 'HQ_STAFF';
}

export function validateCertificateAssignment(input: CertificateAssignmentInput): CertificateAssignmentResult {
  const errors: string[] = [];
  const certNo = normalizeText(input.certNo);

  if (!isCandidatePassed(input.candidateStatus, input.scoreIsPass)) {
    errors.push('仅合格考生可维护证书');
  }

  if (!certNo) {
    errors.push('证书编号必须由地方业务系统导入或人工维护，系统不再自动生成');
  } else if (input.existingCertNos.has(certNo)) {
    errors.push('证书编号已存在');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function buildCertificateImportPreview(input: {
  rows: CertificateImportRow[];
  candidates: CertificateImportCandidate[];
  existingCertNos: Set<string>;
}): CertificateImportPreview {
  const candidateByIdentity = new Map<string, CertificateImportCandidate>();
  input.candidates.forEach((candidate) => {
    candidateByIdentity.set(identityKey(candidate.name, candidate.idCard), candidate);
  });

  const seenImportCertNos = new Set<string>();

  const rows = input.rows.map((row) => {
    const name = normalizeText(row.name);
    const idCard = normalizeText(row.idCard);
    const certNo = normalizeText(row.certNo);
    const certDisplayIssueDate = normalizeText(row.certDisplayIssueDate);
    const candidate = candidateByIdentity.get(identityKey(name, idCard));
    const errors: string[] = validateCertificateImportRow({ name, idCard, certNo, certDisplayIssueDate });

    if (!candidate) {
      errors.push('未匹配到同计划内考生');
    }

    if (certNo && seenImportCertNos.has(certNo)) {
      errors.push('导入文件内证书编号重复');
    }
    if (certNo) seenImportCertNos.add(certNo);

    const assignment = validateCertificateAssignment({
      candidateStatus: candidate?.status,
      scoreIsPass: candidate?.scoreIsPass,
      certNo,
      existingCertNos: input.existingCertNos,
    });
    errors.push(...assignment.errors.filter((message) => !errors.includes(message)));

    return {
      rowNumber: row.rowNumber,
      name,
      idCard,
      certNo,
      certDisplayIssueDate,
      candidateId: candidate?.id,
      matched: Boolean(candidate),
      valid: errors.length === 0,
      errors,
    };
  });

  return {
    rows,
    summary: {
      total: rows.length,
      matched: rows.filter((row) => row.matched).length,
      unmatched: rows.filter((row) => !row.matched).length,
      valid: rows.filter((row) => row.valid).length,
      invalid: rows.filter((row) => !row.valid).length,
      duplicates: rows.filter((row) => row.errors.includes('导入文件内证书编号重复')).length,
    },
  };
}

export function validatePrintUsage(input: PrintUsageInput): PrintUsageResult {
  const limit = Math.floor(Math.max(input.passedCount, 0) * 1.1 + Number.EPSILON);
  const exceedsLimit = input.requestedBlankCount > limit;
  const requiresOverrideReason = exceedsLimit && !normalizeText(input.overrideReason);

  return {
    allowed: true,
    limit,
    requiresOverrideReason,
    warning: exceedsLimit ? '本批领用数量原则上不超过合格人数的110%，超出需登记原因' : null,
  };
}

export function getLowStockReminder(balance: number): string | null {
  return balance < LOW_STOCK_THRESHOLD ? '库存低于50，请提前申领空白证书/证书壳' : null;
}

export function validateCertificateImportRow(input: CertificateImportRowValidationInput): string[] {
  const errors: string[] = [];
  if (!normalizeText(input.certNo)) {
    errors.push('证书编号不能为空');
  }
  if (!normalizeText(input.certDisplayIssueDate)) {
    errors.push('证书版面发证日期不能为空');
  } else if (!parseCertificateDisplayDate(input.certDisplayIssueDate)) {
    errors.push('证书版面发证日期格式应为 YYYY-MM-DD');
  }
  return errors;
}

export function parseCertificateDisplayDate(value: unknown): Date | null {
  const text = normalizeText(value);
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function validateLedgerResponsibility(value: unknown): string {
  const responsiblePerson = normalizeText(value);
  if (!responsiblePerson) {
    throw new Error('库存台账责任人不能为空');
  }
  return responsiblePerson;
}

export function computeStockBalance(movements: CertificateStockMovementLike[]): CertificateStockBalanceSummary {
  return movements.reduce<CertificateStockBalanceSummary>((balance, movement) => {
    if (movement.movementType === 'PRINT_VOID') {
      balance.pendingDestroy += movement.quantity;
      return balance;
    }
    if (movement.movementType === 'DESTROY') {
      balance.pendingDestroy += movement.quantity;
      return balance;
    }
    balance.available += movement.quantity;
    return balance;
  }, { available: 0, pendingDestroy: 0 });
}

export function validatePrintRecordSettlement(input: PrintSettlementInput): PrintSettlementResult {
  const expectedPrinted = input.blankCertUsed - input.blankCertReturned - input.blankCertVoided;
  const errors: string[] = [];
  if (expectedPrinted < 0) {
    errors.push('退回和作废数量不能超过空白证书领用数量');
  }
  if (input.actualPrintedCount !== expectedPrinted) {
    errors.push('实际打印数量必须等于空白证书领用数量减退回和作废数量');
  }
  return { ok: errors.length === 0, errors };
}

export function validatePrintCertificateSelection(input: PrintCertificateSelectionInput): PrintSettlementResult {
  const errors: string[] = [];
  const selectedIds = input.certificateIds.filter((id) => normalizeText(id));
  const uniqueSelectedIds = new Set(selectedIds);
  const certificatesById = new Map(input.eligibleCertificates.map((certificate) => [certificate.id, certificate]));

  if (selectedIds.length === 0 && input.actualPrintedCount > 0) {
    errors.push('请选择本批次打印的证书记录');
  }
  if (uniqueSelectedIds.size !== selectedIds.length) {
    errors.push('所选证书记录重复');
  }
  if (selectedIds.length !== input.actualPrintedCount) {
    errors.push('实际打印数量必须等于所选证书数量');
  }
  if (selectedIds.some((id) => !certificatesById.has(id))) {
    errors.push('所选证书不属于当前计划或无权操作');
  }

  const hasIncomplete = selectedIds.some((id) => {
    const certificate = certificatesById.get(id);
    return !certificate || !normalizeText(certificate.certNo) || !certificate.certDisplayIssueDate;
  });
  if (hasIncomplete) {
    errors.push('所选证书存在未完整回填编号或版面发证日期的记录');
  }

  if (selectedIds.some((id) => certificatesById.get(id)?.status !== 'PENDING')) {
    errors.push('所选证书存在已打印或已发放的记录');
  }

  return { ok: errors.length === 0, errors };
}

export function formatCertificatePrintDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}     ${month}   ${day}`;
}

export function certificatePrintMmToPt(value: number): number {
  return value * 72 / 25.4;
}

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function isCandidatePassed(status?: string | null, scoreIsPass?: boolean | null): boolean {
  return status === 'PASSED' || scoreIsPass === true;
}

function identityKey(name: string, idCard: string): string {
  return `${normalizeText(name)}|${normalizeText(idCard).toUpperCase()}`;
}
