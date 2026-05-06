// ═══════════════════════════════════════════════════
// 配置管理 — 集中管理所有环境变量
// ═══════════════════════════════════════════════════

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载环境变量（从项目根目录的 .env 文件）
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  
  // 数据库
  DATABASE_URL: process.env.DATABASE_URL || 'file:./data/exam.db',
  
  // 安全
  JWT_SECRET: process.env.JWT_SECRET || 'exam-system-default-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!',
  
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

export default config;
