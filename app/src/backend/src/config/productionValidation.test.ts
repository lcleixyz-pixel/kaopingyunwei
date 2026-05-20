import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  DEFAULT_ENCRYPTION_KEY,
  DEFAULT_JWT_SECRET,
  ensureOperationalDirectories,
  validateProductionConfig,
} from './index.js';

describe('production config validation', () => {
  const secureProductionConfig = {
    NODE_ENV: 'production',
    DATABASE_URL: 'file:/app/data/exam.db',
    JWT_SECRET: 'a-secure-jwt-secret-with-more-than-32-chars',
    ENCRYPTION_KEY: 'a-secure-encryption-key-with-32-chars',
    BACKUP_DIR: '/app/data/backups',
    LOG_DIR: '/app/data/logs',
    IS_DOCKER_RUNTIME: true,
    CORS_ORIGIN: 'https://exam.example.com',
  };

  it('rejects production defaults and missing operational directories', () => {
    assert.throws(
      () => validateProductionConfig({
        ...secureProductionConfig,
        DATABASE_URL: undefined,
        JWT_SECRET: DEFAULT_JWT_SECRET,
        ENCRYPTION_KEY: DEFAULT_ENCRYPTION_KEY,
        BACKUP_DIR: '',
        LOG_DIR: '',
      }),
      /DATABASE_URL.*JWT_SECRET.*ENCRYPTION_KEY.*BACKUP_DIR.*LOG_DIR/s
    );
  });

  it('rejects example placeholder secrets even when they are long enough', () => {
    assert.throws(
      () => validateProductionConfig({
        ...secureProductionConfig,
        JWT_SECRET: 'change-this-jwt-secret-before-production',
        ENCRYPTION_KEY: 'change-this-encryption-key-32-chars-minimum',
      }),
      /JWT_SECRET.*ENCRYPTION_KEY/s
    );
  });

  it('rejects Docker production startup when persistent paths are not under /app/data', () => {
    assert.throws(
      () => validateProductionConfig({
        ...secureProductionConfig,
        DATABASE_URL: 'file:../../../data/exam.db',
        BACKUP_DIR: './data/backups',
        LOG_DIR: './logs',
      }),
      /Docker.*\/app\/data/s
    );
  });

  it('rejects wildcard CORS in production', () => {
    assert.throws(
      () => validateProductionConfig({
        ...secureProductionConfig,
        CORS_ORIGIN: '*',
      }),
      /CORS_ORIGIN.*不能为 \*/s
    );
  });

  it('accepts a complete production configuration', () => {
    assert.doesNotThrow(() => validateProductionConfig(secureProductionConfig));
  });

  it('creates required operational directories before startup', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-config-'));
    const backupDir = path.join(root, 'backups');
    const logDir = path.join(root, 'logs');

    ensureOperationalDirectories({ BACKUP_DIR: backupDir, LOG_DIR: logDir });

    assert.equal(fs.statSync(backupDir).isDirectory(), true);
    assert.equal(fs.statSync(logDir).isDirectory(), true);
  });

  it('only treats backup and log paths as operational directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-config-'));
    const backupDir = path.join(root, 'backups');
    const logDir = path.join(root, 'logs');

    assert.doesNotThrow(() => ensureOperationalDirectories({
      BACKUP_DIR: backupDir,
      LOG_DIR: logDir,
      PORT: 3001,
      NODE_ENV: 'production',
    } as any));
  });
});
