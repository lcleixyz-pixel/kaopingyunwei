import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canCompleteNodeFromTracking,
  getNodeTrackingPrimaryAction,
} from '../../../lib/nodeTrackingActions.js';
import type { NodeType } from '../../../shared/index.js';

describe('node tracking actions', () => {
  it('allows direct completion only for offline confirmation nodes', () => {
    const completable: NodeType[] = ['ROOM_ARRANGE', 'EXAM_PREPARE', 'EXAM_DAY', 'SCORE_PUBLISH', 'COMPLETE'];
    const businessEntryNodes: NodeType[] = ['PLAN_CREATE', 'REGISTRATION', 'SCORE_RECORD', 'CERT_MANAGE'];

    for (const nodeType of completable) {
      assert.equal(canCompleteNodeFromTracking(nodeType), true, nodeType);
    }
    for (const nodeType of businessEntryNodes) {
      assert.equal(canCompleteNodeFromTracking(nodeType), false, nodeType);
    }
  });

  it('routes business nodes to their owning modules instead of completing them in tracking', () => {
    assert.deepEqual(getNodeTrackingPrimaryAction('PLAN_CREATE'), {
      type: 'navigate',
      label: '进入计划管理',
      href: '/plans',
    });
    assert.deepEqual(getNodeTrackingPrimaryAction('REGISTRATION'), {
      type: 'navigate',
      label: '进入报名资料',
      href: '/candidates',
    });
    assert.deepEqual(getNodeTrackingPrimaryAction('SCORE_RECORD'), {
      type: 'navigate',
      label: '进入成绩检录',
      href: '/scores',
    });
    assert.deepEqual(getNodeTrackingPrimaryAction('CERT_MANAGE'), {
      type: 'navigate',
      label: '进入证书管理',
      href: '/certificates',
    });
  });

  it('uses completion as the primary action for offline confirmation nodes', () => {
    assert.deepEqual(getNodeTrackingPrimaryAction('EXAM_DAY'), {
      type: 'complete',
      label: '标记完成',
    });
  });
});
