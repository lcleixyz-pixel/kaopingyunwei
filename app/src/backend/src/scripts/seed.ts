// ═══════════════════════════════════════════════════
// 数据库种子数据 — 初始化默认租户和管理员
// ═══════════════════════════════════════════════════

import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../utils/crypto.js';

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
      code: 'HQ001',
      name: '总部',
      type: 'HQ',
      status: 'ACTIVE',
      contactName: '系统管理员',
      contactPhone: '13800138000',
    },
  });
  console.log(`✅ 创建总部租户: ${hq.name}`);

  // 2. 创建分支机构（示例）
  const branch1 = await prisma.tenant.create({
    data: {
      code: 'BJ001',
      name: '北京分部',
      type: 'BRANCH',
      status: 'ACTIVE',
      contactName: '北京管理员',
      contactPhone: '13800138001',
    },
  });

  const branch2 = await prisma.tenant.create({
    data: {
      code: 'SH001',
      name: '上海分部',
      type: 'BRANCH',
      status: 'ACTIVE',
      contactName: '上海管理员',
      contactPhone: '13800138002',
    },
  });
  console.log(`✅ 创建分支机构: ${branch1.name}, ${branch2.name}`);

  // 3. 创建系统管理员
  const admin = await prisma.user.create({
    data: {
      tenantId: hq.id,
      username: 'admin',
      password: await hashPassword('admin123'),
      realName: '系统管理员',
      role: 'SYS_ADMIN',
      phone: '13800138000',
      email: 'admin@exam.local',
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
      phone: '13800138003',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ 创建总部管理员: ${hqAdmin.username}`);

  // 5. 创建分部管理员和工作人员
  const bjAdmin = await prisma.user.create({
    data: {
      tenantId: branch1.id,
      username: 'bjadmin',
      password: await hashPassword('bjadmin123'),
      realName: '北京管理员',
      role: 'BRANCH_ADMIN',
      phone: '13800138004',
      status: 'ACTIVE',
    },
  });

  const shAdmin = await prisma.user.create({
    data: {
      tenantId: branch2.id,
      username: 'shadmin',
      password: await hashPassword('shadmin123'),
      realName: '上海管理员',
      role: 'BRANCH_ADMIN',
      phone: '13800138005',
      status: 'ACTIVE',
    },
  });

  const bjStaff = await prisma.user.create({
    data: {
      tenantId: branch1.id,
      username: 'bjstaff',
      password: await hashPassword('bjstaff123'),
      realName: '北京工作人员',
      role: 'BRANCH_STAFF',
      phone: '13800138006',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ 创建分部账号: ${bjAdmin.username}, ${shAdmin.username}, ${bjStaff.username}`);

  console.log('\n🎉 数据库初始化完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  默认登录账号：');
  console.log('  • 系统管理员: admin / admin123');
  console.log('  • 总部管理员: hqadmin / hqadmin123');
  console.log('  • 北京分部: bjadmin / bjadmin123');
  console.log('  • 北京工作人员: bjstaff / bjstaff123');
  console.log('  • 上海分部: shadmin / shadmin123');
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
