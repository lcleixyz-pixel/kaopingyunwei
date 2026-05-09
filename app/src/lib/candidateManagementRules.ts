export interface CandidateManagementPlanLike {
  id: string;
  status: string;
}

export function shouldLoadCandidatesForPlan(planId: string | null | undefined): boolean {
  return Boolean(planId?.trim());
}

export function getCandidateManagementPlanOptions<T extends CandidateManagementPlanLike>(plans: T[]): T[] {
  return plans.filter((plan) => plan.status === 'PUBLISHED');
}
