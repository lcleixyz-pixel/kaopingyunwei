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

  // 5. 创建分部管理员
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
  console.log(`✅ 创建分部管理员: ${bjAdmin.username}, ${shAdmin.username}`);

  // 6. 创建示例考评计划
  const examDate = new Date();
  examDate.setDate(examDate.getDate() + 30); // 30天后考试

  const plan = await prisma.examPlan.create({
    data: {
      tenantId: hq.id,
      title: '2026年Q2电工等级认定',
      examDate,
      profession: '电工',
      level: '3',
      examType: 'COMPREHENSIVE',
      location: '总部考场A',
      maxCandidates: 50,
      status: 'PUBLISHED',
      notes: '示例数据',
      createdBy: admin.id,
    },
  });
  console.log(`✅ 创建考评计划: ${plan.title}`);

  // 7. 自动创建9大节点
  const { addWorkDays } = await import('../utils/dateUtils.js');
  
  const nodeDefinitions = [
    { type: 'PLAN_CREATE', days: -10 },
    { type: 'REGISTRATION', days: -7 },
    { type: 'ROOM_ARRANGE', days: -5 },
    { type: 'EXAM_PREPARE', days: -5 },
    { type: 'EXAM_DAY', days: 0 },
    { type: 'SCORE_RECORD', days: 3 },
    { type: 'SCORE_PUBLISH', days: 5 },
    { type: 'CERT_MANAGE', days: 10 },
    { type: 'COMPLETE', days: 10 },
  ];

  for (const def of nodeDefinitions) {
    const deadline = addWorkDays(examDate, def.days);
    
    await prisma.examNode.create({
      data: {
        planId: plan.id,
        nodeType: def.type,
        deadline,
        status: def.days < 0 && deadline < new Date() ? 'COMPLETED' : 'PENDING',
        completedAt: def.days < 0 && deadline < new Date() ? deadline : null,
      },
    });
  }
  console.log('✅ 创建9大考评节点');

  // 8. 创建示例考生
  const candidate = await prisma.candidate.create({
    data: {
      tenantId: hq.id,
      planId: plan.id,
      name: '张三',
      idCard: '310101199001011234', // 实际使用时应加密
      phone: '13812345678',
      gender: 'M',
      education: '大专',
      workYears: 5,
      applyLevel: '3',
      status: 'APPROVED',
      examRoom: 'A101',
      seatNo: '01',
    },
  });
  console.log(`✅ 创建示例考生: ${candidate.name}`);

  console.log('\n🎉 数据库初始化完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  默认登录账号：');
  console.log('  • 系统管理员: admin / admin123');
  console.log('  • 总部管理员: hqadmin / hqadmin123');
  console.log('  • 北京分部: bjadmin / bjadmin123');
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
