import type { TenantType, UserRole, UserStatus } from '@prisma/client';

const USER_MANAGERS = new Set<UserRole>(['SYS_ADMIN', 'HQ_ADMIN']);

const ASSIGNABLE_ROLES: Record<'SYS_ADMIN' | 'HQ_ADMIN', UserRole[]> = {
  SYS_ADMIN: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'],
  HQ_ADMIN: ['HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'],
};

const HQ_ROLES = new Set<UserRole>(['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF']);
const BRANCH_ROLES = new Set<UserRole>(['BRANCH_ADMIN', 'BRANCH_STAFF']);

export function canAccessUserManagement(role?: string | null): boolean {
  return USER_MANAGERS.has(role as UserRole);
}

export function getAssignableUserRoles(actorRole?: string | null): UserRole[] {
  if (actorRole === 'SYS_ADMIN' || actorRole === 'HQ_ADMIN') {
    return ASSIGNABLE_ROLES[actorRole];
  }
  return [];
}

export function canAssignUserRole(actorRole: string | undefined | null, targetRole: string): boolean {
  return getAssignableUserRoles(actorRole).includes(targetRole as UserRole);
}

export function isRoleCompatibleWithTenant(role: string, tenantType: string): boolean {
  if (tenantType === 'HQ') return HQ_ROLES.has(role as UserRole);
  if (tenantType === 'BRANCH') return BRANCH_ROLES.has(role as UserRole);
  return false;
}

export function canManageTargetUser(input: {
  actorRole?: string | null;
  actorUserId?: string | null;
  targetRole: string;
  targetUserId: string;
  nextRole?: string;
  nextStatus?: UserStatus;
}): boolean {
  if (!canAccessUserManagement(input.actorRole)) return false;
  if (!canAssignUserRole(input.actorRole, input.targetRole)) return false;
  if (input.nextRole && !canAssignUserRole(input.actorRole, input.nextRole)) return false;

  if (
    input.actorUserId &&
    input.actorUserId === input.targetUserId &&
    (input.nextStatus === 'INACTIVE' || input.nextStatus === 'LOCKED')
  ) {
    return false;
  }

  return true;
}

export function accountTenantTypeForRole(role: string): TenantType | null {
  if (HQ_ROLES.has(role as UserRole)) return 'HQ';
  if (BRANCH_ROLES.has(role as UserRole)) return 'BRANCH';
  return null;
}
