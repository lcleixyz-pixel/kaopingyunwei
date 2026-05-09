import type { PlanStatus, UserRole } from '@prisma/client';

const PROSPECTIVE_ACCESS_ROLES: UserRole[] = ['BRANCH_ADMIN', 'BRANCH_STAFF'];

export interface ConvertToFormalInput {
  prospectiveTenantId: string;
  planTenantId: string;
  planStatus: PlanStatus;
  registrationClosed?: boolean;
}

export interface RevertProspectiveOnPlanRollbackInput {
  prospectiveStatus: string;
  convertedCandidatePlanId?: string | null;
  rolledBackPlanId: string;
}

export type RejectedCandidateDisposition = 'RESTORE_EXISTING_PROSPECT' | 'CREATE_OR_UPDATE_PROSPECT';

export interface RejectedCandidateDispositionInput {
  hasProspectiveSource: boolean;
}

export function canAccessProspectiveCandidates(role: string): boolean {
  return PROSPECTIVE_ACCESS_ROLES.includes(role as UserRole);
}

export function canDeleteProspectiveCandidate(role: string): boolean {
  return role === 'BRANCH_ADMIN';
}

export function canConvertProspectiveCandidate(role: string): boolean {
  return PROSPECTIVE_ACCESS_ROLES.includes(role as UserRole);
}

export function canConvertToFormalCandidate(input: ConvertToFormalInput): boolean {
  return input.prospectiveTenantId === input.planTenantId
    && input.planStatus === 'PUBLISHED'
    && !input.registrationClosed;
}

export function shouldRevertProspectiveOnPlanRollback(input: RevertProspectiveOnPlanRollbackInput): boolean {
  return input.prospectiveStatus === 'CONVERTED' && input.convertedCandidatePlanId === input.rolledBackPlanId;
}

export function getRejectedCandidateDisposition(input: RejectedCandidateDispositionInput): RejectedCandidateDisposition {
  return input.hasProspectiveSource ? 'RESTORE_EXISTING_PROSPECT' : 'CREATE_OR_UPDATE_PROSPECT';
}
