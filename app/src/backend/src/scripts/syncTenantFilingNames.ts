import { prisma } from '../lib/prisma.js';
import { TENANT_FILING_NAMES_BY_CODE } from '../services/tenantOfficialNames.js';

async function syncTenantFilingNames(): Promise<void> {
  console.log('🔧 开始同步租户备案号内部名称...');

  for (const [code, name] of Object.entries(TENANT_FILING_NAMES_BY_CODE)) {
    const result = await prisma.tenant.updateMany({
      where: { code },
      data: { name },
    });
    console.log(`${code} -> ${name}，更新 ${result.count} 条`);
  }

  console.log('✅ 租户备案号内部名称同步完成');
}

syncTenantFilingNames()
  .catch((err) => {
    console.error('Sync tenant filing names error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
