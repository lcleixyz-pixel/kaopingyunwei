// ═══════════════════════════════════════════════════
// 定时任务调度器 — 自动提醒 + 自动备份 + 逾期检测
// ═══════════════════════════════════════════════════

import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import {
  getReminderPolicy,
  getOperationalSettings,
  type OperationalSettings,
  shouldRunDailyBackup,
  toLocalDateKey,
} from '../services/operationalSettings.js';
import { logger } from '../utils/logger.js';

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
  logger.info('定时任务调度器已启动');
  let lastAutoBackupDateKey: string | null = null;

  // 每分钟检查一次节点状态、提醒生成和按配置触发自动备份
  cron.schedule('*/1 * * * *', async () => {
    try {
      const settings = await getOperationalSettings();
      await checkOverdueNodes();

      if (settings.reminderEnabled) {
        await generateReminders(settings);
      }

      const now = new Date();
      if (shouldRunDailyBackup(now, settings, lastAutoBackupDateKey)) {
        logger.info('开始执行自动备份');
        await performAutoBackup(settings.backupRetentionDays);
        lastAutoBackupDateKey = toLocalDateKey(now);
      }
    } catch (err) {
      logger.error({ err }, '定时任务执行失败');
    }
  });

  // 每天凌晨3点清理临时文件
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('开始清理临时文件');
      await cleanupTempFiles();
    } catch (err) {
      logger.error({ err }, '清理临时文件失败');
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
    logger.warn({ planTitle: node.plan.title, nodeType: node.nodeType }, '节点已逾期');
  }
}

/**
 * 生成提醒
 */
async function generateReminders(settings: OperationalSettings): Promise<void> {
  const now = new Date();
  const policy = getReminderPolicy(settings.reminderIntensity);
  const reminderWindow = new Date(now.getTime() + policy.lookaheadDays * 24 * 60 * 60 * 1000);

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
          createdAt: { gte: new Date(now.getTime() - policy.cooldownHours * 60 * 60 * 1000) },
        },
      },
    },
  });

  for (const node of upcomingNodes) {
    const rules = REMINDER_RULES[node.nodeType] || [];
    const hoursRemaining = (node.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    const type = hoursRemaining < 0 ? 'NODE_OVERDUE' : 'NODE_DEADLINE';

    for (const rule of rules) {
      const beforeDays = rule.beforeDays > 0 ? rule.beforeDays + policy.advanceDayBoost : rule.beforeDays;
      if (hoursRemaining < 0 || hoursRemaining <= beforeDays * 24) {
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
          logger.info({ planTitle: node.plan.title, reminder: rule.message }, '已生成提醒');
        }
      }
    }
  }
}

/**
 * 自动备份
 */
async function performAutoBackup(retentionDays: number): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const dataDir = path.resolve(process.cwd(), 'data');
  const backupDir = path.resolve(dataDir, 'backups');
  
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `auto-backup-${timestamp}.db`);
  const dbPath = path.join(dataDir, 'exam.db');

  await fs.copyFile(dbPath, backupPath);
  logger.info({ backupPath }, '自动备份完成');

  // 清理过期备份
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const files = await fs.readdir(backupDir);
  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stat = await fs.stat(filePath);
    if (stat.ctime < cutoffDate) {
      await fs.unlink(filePath);
      logger.info({ file }, '已删除过期备份');
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
