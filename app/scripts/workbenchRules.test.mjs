import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveBranchWorkbenchTasks,
  isBranchRole,
  summarizeCandidateRegistration,
  summarizeProspects,
} from '../src/lib/workbenchRules.ts';

const now = new Date('2026-05-11T09:00:00+08:00');

test('branch workbench prioritizes overdue nodes and score recording', () => {
  const tasks = deriveBranchWorkbenchTasks({
    stats: {
      totalPlans: 3,
      activePlans: 2,
      completedPlans: 1,
      overdueNodes: 1,
      pendingNodes: 2,
      totalCandidates: 12,
      totalBranches: 1,
      recentActivities: [],
    },
    plans: [
      {
        id: 'plan-registration',
        status: 'PUBLISHED',
        title: '五月高级工认定',
        examDate: '2026-05-20T00:00:00.000Z',
        registrationDeadline: '2026-05-13T00:00:00.000Z',
        registrationClosed: false,
      },
    ],
    nodes: [
      {
        id: 'node-overdue',
        planId: 'plan-registration',
        nodeType: 'REGISTRATION',
        status: 'IN_PROGRESS',
        deadline: '2026-05-09T00:00:00.000Z',
      },
      {
        id: 'node-score',
        planId: 'plan-registration',
        nodeType: 'SCORE_RECORD',
        status: 'IN_PROGRESS',
        deadline: '2026-05-12T00:00:00.000Z',
      },
    ],
    now,
  });

  assert.equal(tasks[0].id, 'overdue-nodes');
  assert.equal(tasks[0].href, '/nodes');
  assert.ok(tasks.some((task) => task.id === 'score-recording'));
  assert.ok(tasks.some((task) => task.id === 'registration-closing-soon'));
});

test('candidate registration summary exposes the next review/export work', () => {
  const summary = summarizeCandidateRegistration([
    {
      id: 'candidate-1',
      status: 'PENDING',
      registrationProfile: {
        paymentStatus: 'UNPAID',
        completeness: {
          isEligible: false,
          templateComplete: false,
          materialComplete: true,
          approvalComplete: false,
          missingFields: ['手机号码'],
          missingMaterials: [],
          invalidFields: [],
        },
      },
    },
    {
      id: 'candidate-2',
      status: 'APPROVED',
      registrationProfile: {
        paymentStatus: 'PAID',
        completeness: {
          isEligible: true,
          templateComplete: true,
          materialComplete: true,
          approvalComplete: true,
          missingFields: [],
          missingMaterials: [],
          invalidFields: [],
        },
      },
    },
  ]);

  assert.deepEqual(
    {
      total: summary.total,
      templateIncomplete: summary.templateIncomplete,
      materialIncomplete: summary.materialIncomplete,
      pendingReview: summary.pendingReview,
      unpaid: summary.unpaid,
      exportEligible: summary.exportEligible,
    },
    {
      total: 2,
      templateIncomplete: 1,
      materialIncomplete: 0,
      pendingReview: 1,
      unpaid: 1,
      exportEligible: 1,
    },
  );
});

test('prospect summary highlights active following candidates and duplicate phones', () => {
  const summary = summarizeProspects([
    { id: 'p1', phone: '13800000000', status: 'FOLLOWING' },
    { id: 'p2', phone: '13800000000', status: 'FOLLOWING' },
    { id: 'p3', phone: '13900000000', status: 'CONVERTED' },
  ]);

  assert.equal(isBranchRole('BRANCH_STAFF'), true);
  assert.equal(isBranchRole('HQ_ADMIN'), false);
  assert.equal(summary.following, 2);
  assert.deepEqual(summary.duplicatePhones, ['13800000000']);
});
