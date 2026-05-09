// ═══════════════════════════════════════════════════
// 定时任务调度器 — 自动提醒 + 自动备份 + 逾期检测
// ═══════════════════════════════════════════════════

import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import config from '../config/index.js';

// 提醒规则定义
const REMINDER_RULES: Record<string, { beforeDays: number; message: string }[]> = {
  PLAN_CREATE: [{ beforeDays: 2, message: '制定计划即将到期，请尽快完成' }],
  REGISTRATION: [{ beforeDays: 2, message: '考试报名即将截止，请尽快完成' }],
  ROOM_ARRANGE: [{ beforeDays: 1, message: '考场编排即将到期' }],
  EXAM_PREPARE: [{ beforeDays: 1, message: '考务安排即将到期' }],
  EXAM_DAY: [{ beforeDays: 1, message: '考试明天开始，请做好准备' }],
  SCORE_RECORD: [{ beforeDays: 1, message: '成绩检录即将到期' }, { beforeDays: 0, message: '成绩检录已逾期，请尽快完成' }],
  SCORE_PUBLISH: [{ beforeDays: 1, message: '成绩公示即将开始' }],
  CERT_MANAGE: [{ beforeDays: 2, message: '证书管理即将到期' }],
  COMPLETE: [{ beforeDays: 2, message: '完成认定即将到期' }],
};

/**
 * 初始化所有定时任务
 */
export function initializeScheduler(): void {
  console.log('🕐 定时任务调度器已启动');

  // 每分钟检查一次节点状态（逾期检测 + 提醒生成）
  cron.schedule('*/1 * * * *', async () => {
    try {
      await checkOverdueNodes();
      await generateReminders();
    } catch (err) {
      console.error('Reminder job error:', err);
    }
  });

  // 每天凌晨2点自动备份
  if (config.AUTO_BACKUP_ENABLED) {
    const [hour, minute] = config.AUTO_BACKUP_TIME.split(':');
    cron.schedule(`${minute} ${hour} * * *`, async () => {
      try {
        console.log('🔄 执行自动备份...');
        await performAutoBackup();
      } catch (err) {
        console.error('Auto backup error:', err);
      }
    });
  }

  // 每天凌晨3点清理临时文件
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('🧹 清理临时文件...');
      await cleanupTempFiles();
    } catch (err) {
      console.error('Cleanup job error:', err);
    }
  });
}

/**
 * 检查逾期节点
 */
async function checkOverdueNodes(): Promise<void> {
  const now = new Date();
  
  const overdueNodes = await prisma.examNode.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      deadline: { lt: now },
      plan: { status: 'PUBLISHED' },
    },
    include: {
      plan: {
        select: { tenantId: true, title: true },
      },
    },
  });

  for (const node of overdueNodes) {
    console.log(`⚠️ 节点已逾期: ${node.plan.title} - ${node.nodeType}`);
  }
}

/**
 * 生成提醒
 */
async function generateReminders(): Promise<void> {
  const now = new Date();
  const reminderWindow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  // 查找即将到期或已经逾期且未完成的已发布节点
  const upcomingNodes = await prisma.examNode.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      deadline: { lte: reminderWindow },
      plan: { status: 'PUBLISHED' },
    },
    include: {
      plan: {
        select: { tenantId: true, title: true },
      },
      reminders: {
        where: {
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      },
    },
  });

  for (const node of upcomingNodes) {
    const rules = REMINDER_RULES[node.nodeType] || [];
    const hoursRemaining = (node.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    const type = hoursRemaining < 0 ? 'NODE_OVERDUE' : 'NODE_DEADLINE';

    for (const rule of rules) {
      if (hoursRemaining < 0 || hoursRemaining <= rule.beforeDays * 24) {
        const recipients = await prisma.user.findMany({
          where: {
            tenantId: node.plan.tenantId,
            role: { in: ['BRANCH_ADMIN', 'BRANCH_STAFF'] },
            status: 'ACTIVE',
          },
        });

        for (const user of recipients) {
          const hasRecentReminder = node.reminders.some((reminder) => (
            reminder.userId === user.id && reminder.type === type
          ));
          if (hasRecentReminder) continue;

          await prisma.reminder.create({
            data: {
              nodeId: node.id,
              userId: user.id,
              type,
              content: `${node.plan.title} - ${rule.message}`,
              scheduledAt: node.deadline,
              channel: 'IN_APP',
              status: 'PENDING',
            },
          });
          console.log(`📢 生成提醒: ${node.plan.title} - ${rule.message}`);
        }
      }
    }
  }
}

/**
 * 自动备份
 */
async function performAutoBackup(): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const dataDir = path.resolve(process.cwd(), 'data');
  const backupDir = path.resolve(dataDir, 'backups');
  
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `auto-backup-${timestamp}.db`);
  const dbPath = path.join(dataDir, 'exam.db');

  await fs.copyFile(dbPath, backupPath);
  console.log(`✅ 自动备份完成: ${backupPath}`);

  // 清理过期备份
  const retentionDays = config.BACKUP_RETENTION_DAYS;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const files = await fs.readdir(backupDir);
  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stat = await fs.stat(filePath);
    if (stat.ctime < cutoffDate) {
      await fs.unlink(filePath);
      console.log(`🗑️ 删除过期备份: ${file}`);
    }
  }
}

/**
 * 清理临时文件
 */
async function cleanupTempFiles(): Promise<void> {
  // 清理超过7天的临时导出文件
  const fs = await import('fs/promises');
  const path = await import('path');

  const dataDir = path.resolve(process.cwd(), 'data');
  const tempDir = path.resolve(dataDir, 'temp');

  try {
    const files = await fs.readdir(tempDir);
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stat = await fs.stat(filePath);
      if (stat.ctime < cutoffDate) {
        await fs.unlink(filePath);
      }
    }
  } catch {
    // 目录可能不存在
  }
}
