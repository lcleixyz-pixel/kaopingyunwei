import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { downloadFileQuerySchema, logsQuerySchema, restoreBackupSchema } from './aiOpsSchemas.js';

describe('AI ops request schemas', () => {
  it('accepts local backup database files for restore', () => {
    const result = restoreBackupSchema.parse({ backupId: 'backup_2026-05-17T10-00-00-000Z.db' });

    assert.equal(result.backupId, 'backup_2026-05-17T10-00-00-000Z.db');
  });

  it('rejects restore backup ids that include paths or wrong extensions', () => {
    assert.equal(restoreBackupSchema.safeParse({ backupId: '../exam.db' }).success, false);
    assert.equal(restoreBackupSchema.safeParse({ backupId: 'exam-system-export-2026.tar.gz' }).success, false);
  });

  it('accepts only backup databases and migration packages for download', () => {
    assert.equal(downloadFileQuerySchema.parse({ file: 'backup_2026.db' }).file, 'backup_2026.db');
    assert.equal(downloadFileQuerySchema.parse({ file: 'exam-system-export-2026.tar.gz' }).file, 'exam-system-export-2026.tar.gz');
    assert.equal(downloadFileQuerySchema.safeParse({ file: '../../.env' }).success, false);
    assert.equal(downloadFileQuerySchema.safeParse({ file: 'report.xlsx' }).success, false);
  });

  it('normalizes audit log line counts and caps them to a safe range', () => {
    assert.equal(logsQuerySchema.parse({}).lines, 100);
    assert.equal(logsQuerySchema.parse({ lines: '25' }).lines, 25);
    assert.equal(logsQuerySchema.safeParse({ lines: '0' }).success, false);
    assert.equal(logsQuerySchema.safeParse({ lines: '1000' }).success, false);
  });
});
