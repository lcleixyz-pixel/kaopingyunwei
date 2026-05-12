import type { NodeType } from '@/shared';

export type NodeTrackingAction =
  | {
      type: 'complete';
      label: string;
    }
  | {
      type: 'navigate';
      label: string;
      href: string;
    };

const COMPLETABLE_NODE_TYPES = new Set<NodeType>([
  'ROOM_ARRANGE',
  'EXAM_PREPARE',
  'EXAM_DAY',
  'SCORE_PUBLISH',
  'COMPLETE',
]);

const BUSINESS_NODE_ACTIONS: Partial<Record<NodeType, Extract<NodeTrackingAction, { type: 'navigate' }>>> = {
  PLAN_CREATE: {
    type: 'navigate',
    label: '进入计划管理',
    href: '/plans',
  },
  REGISTRATION: {
    type: 'navigate',
    label: '进入报名资料',
    href: '/candidates',
  },
  SCORE_RECORD: {
    type: 'navigate',
    label: '进入成绩检录',
    href: '/scores',
  },
  CERT_MANAGE: {
    type: 'navigate',
    label: '进入证书管理',
    href: '/certificates',
  },
};

export function canCompleteNodeFromTracking(nodeType: NodeType): boolean {
  return COMPLETABLE_NODE_TYPES.has(nodeType);
}

export function getNodeTrackingPrimaryAction(nodeType: NodeType): NodeTrackingAction {
  return BUSINESS_NODE_ACTIONS[nodeType] || {
    type: 'complete',
    label: '标记完成',
  };
}
