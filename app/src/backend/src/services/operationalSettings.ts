import config from '../config/index.js';
import { prisma } from '../lib/prisma.js';

export type ReminderIntensity = 'STANDARD' | 'ENHANCED';

export interface OperationalSettings {
  reminderEnabled: boolean;
  reminderIntensity: ReminderIntensity;
  autoBackupEnabled: boolean;
  autoBackupTime: string;
  backupRetentionDays: number;
}

export interface ReminderPolicy {
  lookaheadDays: number;
  cooldownHours: number;
  advanceDayBoost: number;
}

interface ConfigRow {
  key: string;
  value: string;
}

export function defaultOperationalSettings(): OperationalSettings {
  return {
    reminderEnabled: config.REMINDER_ENABLED,
    reminderIntensity: 'ENHANCED',
    autoBackupEnabled: config.AUTO_BACKUP_ENABLED,
    autoBackupTime: config.AUTO_BACKUP_TIME,
    backupRetentionDays: config.BACKUP_RETENTION_DAYS,
  };
}

export async function getOperationalSettings(): Promise<OperationalSettings> {
  const rows = await prisma.config.findMany({
    where: {
      key: {
        in: [
          'reminderEnabled',
          'reminderIntensity',
          'autoBackupEnabled',
          'autoBackupTime',
          'backupRetentionDays',
        ],
      },
    },
    select: { key: true, value: true },
  });

  return normalizeOperationalSettings(rows, defaultOperationalSettings());
}

export function normalizeOperationalSettings(
  rows: ConfigRow[],
  defaults: OperationalSettings
): OperationalSettings {
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    reminderEnabled: parseBoolean(values.get('reminderEnabled'), defaults.reminderEnabled),
    reminderIntensity: parseReminderIntensity(values.get('reminderIntensity'), defaults.reminderIntensity),
    autoBackupEnabled: parseBoolean(values.get('autoBackupEnabled'), defaults.autoBackupEnabled),
    autoBackupTime: parseTime(values.get('autoBackupTime'), defaults.autoBackupTime),
    backupRetentionDays: parsePositiveInteger(values.get('backupRetentionDays'), defaults.backupRetentionDays),
  };
}

export function getReminderPolicy(intensity: ReminderIntensity): ReminderPolicy {
  if (intensity === 'ENHANCED') {
    return {
      lookaheadDays: 3,
      cooldownHours: 12,
      advanceDayBoost: 1,
    };
  }

  return {
    lookaheadDays: 2,
    cooldownHours: 24,
    advanceDayBoost: 0,
  };
}

export function shouldRunDailyBackup(
  now: Date,
  settings: OperationalSettings,
  lastBackupDateKey: string | null
): boolean {
  if (!settings.autoBackupEnabled) return false;
  if (lastBackupDateKey === toLocalDateKey(now)) return false;

  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return currentTime === settings.autoBackupTime;
}

export function toLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseReminderIntensity(value: string | undefined, fallback: ReminderIntensity): ReminderIntensity {
  if (value === 'STANDARD' || value === 'ENHANCED') return value;
  return fallback;
}

function parseTime(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return fallback;

  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}
