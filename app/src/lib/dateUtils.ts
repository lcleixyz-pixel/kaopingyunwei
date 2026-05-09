// ═══════════════════════════════════════════════════
// 日期工具函数 — 工作日计算
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

/**
 * 计算从某个日期起N个工作日后的日期
 * @param startDate 起始日期
 * @param workDays 工作日数量（考前为负，考后为正）
 */
export function addWorkDays(startDate: Date | string, workDays: number): Date {
  const date = new Date(startDate);
  let remaining = Math.abs(workDays);
  const direction = workDays >= 0 ? 1 : -1;

  while (remaining > 0) {
    date.setDate(date.getDate() + direction);
    if (isWorkday(date)) {
      remaining--;
    }
  }

  return date;
}

/**
 * 计算两个日期之间的工作日数量
 */
export function countWorkDays(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    if (isWorkday(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * 计算截止日期（从考试日期倒推N个工作日）
 * @param examDate 考试日期
 * @param daysBefore 考前N天（正数）
 */
export function calculateDeadline(examDate: Date | string, daysBefore: number): Date {
  return addWorkDays(examDate, -daysBefore);
}

/**
 * 计算剩余工作日
 * @param deadline 截止日期
 */
export function getRemainingWorkDays(deadline: Date | string): number {
  const now = new Date();
  const dead = new Date(deadline);

  // 已过期的返回负数
  if (now > dead) {
    return -countWorkDays(dead, now);
  }

  return countWorkDays(now, dead);
}

/**
 * 格式化日期显示
 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 格式化日期时间显示
 */
export function formatDateTime(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 获取倒计时状态（用于UI显示）
 * @param deadline 截止日期
 * @returns { text: string, variant: 'normal' | 'warning' | 'danger' | 'overdue' }
 */
export function getCountdownStatus(deadline: Date | string): {
  text: string;
  variant: 'normal' | 'warning' | 'danger' | 'overdue';
} {
  const remaining = getRemainingWorkDays(deadline);

  if (remaining < 0) {
    return { text: `已逾期 ${Math.abs(remaining)} 个工作日`, variant: 'overdue' };
  }
  if (remaining <= 2) {
    return { text: `剩余 ${remaining} 个工作日`, variant: 'danger' };
  }
  if (remaining <= 5) {
    return { text: `剩余 ${remaining} 个工作日`, variant: 'warning' };
  }
  return { text: `剩余 ${remaining} 个工作日`, variant: 'normal' };
}
