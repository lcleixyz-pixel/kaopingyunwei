import type { Request } from 'express';

export type PlanReadWhere = { tenantId?: string; status?: 'PUBLISHED' };

export function canReadAcrossTenants(role?: string): boolean {
  return role === 'SYS_ADMIN' || role === 'HQ_ADMIN' || role === 'HQ_STAFF';
}

export function tenantWhereForRead(req: Request): { tenantId?: string } {
  return canReadAcrossTenants(req.userRole) ? {} : { tenantId: req.tenantId! };
}

export function planTenantWhereForRead(req: Request): PlanReadWhere {
  return canReadAcrossTenants(req.userRole) ? { status: 'PUBLISHED' } : { tenantId: req.tenantId! };
}

export function publishedPlanWhereForRead(req: Request): PlanReadWhere {
  return canReadAcrossTenants(req.userRole)
    ? { status: 'PUBLISHED' }
    : { tenantId: req.tenantId!, status: 'PUBLISHED' };
}

export function nestedPlanTenantWhereForRead(req: Request): { plan: PlanReadWhere } {
  return { plan: planTenantWhereForRead(req) };
}

export function nestedPublishedPlanWhereForRead(req: Request): { plan: PlanReadWhere } {
  return { plan: publishedPlanWhereForRead(req) };
}

export function isRequestedPlanStatusVisibleForRead(req: Request, status: unknown): boolean {
  if (typeof status !== 'string' || status === 'ALL') return true;
  if (!canReadAcrossTenants(req.userRole)) return true;
  return status === 'PUBLISHED';
}
