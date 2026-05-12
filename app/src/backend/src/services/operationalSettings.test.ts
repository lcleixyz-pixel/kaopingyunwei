import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getReminderPolicy,
  normalizeOperationalSettings,
  shouldRunDailyBackup,
  toLocalDateKey,
} from './operationalSettings.js';

describe('Operational settings', () => {
  it('uses saved Config rows to control reminders and backups', () => {
    const settings = normalizeOperationalSettings([
      { key: 'reminderEnabled', value: 'false' },
      { key: 'autoBackupEnabled', value: 'false' },
      { key: 'autoBackupTime', value: '03:30' },
      { key: 'backupRetentionDays', value: '7' },
    ], {
      reminderEnabled: true,
      reminderIntensity: 'STANDARD',
      autoBackupEnabled: true,
      autoBackupTime: '02:00',
      backupRetentionDays: 30,
    });

    assert.equal(settings.reminderEnabled, false);
    assert.equal(settings.reminderIntensity, 'STANDARD');
    assert.equal(settings.autoBackupEnabled, false);
    assert.equal(settings.autoBackupTime, '03:30');
    assert.equal(settings.backupRetentionDays, 7);
  });

  it('falls back to environment defaults for invalid persisted values', () => {
    const settings = normalizeOperationalSettings([
      { key: 'autoBackupTime', value: '99:99' },
      { key: 'backupRetentionDays', value: 'bad-number' },
      { key: 'reminderIntensity', value: 'LOUD' },
    ], {
      reminderEnabled: true,
      reminderIntensity: 'ENHANCED',
      autoBackupEnabled: true,
      autoBackupTime: '01:15',
      backupRetentionDays: 30,
    });

    assert.equal(settings.reminderIntensity, 'ENHANCED');
    assert.equal(settings.autoBackupTime, '01:15');
    assert.equal(settings.backupRetentionDays, 30);
  });

  it('uses enhanced reminder intensity for earlier and more frequent reminders', () => {
    const standard = getReminderPolicy('STANDARD');
    const enhanced = getReminderPolicy('ENHANCED');

    assert.deepEqual(standard, {
      lookaheadDays: 2,
      cooldownHours: 24,
      advanceDayBoost: 0,
    });
    assert.deepEqual(enhanced, {
      lookaheadDays: 3,
      cooldownHours: 12,
      advanceDayBoost: 1,
    });
  });

  it('runs daily backup only once at the configured minute while enabled', () => {
    const settings = normalizeOperationalSettings([
      { key: 'autoBackupEnabled', value: 'true' },
      { key: 'autoBackupTime', value: '02:05' },
    ], {
      reminderEnabled: true,
      reminderIntensity: 'STANDARD',
      autoBackupEnabled: false,
      autoBackupTime: '01:15',
      backupRetentionDays: 30,
    });
    const now = new Date(2026, 4, 12, 2, 5, 30);
    const today = toLocalDateKey(now);

    assert.equal(shouldRunDailyBackup(now, settings, null), true);
    assert.equal(shouldRunDailyBackup(now, settings, today), false);
    assert.equal(shouldRunDailyBackup(new Date(2026, 4, 12, 2, 6, 0), settings, null), false);
    assert.equal(shouldRunDailyBackup(now, { ...settings, autoBackupEnabled: false }, null), false);
  });
});
