import type { Request } from 'express';

export function canReadAcrossTenants(role?: string): boolean {
  return role === 'SYS_ADMIN' || role === 'HQ_ADMIN' || role === 'HQ_STAFF';
}

export function tenantWhereForRead(req: Request): { tenantId?: string } {
  return canReadAcrossTenants(req.userRole) ? {} : { tenantId: req.tenantId! };
}

export function planTenantWhereForRead(req: Request): { tenantId?: string } {
  return canReadAcrossTenants(req.userRole) ? {} : { tenantId: req.tenantId! };
}

export function nestedPlanTenantWhereForRead(req: Request): { plan: { tenantId?: string } } {
  return { plan: planTenantWhereForRead(req) };
}
