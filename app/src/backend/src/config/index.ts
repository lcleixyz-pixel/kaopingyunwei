// ═══════════════════════════════════════════════════
// 配置管理 — 集中管理所有环境变量
// ═══════════════════════════════════════════════════

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载环境变量。开发、编译后运行、Docker 容器内的 __dirname 层级不同，
// 所以优先读取当前工作目录，再兼容旧路径。
for (const envPath of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../../.env'),
]) {
  dotenv.config({ path: envPath, override: false });
}

export const DEFAULT_JWT_SECRET = 'exam-system-default-secret-change-in-production';
export const DOCKER_DEFAULT_JWT_SECRET = 'exam-system-jwt-secret-change-me';
export const DEFAULT_ENCRYPTION_KEY = 'default-encryption-key-32-chars!';
export const DOCKER_DEFAULT_ENCRYPTION_KEY = 'exam-system-encryption-key-32';

export type ProductionConfig = {
  NODE_ENV: string;
  DATABASE_URL?: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  BACKUP_DIR: string;
  LOG_DIR: string;
  CORS_ORIGIN: string;
  IS_DOCKER_RUNTIME: boolean;
};

export type OperationalDirectoryConfig = Pick<ProductionConfig, 'BACKUP_DIR' | 'LOG_DIR'>;

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  
  // 数据库
  DATABASE_URL: process.env.DATABASE_URL || 'file:../../../data/exam.db',
  
  // 安全
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY,
  
  // 备份
  BACKUP_DIR: process.env.BACKUP_DIR || path.resolve(process.cwd(), 'data/backups'),
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  AUTO_BACKUP_ENABLED: process.env.AUTO_BACKUP_ENABLED !== 'false',
  AUTO_BACKUP_TIME: process.env.AUTO_BACKUP_TIME || '02:00',

  // 日志
  LOG_DIR: process.env.LOG_DIR || path.resolve(process.cwd(), 'data/logs'),
  
  // 提醒
  REMINDER_ENABLED: process.env.REMINDER_ENABLED !== 'false',
  SMS_ENABLED: process.env.SMS_ENABLED === 'true',
  EMAIL_ENABLED: process.env.EMAIL_ENABLED === 'true',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // 运行环境
  IS_DOCKER_RUNTIME: process.env.DOCKER_RUNTIME === 'true' || process.env.KUBERNETES_SERVICE_HOST !== undefined,
};

export function validateProductionSecrets(): void {
  validateProductionConfig(config);
}

export function ensureOperationalDirectories(values: OperationalDirectoryConfig): void {
  for (const [name, dir] of [
    ['BACKUP_DIR', values.BACKUP_DIR],
    ['LOG_DIR', values.LOG_DIR],
  ] as const) {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      throw new Error(`${name} 必须是目录: ${dir}`);
    }
  }
}

export function validateProductionConfig(values: ProductionConfig): void {
  if (values.NODE_ENV !== 'production') return;

  const insecureSecrets = new Set([
    DEFAULT_JWT_SECRET,
    DOCKER_DEFAULT_JWT_SECRET,
    'change-this-jwt-secret-before-production',
  ]);
  const insecureKeys = new Set([
    DEFAULT_ENCRYPTION_KEY,
    DOCKER_DEFAULT_ENCRYPTION_KEY,
    'change-this-encryption-key-32-chars-minimum',
    'your-32-char-encryption-key-here',
  ]);
  const errors: string[] = [];

  if (!values.DATABASE_URL) {
    errors.push('DATABASE_URL 不能为空');
  }
  if (insecureSecrets.has(values.JWT_SECRET) || values.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET 必须至少32字符且不能使用默认值');
  }
  if (insecureKeys.has(values.ENCRYPTION_KEY) || values.ENCRYPTION_KEY.length < 32) {
    errors.push('ENCRYPTION_KEY 必须至少32字符且不能使用默认值');
  }
  if (!values.BACKUP_DIR) {
    errors.push('BACKUP_DIR 不能为空');
  }
  if (!values.LOG_DIR) {
    errors.push('LOG_DIR 不能为空');
  }
  if (!values.CORS_ORIGIN || values.CORS_ORIGIN.trim() === '*') {
    errors.push('CORS_ORIGIN 生产环境不能为 *，必须配置明确的前端域名白名单');
  }

  if (values.IS_DOCKER_RUNTIME) {
    const dockerPaths = [values.DATABASE_URL, values.BACKUP_DIR, values.LOG_DIR].filter(Boolean);
    const allPersistentPaths = dockerPaths.every((value) => value!.includes('/app/data'));
    if (!allPersistentPaths) {
      errors.push('Docker 生产运行时 DATABASE_URL、BACKUP_DIR、LOG_DIR 必须指向 /app/data 持久化目录');
    }
  }

  if (errors.length > 0) {
    throw new Error(`生产配置检查失败: ${errors.join('; ')}`);
  }
}

export default config;
