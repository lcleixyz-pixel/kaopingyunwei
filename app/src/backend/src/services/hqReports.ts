import type { Request } from 'express';
import { publishedPlanWhereForRead, type PlanReadWhere } from './accessScope.js';

export function registrationProgressPlanWhere(req: Request): PlanReadWhere {
  return publishedPlanWhereForRead(req);
}
