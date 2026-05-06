// ═══════════════════════════════════════════════════
// 加密工具 — 密码哈希、JWT、数据加密
// ═══════════════════════════════════════════════════

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

// ─── 密码哈希 ───
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ───
export function generateToken(userId: string, tenantId: string, role: string): string {
  return jwt.sign(
    { userId, tenantId, role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): { userId: string; tenantId: string; role: string } {
  return jwt.verify(token, config.JWT_SECRET) as { userId: string; tenantId: string; role: string };
}

// ─── 简单对称加密（用于身份证号等敏感数据） ───
// 注意：生产环境应使用更强大的加密方案
export function encrypt(text: string): string {
  const key = config.ENCRYPTION_KEY;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

export function decrypt(encrypted: string): string {
  const key = config.ENCRYPTION_KEY;
  const text = Buffer.from(encrypted, 'base64').toString('ascii');
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

// ─── SHA-256 哈希（用于档案封存） ───
import crypto from 'crypto';

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
