// ═══════════════════════════════════════════════════
// AI运维路由 — 备份、恢复、健康检查、日志分析
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import config from '../config/index.js';
import { recordAudit } from '../utils/audit.js';

const router = Router();

router.use(authenticate);
router.use(requireRoles('SYS_ADMIN'));

const execFileAsync = promisify(execFile);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const TEMP_DIR = path.join(DATA_DIR, 'temp');
const DB_PATH = path.join(DATA_DIR, 'exam.db');

// 确保备份目录存在
async function ensureBackupDir(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

/**
 * GET /api/ai-ops/health — 系统健康状态
 */
router.get('/health', async (_req, res) => {
  try {
    await ensureBackupDir();
    // 检查数据库
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    // 检查磁盘
    const diskInfo = await fs.statfs(DATA_DIR);
    const diskTotal = diskInfo.blocks * diskInfo.bsize;
    const diskFree = diskInfo.bavail * diskInfo.bsize;
    const diskUsed = diskTotal - diskFree;

    // 获取数据库文件大小
    let dbSize = 0;
    try {
      const dbStat = await fs.stat(DB_PATH);
      dbSize = dbStat.size;
    } catch {
      // 文件不存在
    }

    const lastBackup = await getLastBackupInfo();

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
        used: Math.round(diskUsed / 1024 / 1024),
        total: Math.round(diskTotal / 1024 / 1024),
        percent: Math.round((diskUsed / diskTotal) * 1000) / 10,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().rss / 1024 / 1024),
        percent: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().rss) * 1000) / 10,
      },
      uptime: Math.floor(uptime),
      version: '1.0.0',
      lastBackup,
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
router.post('/backup', async (req, res) => {
  try {
    await ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // 复制数据库文件
    await fs.copyFile(DB_PATH, backupPath);

    // 获取备份文件大小
    const stat = await fs.stat(backupPath);

    // 清理过期备份
    await cleanupOldBackups();

    const payload = {
      backupId: backupFileName,
      filePath: backupPath,
      fileSize: stat.size,
      createdAt: new Date().toISOString(),
    };

    await recordAudit(req, {
      action: 'BACKUP_CREATE',
      target: 'Backup',
      targetId: backupFileName,
      newValue: payload,
    });

    success(res, payload);
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

    const safeBackupId = path.basename(backupId);
    const backupPath = path.join(BACKUP_DIR, safeBackupId);

    // 验证备份文件存在
    try {
      await fs.access(backupPath);
    } catch {
      error(res, 'NOT_FOUND', '备份文件不存在', 404);
      return;
    }

    // 先备份当前数据库（防止恢复失败）
    const safeBackupPath = path.join(BACKUP_DIR, `pre-restore-${Date.now()}.db`);
    await fs.copyFile(DB_PATH, safeBackupPath);

    // 恢复备份
    await fs.copyFile(backupPath, DB_PATH);

    await recordAudit(req, {
      action: 'RESTORE_BACKUP',
      target: 'Backup',
      targetId: safeBackupId,
      newValue: { restoredFrom: safeBackupId, safeBackup: path.basename(safeBackupPath) },
    });

    success(res, {
      message: '数据库恢复成功',
      restoredFrom: safeBackupId,
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
router.post('/export', async (req, res) => {
  try {
    await ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pkgName = `exam-system-export-${timestamp}`;
    const packageDir = path.join(TEMP_DIR, pkgName);
    const pkgPath = path.join(BACKUP_DIR, `${pkgName}.tar.gz`);

    await fs.rm(packageDir, { recursive: true, force: true });
    await fs.mkdir(path.join(packageDir, 'files'), { recursive: true });

    const metadata = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      database: 'exam.db',
      tables: ['tenants', 'users', 'exam_plans', 'exam_nodes', 'prospective_candidates', 'candidates', 'scores', 'certificates', 'archives', 'reminders', 'audit_logs'],
    };

    await fs.writeFile(path.join(packageDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    await fs.writeFile(
      path.join(packageDir, 'README.txt'),
      '迁移说明：将 exam.db 和 files 目录复制到新服务器 data 目录，然后执行 Docker Compose 启动。\n'
    );

    await fs.copyFile(DB_PATH, path.join(packageDir, 'exam.db'));
    await copyDirectoryIfExists(FILES_DIR, path.join(packageDir, 'files'));
    await execFileAsync('tar', ['-czf', pkgPath, '-C', TEMP_DIR, pkgName]);
    const stat = await fs.stat(pkgPath);

    await recordAudit(req, {
      action: 'EXPORT_CREATE',
      target: 'ExportPackage',
      targetId: `${pkgName}.tar.gz`,
      newValue: { packageName: pkgName, fileSize: stat.size },
    });

    success(res, {
      packageName: pkgName,
      files: [
        { name: 'exam.db', description: '数据库文件' },
        { name: 'files/', description: '上传文件目录' },
        { name: 'metadata.json', description: '导出元数据' },
        { name: 'README.txt', description: '恢复说明' },
      ],
      fileSize: stat.size,
      downloadUrl: `/api/ai-ops/download?file=${pkgName}.tar.gz`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    console.error('Export error:', err);
    error(res, 'INTERNAL_ERROR', '导出失败', 500);
  }
});

/**
 * GET /api/ai-ops/download — 下载备份或迁移包
 */
router.get('/download', async (req, res) => {
  try {
    const fileName = typeof req.query.file === 'string' ? path.basename(req.query.file) : '';
    if (!fileName) {
      error(res, 'VALIDATION_ERROR', '请指定下载文件', 400);
      return;
    }

    const filePath = path.join(BACKUP_DIR, fileName);
    try {
      await fs.access(filePath);
    } catch {
      error(res, 'NOT_FOUND', '下载文件不存在', 404);
      return;
    }

    res.download(filePath, fileName);
  } catch (err) {
    console.error('Download error:', err);
    error(res, 'INTERNAL_ERROR', '下载失败', 500);
  }
});

/**
 * GET /api/ai-ops/logs — 获取系统日志
 */
router.get('/logs', async (req, res) => {
  try {
    const { lines = '100' } = req.query;
    const maxLines = parseInt(lines as string, 10);
    const tenantId = req.tenantId!;

    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
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

async function getLastBackupInfo(): Promise<{ fileName: string; createdAt: string; size: number } | null> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = await Promise.all(
      files
        .filter((file) => file.endsWith('.db') || file.endsWith('.tar.gz'))
        .map(async (file) => {
          const stat = await fs.stat(path.join(BACKUP_DIR, file));
          return { fileName: file, createdAt: stat.ctime.toISOString(), size: stat.size };
        })
    );

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return backups[0] || null;
  } catch {
    return null;
  }
}

async function copyDirectoryIfExists(from: string, to: string): Promise<void> {
  try {
    await fs.cp(from, to, { recursive: true });
  } catch {
    await fs.mkdir(to, { recursive: true });
  }
}

export default router;
