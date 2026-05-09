// ═══════════════════════════════════════════════════
// 配置管理 — 集中管理所有环境变量
// ═══════════════════════════════════════════════════

import dotenv from 'dotenv';
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

const DEFAULT_JWT_SECRET = 'exam-system-default-secret-change-in-production';
const DOCKER_DEFAULT_JWT_SECRET = 'exam-system-jwt-secret-change-me';
const DEFAULT_ENCRYPTION_KEY = 'default-encryption-key-32-chars!';
const DOCKER_DEFAULT_ENCRYPTION_KEY = 'exam-system-encryption-key-32';

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
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  AUTO_BACKUP_ENABLED: process.env.AUTO_BACKUP_ENABLED !== 'false',
  AUTO_BACKUP_TIME: process.env.AUTO_BACKUP_TIME || '02:00',
  
  // 提醒
  REMINDER_ENABLED: process.env.REMINDER_ENABLED !== 'false',
  SMS_ENABLED: process.env.SMS_ENABLED === 'true',
  EMAIL_ENABLED: process.env.EMAIL_ENABLED === 'true',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

export function validateProductionSecrets(): void {
  if (config.NODE_ENV !== 'production') return;

  const insecureSecrets = new Set([
    DEFAULT_JWT_SECRET,
    DOCKER_DEFAULT_JWT_SECRET,
  ]);
  const insecureKeys = new Set([
    DEFAULT_ENCRYPTION_KEY,
    DOCKER_DEFAULT_ENCRYPTION_KEY,
    'your-32-char-encryption-key-here',
  ]);

  if (insecureSecrets.has(config.JWT_SECRET)) {
    throw new Error('生产环境必须设置安全的 JWT_SECRET，不能使用默认值');
  }
  if (insecureKeys.has(config.ENCRYPTION_KEY) || config.ENCRYPTION_KEY.length < 32) {
    throw new Error('生产环境必须设置至少32字符的 ENCRYPTION_KEY，不能使用默认值');
  }
}

export default config;
