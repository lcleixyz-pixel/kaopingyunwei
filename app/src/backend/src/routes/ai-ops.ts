// ═══════════════════════════════════════════════════
// AI运维路由 — 备份、恢复、健康检查、日志分析
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import config from '../config/index.js';

const router = Router();

router.use(authenticate);
router.use(requireRoles(['SYS_ADMIN']));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../../data');
const BACKUP_DIR = path.resolve(__dirname, '../../../../data/backups');

// 确保备份目录存在
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch {
    // 目录已存在
  }
}

/**
 * GET /api/ai-ops/health — 系统健康状态
 */
router.get('/health', async (_req, res) => {
  try {
    // 检查数据库
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    // 检查磁盘
    const stat = await fs.stat(DATA_DIR);
    const diskTotal = 50 * 1024 * 1024 * 1024; // 假设50GB（简化）

    // 获取数据库文件大小
    const dbPath = path.join(DATA_DIR, 'exam.db');
    let dbSize = 0;
    try {
      const dbStat = await fs.stat(dbPath);
      dbSize = dbStat.size;
    } catch {
      // 文件不存在
    }

    // 获取系统运行时间（简化：从进程启动时间计算）
    const uptime = process.uptime();

    const health = {
      status: dbLatency > 1000 ? 'WARNING' : 'HEALTHY',
      database: {
        status: 'connected',
        latency: dbLatency,
        size: dbSize,
      },
      disk: {
        used: Math.round(dbSize / 1024 / 1024),
        total: Math.round(diskTotal / 1024 / 1024),
        percent: Math.round((dbSize / diskTotal) * 1000) / 10,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().rss / 1024 / 1024),
        percent: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().rss) * 1000) / 10,
      },
      uptime: Math.floor(uptime),
      version: '1.0.0',
    };

    success(res, health);
  } catch (err) {
    console.error('Health check error:', err);
    error(res, 'INTERNAL_ERROR', '健康检查失败', 500);
  }
});

/**
 * POST /api/ai-ops/backup — 执行备份
 */
router.post('/backup', async (_req, res) => {
  try {
    await ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // 复制数据库文件
    const dbPath = path.join(DATA_DIR, 'exam.db');
    await fs.copyFile(dbPath, backupPath);

    // 获取备份文件大小
    const stat = await fs.stat(backupPath);

    // 清理过期备份
    await cleanupOldBackups();

    success(res, {
      backupId: backupFileName,
      filePath: backupPath,
      fileSize: stat.size,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Backup error:', err);
    error(res, 'INTERNAL_ERROR', '备份失败', 500);
  }
});

/**
 * GET /api/ai-ops/backups — 备份列表
 */
router.get('/backups', async (_req, res) => {
  try {
    await ensureBackupDir();

    const files = await fs.readdir(BACKUP_DIR);
    const backups = await Promise.all(
      files
        .filter((f) => f.endsWith('.db'))
        .map(async (f) => {
          const stat = await fs.stat(path.join(BACKUP_DIR, f));
          return {
            id: f,
            fileName: f,
            size: stat.size,
            createdAt: stat.ctime.toISOString(),
          };
        })
    );

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    success(res, backups);
  } catch (err) {
    console.error('Get backups error:', err);
    error(res, 'INTERNAL_ERROR', '获取备份列表失败', 500);
  }
});

/**
 * POST /api/ai-ops/restore — 从备份恢复
 */
router.post('/restore', async (req, res) => {
  try {
    const { backupId } = req.body;

    if (!backupId) {
      error(res, 'VALIDATION_ERROR', '请指定备份文件', 400);
      return;
    }

    const backupPath = path.join(BACKUP_DIR, backupId);

    // 验证备份文件存在
    try {
      await fs.access(backupPath);
    } catch {
      error(res, 'NOT_FOUND', '备份文件不存在', 404);
      return;
    }

    // 先备份当前数据库（防止恢复失败）
    const dbPath = path.join(DATA_DIR, 'exam.db');
    const safeBackupPath = path.join(BACKUP_DIR, `pre-restore-${Date.now()}.db`);
    await fs.copyFile(dbPath, safeBackupPath);

    // 恢复备份
    await fs.copyFile(backupPath, dbPath);

    success(res, {
      message: '数据库恢复成功',
      restoredFrom: backupId,
      safeBackup: path.basename(safeBackupPath),
    });
  } catch (err) {
    console.error('Restore error:', err);
    error(res, 'INTERNAL_ERROR', '恢复失败', 500);
  }
});

/**
 * POST /api/ai-ops/export — 导出数据（用于迁移）
 */
router.post('/export', async (_req, res) => {
  try {
    await ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pkgName = `exam-system-export-${timestamp}`;
    const pkgPath = path.join(BACKUP_DIR, `${pkgName}.zip`);

    // 简化的导出：复制数据库 + 创建元数据文件
    const dbPath = path.join(DATA_DIR, 'exam.db');
    const metaPath = path.join(BACKUP_DIR, `${pkgName}.json`);

    const metadata = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      database: 'exam.db',
      tables: ['tenants', 'users', 'exam_plans', 'exam_nodes', 'candidates', 'scores', 'certificates', 'archives', 'reminders', 'audit_logs'],
    };

    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    // 复制数据库到临时位置
    const tempDbPath = path.join(BACKUP_DIR, `${pkgName}.db`);
    await fs.copyFile(dbPath, tempDbPath);

    success(res, {
      packageName: pkgName,
      files: [
        { name: `${pkgName}.db`, description: '数据库文件' },
        { name: `${pkgName}.json`, description: '导出元数据' },
      ],
      downloadUrl: `/api/ai-ops/download?file=${pkgName}.db`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    console.error('Export error:', err);
    error(res, 'INTERNAL_ERROR', '导出失败', 500);
  }
});

/**
 * GET /api/ai-ops/logs — 获取系统日志
 */
router.get('/logs', async (req, res) => {
  try {
    const { lines = '100' } = req.query;
    const maxLines = parseInt(lines as string, 10);

    // 简化：返回审计日志作为系统日志
    const logs = await prisma.auditLog.findMany({
      take: maxLines,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { realName: true, username: true },
        },
      },
    });

    success(res, logs);
  } catch (err) {
    console.error('Get logs error:', err);
    error(res, 'INTERNAL_ERROR', '获取日志失败', 500);
  }
});

// ─── 辅助函数 ───

async function cleanupOldBackups(): Promise<void> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const retentionDays = config.BACKUP_RETENTION_DAYS;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = await fs.stat(filePath);
      if (stat.ctime < cutoffDate) {
        await fs.unlink(filePath);
        console.log(`Deleted old backup: ${file}`);
      }
    }
  } catch (err) {
    console.error('Cleanup backups error:', err);
  }
}

export default router;
