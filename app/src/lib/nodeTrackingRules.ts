export interface NodeTrackingNodeLike {
  nodeType: string;
  status: string;
}

export interface NodeTrackingPlanLike {
  status: string;
  examDate: string | Date;
  nodes?: NodeTrackingNodeLike[];
}

export function isPlanCompleteRecognition(plan: NodeTrackingPlanLike): boolean {
  return Boolean(plan.nodes?.some((node) => node.nodeType === 'COMPLETE' && node.status === 'COMPLETED'));
}

export function getNodeTrackingPlans<T extends NodeTrackingPlanLike>(plans: T[]): T[] {
  return plans
    .filter((plan) => plan.status === 'PUBLISHED' && !isPlanCompleteRecognition(plan))
    .slice()
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
}
