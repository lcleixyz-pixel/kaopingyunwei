export const SETTINGS_READ_ROLES = ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] as const;
export const SETTINGS_WRITE_ROLES = ['SYS_ADMIN', 'HQ_ADMIN'] as const;

export function canReadGlobalSettings(role?: string | null): boolean {
  return SETTINGS_READ_ROLES.includes(role as (typeof SETTINGS_READ_ROLES)[number]);
}

export function canWriteGlobalSettings(role?: string | null): boolean {
  return SETTINGS_WRITE_ROLES.includes(role as (typeof SETTINGS_WRITE_ROLES)[number]);
}
