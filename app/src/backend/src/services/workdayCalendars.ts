import { prisma } from '../lib/prisma.js';
import type { WorkdayCalendarConfig } from '../utils/dateUtils.js';

export async function getWorkdayCalendarConfig(tenantId: string): Promise<WorkdayCalendarConfig> {
  const row = await prisma.workdayCalendar.findUnique({
    where: { tenantId },
  });

  return {
    holidays: parseDateArray(row?.holidays),
    workdays: parseDateArray(row?.workdays),
  };
}

export function parseDateArray(value?: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item))
      : [];
  } catch {
    return [];
  }
}
