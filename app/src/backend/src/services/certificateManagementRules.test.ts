import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCertificateImportPreview,
  canApproveCertificateSupply,
  certificatePrintMmToPt,
  canOperateBranchCertificates,
  computeStockBalance,
  formatCertificatePrintDate,
  getLowStockReminder,
  validateCertificateAssignment,
  validateCertificateImportRow,
  validatePrintCertificateSelection,
  validateLedgerResponsibility,
  validatePrintRecordSettlement,
  validatePrintUsage,
} from './certificateManagementRules.js';

describe('certificate management rules', () => {
  it('requires certificate numbers to come from local system import or manual entry', () => {
    const result = validateCertificateAssignment({
      candidateStatus: 'PASSED',
      scoreIsPass: true,
      certNo: '',
      existingCertNos: new Set(),
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ['证书编号必须由地方业务系统导入或人工维护，系统不再自动生成']);
  });

  it('allows certificates only for passed candidates and rejects duplicate certificate numbers', () => {
    const result = validateCertificateAssignment({
      candidateStatus: 'APPROVED',
      scoreIsPass: false,
      certNo: 'CERT-LOCAL-001',
      existingCertNos: new Set(['CERT-LOCAL-001']),
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ['仅合格考生可维护证书', '证书编号已存在']);
  });

  it('previews imports by matching candidate name and id card while flagging duplicates', () => {
    const preview = buildCertificateImportPreview({
      rows: [
        { rowNumber: 2, name: '张三', idCard: '110101199001010011', certNo: 'CERT-001', certDisplayIssueDate: '2026-05-10' },
        { rowNumber: 3, name: '李四', idCard: '110101199001010022', certNo: 'CERT-001', certDisplayIssueDate: '2026-05-10' },
        { rowNumber: 4, name: '王五', idCard: '110101199001010033', certNo: 'CERT-003', certDisplayIssueDate: '2026-05-10' },
      ],
      candidates: [
        { id: 'c1', name: '张三', idCard: '110101199001010011', status: 'PASSED', scoreIsPass: true },
        { id: 'c2', name: '李四', idCard: '110101199001010022', status: 'PASSED', scoreIsPass: true },
      ],
      existingCertNos: new Set(['CERT-009']),
    });

    assert.equal(preview.summary.total, 3);
    assert.equal(preview.summary.matched, 2);
    assert.equal(preview.summary.valid, 1);
    assert.equal(preview.summary.duplicates, 1);
    assert.equal(preview.summary.unmatched, 1);
    assert.equal(preview.rows[1].errors.includes('导入文件内证书编号重复'), true);
    assert.equal(preview.rows[2].errors.includes('未匹配到同计划内考生'), true);
  });

  it('treats branch staff as branch certificate operators and keeps approval at headquarters', () => {
    assert.equal(canOperateBranchCertificates('BRANCH_ADMIN'), true);
    assert.equal(canOperateBranchCertificates('BRANCH_STAFF'), true);
    assert.equal(canOperateBranchCertificates('HQ_ADMIN'), false);

    assert.equal(canApproveCertificateSupply('HQ_ADMIN'), true);
    assert.equal(canApproveCertificateSupply('BRANCH_ADMIN'), false);
    assert.equal(canApproveCertificateSupply('SYS_ADMIN'), true);
  });

  it('warns but does not block print usage above 110 percent of passed candidates', () => {
    const result = validatePrintUsage({ passedCount: 100, requestedBlankCount: 112, overrideReason: '' });

    assert.equal(result.allowed, true);
    assert.equal(result.limit, 110);
    assert.equal(result.requiresOverrideReason, true);
    assert.equal(result.warning, '本批领用数量原则上不超过合格人数的110%，超出需登记原因');
  });

  it('returns low stock reminders below 50 remaining items', () => {
    assert.equal(getLowStockReminder(49), '库存低于50，请提前申领空白证书/证书壳');
    assert.equal(getLowStockReminder(50), null);
  });

  it('requires the certificate display issue date in import rows', () => {
    assert.deepEqual(
      validateCertificateImportRow({ name: '张三', idCard: '110101199001010011', certNo: 'CERT-001', certDisplayIssueDate: '' }),
      ['证书版面发证日期不能为空'],
    );
    assert.deepEqual(
      validateCertificateImportRow({ name: '张三', idCard: '110101199001010011', certNo: 'CERT-001', certDisplayIssueDate: '2026-05-10' }),
      [],
    );
  });

  it('requires every stock ledger movement to carry a business responsible person', () => {
    assert.equal(validateLedgerResponsibility(' 王老师 '), '王老师');
    assert.throws(() => validateLedgerResponsibility(''), /库存台账责任人不能为空/);
  });

  it('tracks available stock and pending-destroy stock separately', () => {
    const balance = computeStockBalance([
      { movementType: 'SUPPLY_RECEIVED', quantity: 10 },
      { movementType: 'PRINT_USE', quantity: -4 },
      { movementType: 'PRINT_RETURN', quantity: 1 },
      { movementType: 'PRINT_VOID', quantity: 2 },
      { movementType: 'DESTROY', quantity: -1 },
    ]);

    assert.equal(balance.available, 7);
    assert.equal(balance.pendingDestroy, 1);
  });

  it('requires print records to be settled before certificate delivery', () => {
    const unsettled = validatePrintRecordSettlement({
      blankCertUsed: 5,
      blankCertReturned: 1,
      blankCertVoided: 1,
      actualPrintedCount: 2,
    });
    const settled = validatePrintRecordSettlement({
      blankCertUsed: 5,
      blankCertReturned: 1,
      blankCertVoided: 1,
      actualPrintedCount: 3,
    });

    assert.equal(unsettled.ok, false);
    assert.deepEqual(unsettled.errors, ['实际打印数量必须等于空白证书领用数量减退回和作废数量']);
    assert.equal(settled.ok, true);
  });

  it('requires print certificate selections to be complete and match the printed count', () => {
    const result = validatePrintCertificateSelection({
      actualPrintedCount: 2,
      certificateIds: ['cert-1', 'cert-2'],
      eligibleCertificates: [
        { id: 'cert-1', certNo: 'S001', certDisplayIssueDate: new Date('2026-05-10T00:00:00Z'), status: 'PENDING' },
        { id: 'cert-2', certNo: '', certDisplayIssueDate: new Date('2026-05-10T00:00:00Z'), status: 'PENDING' },
        { id: 'cert-3', certNo: 'S003', certDisplayIssueDate: new Date('2026-05-10T00:00:00Z'), status: 'PRINTED' },
      ],
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ['所选证书存在未完整回填编号或版面发证日期的记录']);
  });

  it('formats certificate display issue dates for the print template', () => {
    assert.equal(formatCertificatePrintDate(new Date('2026-05-10T00:00:00Z')), '2026     05   10');
    assert.equal(formatCertificatePrintDate(null), '');
  });

  it('converts millimeter calibration offsets to PDF points', () => {
    assert.equal(Number(certificatePrintMmToPt(10).toFixed(4)), 28.3465);
    assert.equal(Number(certificatePrintMmToPt(-2.5).toFixed(4)), -7.0866);
  });
});
