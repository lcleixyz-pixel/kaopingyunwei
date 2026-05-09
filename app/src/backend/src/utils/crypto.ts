// ═══════════════════════════════════════════════════
// 加密工具 — 密码哈希、JWT、数据加密
// ═══════════════════════════════════════════════════

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
  const options: jwt.SignOptions = {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(
    { userId, tenantId, role },
    config.JWT_SECRET,
    options
  );
}

export function verifyToken(token: string): { userId: string; tenantId: string; role: string } {
  return jwt.verify(token, config.JWT_SECRET) as { userId: string; tenantId: string; role: string };
}

// ─── AES-GCM 对称加密（用于身份证号等敏感数据） ───
function encryptionKey(): Buffer {
  return crypto.createHash('sha256').update(config.ENCRYPTION_KEY).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decrypt(encrypted: string): string {
  if (!encrypted.startsWith('v1:')) {
    return decryptLegacyOrPlainText(encrypted);
  }

  const [, ivValue, tagValue, ciphertextValue] = encrypted.split(':');
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Invalid encrypted payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

// ─── SHA-256 哈希（用于档案封存） ───
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function decryptLegacyOrPlainText(value: string): string {
  try {
    const key = config.ENCRYPTION_KEY;
    const text = Buffer.from(value, 'base64').toString('ascii');
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return /^[\dXx]{15,18}$/.test(result) ? result : value;
  } catch {
    return value;
  }
}
