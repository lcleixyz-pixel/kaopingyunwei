import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TENANT_FILING_NAMES_BY_CODE,
  formatTenantOfficialName,
  filingNameForTenantCode,
} from './tenantOfficialNames.js';

describe('tenant official names', () => {
  it('maps known tenant codes to formal organization names', () => {
    assert.equal(formatTenantOfficialName({ code: 'NGTCS0013', name: 'S0013' }), '国家珠宝玉石首饰检验集团有限公司');
    assert.equal(formatTenantOfficialName({ code: 'BJ001', name: 'S0013' }), '国家珠宝玉石首饰检验集团有限公司');
    assert.equal(formatTenantOfficialName({ code: 'SZ001', name: 'S001344006001' }), '国检教育科技（深圳）有限公司');
    assert.equal(formatTenantOfficialName({ code: 'XJ001', name: 'S001365000001' }), '新疆中和鉴珠宝玉石质量检测研究所（有限公司）');
    assert.equal(formatTenantOfficialName({ code: 'YN001', name: 'S001353000008' }), '宝检教育科技（云南）有限公司');
  });

  it('falls back to tenant.name for unknown tenant codes', () => {
    assert.equal(formatTenantOfficialName({ code: 'UNKNOWN', name: '未知机构内部名' }), '未知机构内部名');
  });

  it('exposes filing names for seed data and repair scripts', () => {
    assert.deepEqual(TENANT_FILING_NAMES_BY_CODE, {
      NGTCS0013: 'S0013',
      BJ001: 'S0013',
      SZ001: 'S001344006001',
      XJ001: 'S001365000001',
      YN001: 'S001353000008',
    });
    assert.equal(filingNameForTenantCode('XJ001'), 'S001365000001');
    assert.equal(filingNameForTenantCode('UNKNOWN'), null);
  });
});
