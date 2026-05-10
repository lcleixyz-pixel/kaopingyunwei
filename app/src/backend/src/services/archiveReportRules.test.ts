import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARCHIVE_REPORT_HEADERS,
  buildArchiveReportRows,
  buildArchiveSummaryRows,
  buildSuggestedArchiveBatchTitle,
  canManageArchiveReportBatch,
  canReadArchiveReportAcrossTenants,
  canReviewArchiveReportBatch,
  filterCompleteArchiveCertificates,
  validateArchiveBatchDraft,
} from './archiveReportRules.js';

const records = [
  {
    certNo: 'S001365000001263000001',
    certDisplayIssueDate: new Date('2026-01-07T00:00:00Z'),
    candidate: {
      name: '李金营',
      idCard: '65432619791022051X',
      registrationProfile: { fieldsJson: JSON.stringify({ 所在单位: '新疆金玛世纪装饰有限责任公司' }) },
      plan: {
        tenant: { name: '新疆中和鉴珠宝玉石质量检测研究所（有限公司）' },
        occupation: '贵金属首饰与宝玉石检测员',
        profession: '玉石检验员',
        level: '三级/高级工',
      },
    },
  },
  {
    certNo: 'S001365000001263000002',
    certDisplayIssueDate: new Date('2026-01-07T00:00:00Z'),
    candidate: {
      name: '徐赫',
      idCard: '65210119890613041X',
      registrationProfile: { fieldsJson: '{}' },
      plan: {
        tenant: { name: '新疆中和鉴珠宝玉石质量检测研究所（有限公司）' },
        occupation: '贵金属首饰与宝玉石检测员',
        profession: '玉石检验员',
        level: '三级/高级工',
      },
    },
  },
  {
    certNo: '',
    certDisplayIssueDate: new Date('2026-01-07T00:00:00Z'),
    candidate: {
      name: '未完整',
      idCard: '110101199001010011',
      registrationProfile: { fieldsJson: '{}' },
      plan: {
        tenant: { name: '新疆中和鉴珠宝玉石质量检测研究所（有限公司）' },
        occupation: '贵金属首饰与宝玉石检测员',
        profession: '玉石检验员',
        level: '三级/高级工',
      },
    },
  },
];

describe('archive report rules', () => {
  it('keeps the headquarters certificate data report headers fixed', () => {
    assert.deepEqual(ARCHIVE_REPORT_HEADERS, [
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
    ]);
  });

  it('exports only complete certificate records and applies local filing defaults', () => {
    const rows = buildArchiveReportRows(filterCompleteArchiveCertificates(records));

    assert.equal(rows.length, 2);
    assert.equal(rows[0].证件类型, '201');
    assert.equal(rows[0].所在单位, '新疆金玛世纪装饰有限责任公司');
    assert.equal(rows[0].职业技能等级, '3');
    assert.equal(rows[0].发证日期, '2026-01-07');
    assert.equal(rows[1].所在单位, '其他');
    assert.equal(rows[1].发证机构, '国家珠宝玉石首饰检验集团有限公司');
  });

  it('summarizes Table 5 rows by occupation, profession and level', () => {
    const summary = buildArchiveSummaryRows(filterCompleteArchiveCertificates(records));

    assert.deepEqual(summary, [
      { occupation: '贵金属首饰与宝玉石检测员', profession: '玉石检验员', level: '三级', quantity: 2 },
    ]);
  });

  it('keeps branch filing operators separate from headquarters reviewers', () => {
    assert.equal(canManageArchiveReportBatch('BRANCH_ADMIN'), true);
    assert.equal(canManageArchiveReportBatch('BRANCH_STAFF'), true);
    assert.equal(canManageArchiveReportBatch('HQ_ADMIN'), false);

    assert.equal(canReviewArchiveReportBatch('HQ_ADMIN'), true);
    assert.equal(canReviewArchiveReportBatch('HQ_STAFF'), false);
    assert.equal(canReviewArchiveReportBatch('SYS_ADMIN'), true);

    assert.equal(canReadArchiveReportAcrossTenants('HQ_STAFF'), true);
    assert.equal(canReadArchiveReportAcrossTenants('BRANCH_ADMIN'), false);
  });

  it('validates batch number, single tenant scope and at least one complete certificate', () => {
    assert.deepEqual(validateArchiveBatchDraft({
      batchNo: '',
      planTenantIds: ['tenant-a'],
      completeRecordCount: 1,
    }), ['请先向本地上级部门报备并填写批次号']);

    assert.deepEqual(validateArchiveBatchDraft({
      batchNo: '251120S0013650000010005',
      planTenantIds: ['tenant-a', 'tenant-b'],
      completeRecordCount: 1,
    }), ['一个证书上报批次只能合并同一分支机构的考试计划']);

    assert.deepEqual(validateArchiveBatchDraft({
      batchNo: '251120S0013650000010005',
      planTenantIds: ['tenant-a'],
      completeRecordCount: 0,
    }), ['批次内没有完整的证书编号和证书版面发证日期记录']);
  });

  it('suggests an editable batch title from tenant name, count and batch number', () => {
    assert.equal(
      buildSuggestedArchiveBatchTitle({
        tenantName: '新疆中和鉴珠宝玉石质量检测研究所（有限公司）',
        batchNo: '251120S0013650000010005',
        recordCount: 12,
      }),
      '新疆中和鉴珠宝玉石质量检测研究所（有限公司）（新增12条，251120S0013650000010005）',
    );
  });
});
