// ═══════════════════════════════════════════════════
// 设置路由 — 系统配置 KV 存储
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { recordAudit } from '../utils/audit.js';
import { canReadAcrossTenants } from '../services/accessScope.js';
import { parseDateArray } from '../services/workdayCalendars.js';

const router = Router();

router.use(authenticate);

const DEFAULT_SETTINGS: Record<string, string> = {
  systemName: '考评分支机构管理系统',
  organizationName: 'XX职业技能鉴定中心',
  dataRetentionYears: '8',
  autoBackupTime: '02:00',
  backupRetentionDays: '30',
  autoBackupEnabled: 'true',
  reminderEnabled: 'true',
  emailEnabled: 'false',
};

const settingsSchema = z.object({
  systemName: z.string().min(1).optional(),
  organizationName: z.string().min(1).optional(),
  dataRetentionYears: z.string().optional(),
  autoBackupTime: z.string().optional(),
  backupRetentionDays: z.string().optional(),
  autoBackupEnabled: z.string().optional(),
  reminderEnabled: z.string().optional(),
  emailEnabled: z.string().optional(),
});

const workdayCalendarSchema = z.object({
  tenantId: z.string().uuid().optional(),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  workdays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
});

router.get('/', async (_req, res) => {
  try {
    const rows = await prisma.config.findMany();
    const settings = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      settings[row.key] = row.value;
    }

    success(res, settings);
  } catch (err) {
    console.error('Get settings error:', err);
    error(res, 'INTERNAL_ERROR', '获取设置失败', 500);
  }
});

router.patch('/', requireRoles('SYS_ADMIN', 'HQ_ADMIN'), async (req, res) => {
  try {
    const result = settingsSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const entries = Object.entries(result.data).filter(([, value]) => value !== undefined);

    for (const [key, value] of entries) {
      await prisma.config.upsert({
        where: { key },
        update: { value: value as string },
        create: { key, value: value as string },
      });
    }

    await recordAudit(req, {
      action: 'SETTINGS_UPDATE',
      target: 'Config',
      newValue: result.data,
    });

    const rows = await prisma.config.findMany();
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of rows) settings[row.key] = row.value;

    success(res, settings);
  } catch (err) {
    console.error('Update settings error:', err);
    error(res, 'INTERNAL_ERROR', '保存设置失败', 500);
  }
});

router.get('/workday-calendars', async (req, res) => {
  try {
    const rows = await prisma.workdayCalendar.findMany({
      where: canReadAcrossTenants(req.userRole) ? {} : { tenantId: req.tenantId! },
      orderBy: { updatedAt: 'desc' },
      include: {
        tenant: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    success(res, rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      tenant: row.tenant,
      holidays: parseDateArray(row.holidays),
      workdays: parseDateArray(row.workdays),
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })));
  } catch (err) {
    console.error('Get workday calendars error:', err);
    error(res, 'INTERNAL_ERROR', '获取工作日历失败', 500);
  }
});

router.patch('/workday-calendars', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const result = workdayCalendarSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const targetTenantId = result.data.tenantId || req.tenantId!;
    if (req.userRole !== 'SYS_ADMIN' && targetTenantId !== req.tenantId) {
      error(res, 'FORBIDDEN', '只能维护本分支工作日历', 403);
      return;
    }

    const oldCalendar = await prisma.workdayCalendar.findUnique({
      where: { tenantId: targetTenantId },
    });

    const calendar = await prisma.workdayCalendar.upsert({
      where: { tenantId: targetTenantId },
      update: {
        holidays: JSON.stringify(result.data.holidays),
        workdays: JSON.stringify(result.data.workdays),
        updatedBy: req.userId,
      },
      create: {
        tenantId: targetTenantId,
        holidays: JSON.stringify(result.data.holidays),
        workdays: JSON.stringify(result.data.workdays),
        updatedBy: req.userId,
      },
      include: {
        tenant: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    await recordAudit(req, {
      action: 'WORKDAY_CALENDAR_UPDATE',
      target: 'WorkdayCalendar',
      targetId: calendar.id,
      oldValue: oldCalendar,
      newValue: {
        tenantId: calendar.tenantId,
        holidays: result.data.holidays,
        workdays: result.data.workdays,
      },
    });

    success(res, {
      id: calendar.id,
      tenantId: calendar.tenantId,
      tenant: calendar.tenant,
      holidays: parseDateArray(calendar.holidays),
      workdays: parseDateArray(calendar.workdays),
      updatedBy: calendar.updatedBy,
      createdAt: calendar.createdAt,
      updatedAt: calendar.updatedAt,
    });
  } catch (err) {
    console.error('Update workday calendar error:', err);
    error(res, 'INTERNAL_ERROR', '保存工作日历失败', 500);
  }
});

export default router;
