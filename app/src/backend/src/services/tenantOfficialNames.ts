export interface TenantOfficialNameSource {
  code?: string | null;
  name?: string | null;
}

export const TENANT_OFFICIAL_NAMES_BY_CODE: Record<string, string> = {
  NGTCS0013: '国家珠宝玉石首饰检验集团有限公司',
  BJ001: '国家珠宝玉石首饰检验集团有限公司',
  SZ001: '国检教育科技（深圳）有限公司',
  XJ001: '新疆中和鉴珠宝玉石质量检测研究所（有限公司）',
  YN001: '宝检教育科技（云南）有限公司',
};

export const TENANT_FILING_NAMES_BY_CODE: Record<string, string> = {
  NGTCS0013: 'S0013',
  BJ001: 'S0013',
  SZ001: 'S001344006001',
  XJ001: 'S001365000001',
  YN001: 'S001353000008',
};

export function formatTenantOfficialName(tenant?: TenantOfficialNameSource | null): string {
  const code = normalizeTenantText(tenant?.code);
  if (code && TENANT_OFFICIAL_NAMES_BY_CODE[code]) {
    return TENANT_OFFICIAL_NAMES_BY_CODE[code];
  }
  return normalizeTenantText(tenant?.name);
}

export function filingNameForTenantCode(code?: string | null): string | null {
  const normalizedCode = normalizeTenantText(code);
  return normalizedCode ? TENANT_FILING_NAMES_BY_CODE[normalizedCode] || null : null;
}

function normalizeTenantText(value: unknown): string {
  return String(value ?? '').trim();
}
