import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveBranchWorkbenchTasks } from '../../../lib/workbenchRules.js';

describe('branch workbench priority tasks', () => {
  it('does not create multiple priority cards for a plan that is only in registration', () => {
    const tasks = deriveBranchWorkbenchTasks({
      now: new Date('2026-05-12T00:00:00.000Z'),
      stats: {
        totalPlans: 1,
        activePlans: 1,
        completedPlans: 0,
        overdueNodes: 0,
        pendingNodes: 1,
        totalCandidates: 0,
        totalBranches: 1,
        recentActivities: [],
      },
      plans: [{
        id: 'plan-1',
        title: '202605新疆玉石检验员三级',
        status: 'PUBLISHED',
        examDate: '2026-06-20T00:00:00.000Z',
        registrationDeadline: '2026-06-11T00:00:00.000Z',
        registrationClosed: false,
      }],
      nodes: [
        {
          id: 'registration-node',
          planId: 'plan-1',
          nodeType: 'REGISTRATION',
          status: 'IN_PROGRESS',
          deadline: '2026-06-11T00:00:00.000Z',
          isOverdue: false,
        },
        {
          id: 'score-node',
          planId: 'plan-1',
          nodeType: 'SCORE_RECORD',
          status: 'PENDING',
          deadline: '2026-06-24T00:00:00.000Z',
          isOverdue: false,
        },
      ],
    });

    assert.deepEqual(tasks.map((task) => task.id), ['registration-open']);
  });

  it('shows score recording only after the score node becomes current', () => {
    const tasks = deriveBranchWorkbenchTasks({
      now: new Date('2026-06-21T00:00:00.000Z'),
      plans: [{
        id: 'plan-1',
        title: '202605新疆玉石检验员三级',
        status: 'PUBLISHED',
        examDate: '2026-06-20T00:00:00.000Z',
        registrationDeadline: '2026-06-11T00:00:00.000Z',
        registrationClosed: true,
      }],
      nodes: [{
        id: 'score-node',
        planId: 'plan-1',
        nodeType: 'SCORE_RECORD',
        status: 'IN_PROGRESS',
        deadline: '2026-06-24T00:00:00.000Z',
        isOverdue: false,
      }],
    });

    assert.equal(tasks[0]?.id, 'score-recording');
  });
});
