import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveBranchWorkbenchTasks,
  getDisplayTenantName,
  getProspectSummarySource,
  summarizeProspects,
} from '../../../lib/workbenchRules.js';

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

describe('workbench display helpers', () => {
  it('uses the authenticated tenant from the store before falling back to the user payload', () => {
    assert.equal(getDisplayTenantName({ tenantName: '全量测试分支机构', userTenantName: undefined }), '全量测试分支机构');
    assert.equal(getDisplayTenantName({ tenantName: undefined, userTenantName: '旧机构字段' }), '旧机构字段');
    assert.equal(getDisplayTenantName({}), '总部');
  });

  it('summarizes prospects from the full candidate list when a status filter is active', () => {
    const visibleCandidates = [{ id: 'p1', phone: '13800000001', status: 'FOLLOWING' as const }];
    const allCandidates = [
      ...visibleCandidates,
      { id: 'p2', phone: '13800000002', status: 'CONVERTED' as const },
      { id: 'p3', phone: '13800000002', status: 'NOT_INTERESTED' as const },
    ];

    const summary = summarizeProspects(getProspectSummarySource({ allCandidates, visibleCandidates }));

    assert.equal(summary.total, 3);
    assert.equal(summary.converted, 1);
    assert.deepEqual(summary.duplicatePhones, ['13800000002']);
  });
});
