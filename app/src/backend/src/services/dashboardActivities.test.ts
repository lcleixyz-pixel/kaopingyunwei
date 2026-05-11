import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDashboardActivities, formatDashboardActivity } from './dashboardActivities.js';

describe('dashboard activity formatting', () => {
  it('renders known actions and targets in Chinese', () => {
    const activity = formatDashboardActivity({
      id: 'log-1',
      action: 'USER_PASSWORD_RESET',
      target: 'User',
      targetId: 'abcdef123456',
      createdAt: new Date('2026-05-12T08:00:00.000Z'),
      user: { realName: '总部管理员', username: 'hqadmin' },
    });

    assert.equal(activity.title, '重置账号密码');
    assert.equal(activity.description, '账号 #abcdef12');
    assert.equal(activity.userName, '总部管理员');
  });

  it('does not expose unknown internal action or target codes', () => {
    const activity = formatDashboardActivity({
      id: 'log-2',
      action: 'SOME_NEW_INTERNAL_ACTION',
      target: 'SomeInternalModel',
      targetId: '1234567890',
      createdAt: new Date('2026-05-12T08:00:00.000Z'),
      user: null,
    });

    assert.equal(activity.title, '系统操作');
    assert.equal(activity.description, '业务记录 #12345678');
  });

  it('keeps only real business progress for the dashboard feed', () => {
    const activities = formatDashboardActivities([
      {
        id: 'view-report',
        action: 'HQ_REGISTRATION_PROGRESS_REPORT_VIEW',
        target: 'Report',
        createdAt: new Date('2026-05-12T08:03:00.000Z'),
      },
      {
        id: 'reset-password',
        action: 'USER_PASSWORD_RESET',
        target: 'User',
        createdAt: new Date('2026-05-12T08:02:00.000Z'),
      },
      {
        id: 'delete-prospect',
        action: 'PROSPECTIVE_CANDIDATE_DELETE',
        target: 'ProspectiveCandidate',
        targetId: 'prospect-123456',
        createdAt: new Date('2026-05-12T08:01:30.000Z'),
      },
      {
        id: 'publish-plan',
        action: 'EXAM_PLAN_PUBLISH',
        target: 'ExamPlan',
        targetId: 'plan-123456',
        createdAt: new Date('2026-05-12T08:01:00.000Z'),
      },
      {
        id: 'approve-candidate',
        action: 'CANDIDATE_APPROVE',
        target: 'Candidate',
        targetId: 'candidate-123456',
        createdAt: new Date('2026-05-12T08:00:00.000Z'),
      },
    ]);

    assert.deepEqual(activities.map((item) => item.title), ['发布计划', '考生审核通过']);
  });
});
