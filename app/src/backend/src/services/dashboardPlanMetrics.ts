type DashboardPlanStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'CANCELLED';

export interface DashboardPlanMetricInput {
  id: string;
  status: DashboardPlanStatus;
  examDate: Date;
  isComplete?: boolean;
}

export interface DashboardPlanMetrics {
  draftPlans: number;
  publishedPlans: number;
  preExamPlans: number;
  postExamPlans: number;
  riskPlans: number;
}

export function calculateDashboardPlanMetrics(
  plans: DashboardPlanMetricInput[],
  riskPlanIds: string[],
  now = new Date()
): DashboardPlanMetrics {
  const todayStart = startOfDay(now).getTime();
  const riskPlanIdSet = new Set(riskPlanIds);

  return {
    draftPlans: plans.filter((plan) => plan.status === 'DRAFT').length,
    publishedPlans: plans.filter((plan) => plan.status === 'PUBLISHED').length,
    preExamPlans: plans.filter((plan) => (
      plan.status === 'PUBLISHED' && new Date(plan.examDate).getTime() >= todayStart
    )).length,
    postExamPlans: plans.filter((plan) => (
      plan.status === 'PUBLISHED'
      && new Date(plan.examDate).getTime() < todayStart
      && !plan.isComplete
    )).length,
    riskPlans: riskPlanIdSet.size,
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
