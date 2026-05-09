// ═══════════════════════════════════════════════════
// 日期工具 — 工作日计算
// ═══════════════════════════════════════════════════

/**
 * 判断是否为周末
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 判断是否为法定节假日（简化版，后续可扩展为配置表）
 */
export function isHoliday(_date: Date): boolean {
  // TODO: 接入节假日配置表
  return false;
}

/**
 * 判断是否为工作日
 */
export function isWorkday(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

export interface WorkdayCalendarConfig {
  holidays?: string[];
  workdays?: string[];
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWorkdayWithCalendar(date: Date, calendar?: WorkdayCalendarConfig | null): boolean {
  const dateKey = toDateKey(date);
  const workdays = new Set(calendar?.workdays || []);
  const holidays = new Set(calendar?.holidays || []);

  if (workdays.has(dateKey)) return true;
  if (holidays.has(dateKey)) return false;

  return !isWeekend(date);
}

/**
 * 计算从某个日期起N个工作日后的日期
 */
export function addWorkDays(startDate: Date, workDays: number): Date {
  return addWorkDaysWithCalendar(startDate, workDays);
}

export function addWorkDaysWithCalendar(
  startDate: Date,
  workDays: number,
  calendar?: WorkdayCalendarConfig | null
): Date {
  const date = new Date(startDate);
  let remaining = Math.abs(workDays);
  const direction = workDays >= 0 ? 1 : -1;

  while (remaining > 0) {
    date.setDate(date.getDate() + direction);
    if (isWorkdayWithCalendar(date, calendar)) {
      remaining--;
    }
  }

  return date;
}

/**
 * 计算两个日期之间的工作日数量
 */
export function countWorkDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    if (isWorkday(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * 计算节点截止时间（从考试日期倒推或顺推N个工作日）
 */
export function calculateNodeDeadline(examDate: Date, relativeDays: number): Date {
  return addWorkDays(examDate, relativeDays);
}

/**
 * 计算剩余工作日
 */
export function getRemainingWorkDays(deadline: Date): number {
  const now = new Date();
  const dead = new Date(deadline);

  if (now > dead) {
    return -countWorkDays(dead, now);
  }

  return countWorkDays(now, dead);
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
