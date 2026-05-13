// ═══════════════════════════════════════════════════
// 数据库种子数据 — 初始化默认租户和管理员
// ═══════════════════════════════════════════════════

import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../utils/crypto.js';
import { filingNameForTenantCode } from '../services/tenantOfficialNames.js';

async function seed(): Promise<void> {
  console.log('🌱 开始初始化数据库...');

  // 检查是否已有数据
  const existingTenants = await prisma.tenant.count();
  if (existingTenants > 0) {
    console.log('✅ 数据库已有数据，跳过初始化');
    return;
  }

  // 1. 创建总部租户
  const hq = await prisma.tenant.create({
    data: {
      code: 'NGTCS0013',
      name: filingNameForTenantCode('NGTCS0013') || 'S0013',
      type: 'HQ',
      status: 'ACTIVE',
      contactName: '总部管理员',
      address: '北京',
    },
  });
  console.log(`✅ 创建总部租户: ${hq.name}`);

  // 2. 创建考评运营机构：北京总部自营 + 三个分支
  const beijingOps = await prisma.tenant.create({
    data: {
      code: 'BJ001',
      name: filingNameForTenantCode('BJ001') || 'S0013',
      type: 'BRANCH',
      status: 'ACTIVE',
      contactName: '北京考评管理员',
      address: '北京',
    },
  });

  const shenzhen = await prisma.tenant.create({
    data: {
      code: 'SZ001',
      name: filingNameForTenantCode('SZ001') || 'S001344006001',
      type: 'BRANCH',
      status: 'ACTIVE',
      contactName: '深圳管理员',
      address: '深圳',
    },
  });

  const xinjiang = await prisma.tenant.create({
    data: {
      code: 'XJ001',
      name: filingNameForTenantCode('XJ001') || 'S001365000001',
      type: 'BRANCH',
      status: 'ACTIVE',
      contactName: '新疆管理员',
      address: '新疆',
    },
  });

  const yunnan = await prisma.tenant.create({
    data: {
      code: 'YN001',
      name: filingNameForTenantCode('YN001') || 'S001353000008',
      type: 'BRANCH',
      status: 'ACTIVE',
      contactName: '云南管理员',
      address: '云南',
    },
  });
  console.log(`✅ 创建考评运营机构: ${beijingOps.name}, ${shenzhen.name}, ${xinjiang.name}, ${yunnan.name}`);

  // 3. 创建系统管理员
  const admin = await prisma.user.create({
    data: {
      tenantId: hq.id,
      username: 'admin',
      password: await hashPassword('admin123'),
      realName: '系统管理员',
      role: 'SYS_ADMIN',
      email: 'admin@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ 创建系统管理员: ${admin.username}`);

  // 4. 创建总部管理员
  const hqAdmin = await prisma.user.create({
    data: {
      tenantId: hq.id,
      username: 'hqadmin',
      password: await hashPassword('hqadmin123'),
      realName: '总部管理员',
      role: 'HQ_ADMIN',
      email: 'hqadmin@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ 创建总部管理员: ${hqAdmin.username}`);

  const hqStaff = await prisma.user.create({
    data: {
      tenantId: hq.id,
      username: 'hqstaff',
      password: await hashPassword('hqstaff123'),
      realName: '总部工作人员',
      role: 'HQ_STAFF',
      email: 'hqstaff@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ 创建总部工作人员: ${hqStaff.username}`);

  // 5. 创建北京自营和分支管理员、工作人员
  const bjAdmin = await prisma.user.create({
    data: {
      tenantId: beijingOps.id,
      username: 'bjadmin',
      password: await hashPassword('bjadmin123'),
      realName: '北京考评管理员',
      role: 'BRANCH_ADMIN',
      email: 'bjadmin@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });

  const bjStaff = await prisma.user.create({
    data: {
      tenantId: beijingOps.id,
      username: 'bjstaff',
      password: await hashPassword('bjstaff123'),
      realName: '北京考评工作人员',
      role: 'BRANCH_STAFF',
      email: 'bjstaff@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });

  const szAdmin = await prisma.user.create({
    data: {
      tenantId: shenzhen.id,
      username: 'szadmin',
      password: await hashPassword('szadmin123'),
      realName: '深圳管理员',
      role: 'BRANCH_ADMIN',
      email: 'szadmin@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });

  const szStaff = await prisma.user.create({
    data: {
      tenantId: shenzhen.id,
      username: 'szstaff',
      password: await hashPassword('szstaff123'),
      realName: '深圳工作人员',
      role: 'BRANCH_STAFF',
      email: 'szstaff@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });

  const xjAdmin = await prisma.user.create({
    data: {
      tenantId: xinjiang.id,
      username: 'xjadmin',
      password: await hashPassword('xjadmin123'),
      realName: '新疆管理员',
      role: 'BRANCH_ADMIN',
      email: 'xjadmin@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });

  const xjStaff = await prisma.user.create({
    data: {
      tenantId: xinjiang.id,
      username: 'xjstaff',
      password: await hashPassword('xjstaff123'),
      realName: '新疆工作人员',
      role: 'BRANCH_STAFF',
      email: 'xjstaff@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });

  const ynAdmin = await prisma.user.create({
    data: {
      tenantId: yunnan.id,
      username: 'ynadmin',
      password: await hashPassword('ynadmin123'),
      realName: '云南管理员',
      role: 'BRANCH_ADMIN',
      email: 'ynadmin@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });

  const ynStaff = await prisma.user.create({
    data: {
      tenantId: yunnan.id,
      username: 'ynstaff',
      password: await hashPassword('ynstaff123'),
      realName: '云南工作人员',
      role: 'BRANCH_STAFF',
      email: 'ynstaff@ngtcs0013.local',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ 创建考评运营账号: ${bjAdmin.username}, ${bjStaff.username}, ${szAdmin.username}, ${szStaff.username}, ${xjAdmin.username}, ${xjStaff.username}, ${ynAdmin.username}, ${ynStaff.username}`);

  console.log('\n🎉 数据库初始化完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  默认登录账号：');
  console.log('  • 系统管理员: admin / admin123');
  console.log('  • 总部管理员: hqadmin / hqadmin123');
  console.log('  • 总部工作人员: hqstaff / hqstaff123');
  console.log('  • 北京考评管理员: bjadmin / bjadmin123');
  console.log('  • 北京考评工作人员: bjstaff / bjstaff123');
  console.log('  • 深圳管理员: szadmin / szadmin123');
  console.log('  • 深圳工作人员: szstaff / szstaff123');
  console.log('  • 新疆管理员: xjadmin / xjadmin123');
  console.log('  • 新疆工作人员: xjstaff / xjstaff123');
  console.log('  • 云南管理员: ynadmin / ynadmin123');
  console.log('  • 云南工作人员: ynstaff / ynstaff123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
