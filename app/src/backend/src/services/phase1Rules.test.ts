import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAddCandidateToPlan,
  canCompleteNode,
  canRollbackPlan,
  getCancelPlanBlockReason,
  getWorkTypesForOccupation,
  getInitialPlanStatus,
  getPublishNodeStatuses,
  isRegistrationClosed,
  isCorePlanField,
  isHeadquartersReadOnlyRole,
  LEVEL_OPTIONS,
  OCCUPATION_OPTIONS,
} from './phase1Rules.js';
import {
  addWorkDaysWithCalendar,
  isWorkdayWithCalendar,
  type WorkdayCalendarConfig,
} from '../utils/dateUtils.js';

describe('Phase 1 plan and permission rules', () => {
  it('creates plans as drafts for every operator role', () => {
    assert.equal(getInitialPlanStatus('BRANCH_ADMIN'), 'DRAFT');
    assert.equal(getInitialPlanStatus('SYS_ADMIN'), 'DRAFT');
  });

  it('keeps headquarters roles read only for node completion', () => {
    assert.equal(isHeadquartersReadOnlyRole('HQ_ADMIN'), true);
    assert.equal(isHeadquartersReadOnlyRole('HQ_STAFF'), true);
    assert.equal(canCompleteNode('HQ_ADMIN'), false);
    assert.equal(canCompleteNode('BRANCH_ADMIN'), true);
    assert.equal(canCompleteNode('BRANCH_STAFF'), true);
  });

  it('activates only the first pending node when a draft plan is published', () => {
    const statuses = getPublishNodeStatuses([
      { id: 'node-1', nodeType: 'PLAN_CREATE', status: 'PENDING' },
      { id: 'node-2', nodeType: 'REGISTRATION', status: 'PENDING' },
      { id: 'node-3', nodeType: 'ROOM_ARRANGE', status: 'PENDING' },
    ]);

    assert.deepEqual(statuses, [
      { id: 'node-1', status: 'COMPLETED', shouldStampCompletedAt: true, notes: '计划发布时自动登记制定计划节点完成' },
      { id: 'node-2', status: 'IN_PROGRESS' },
      { id: 'node-3', status: 'PENDING' },
    ]);
  });

  it('locks the reshaped core plan fields after publishing', () => {
    for (const field of ['title', 'occupation', 'profession', 'level', 'examDate', 'registrationDeadline', 'location', 'maxCandidates']) {
      assert.equal(isCorePlanField(field), true, `${field} should be locked after publishing`);
    }

    assert.equal(isCorePlanField('examType'), false);
    assert.equal(isCorePlanField('notes'), false);
  });

  it('exposes the current fixed occupation to work-type mapping', () => {
    assert.deepEqual(LEVEL_OPTIONS, ['一级/高级技师', '二级/技师', '三级/高级工', '四级/中级工', '五级/初级工']);
    assert.deepEqual(OCCUPATION_OPTIONS, [
      {
        occupation: '贵金属首饰与宝玉石检测员',
        workTypes: [
          '贵金属首饰与宝玉石检测员',
          '贵金属首饰检验员',
          '钻石检验员',
          '宝石检验员',
          '玉石检验员',
          '有机宝石检验员',
        ],
      },
      {
        occupation: '首饰设计师',
        workTypes: ['首饰设计师'],
      },
    ]);
    assert.deepEqual(getWorkTypesForOccupation('首饰设计师'), ['首饰设计师']);
    assert.deepEqual(getWorkTypesForOccupation('不存在的职业'), []);
  });

  it('restricts precious metal and gemstone work types by level', () => {
    assert.deepEqual(
      getWorkTypesForOccupation('贵金属首饰与宝玉石检测员', '五级/初级工'),
      ['贵金属首饰与宝玉石检测员'],
    );
    assert.deepEqual(
      getWorkTypesForOccupation('贵金属首饰与宝玉石检测员', '三级/高级工'),
      ['贵金属首饰检验员', '钻石检验员', '宝石检验员', '玉石检验员', '有机宝石检验员'],
    );
  });

  it('allows candidates only after a plan is published', () => {
    assert.equal(canAddCandidateToPlan('DRAFT'), false);
    assert.equal(canAddCandidateToPlan('PUBLISHED'), true);
    assert.equal(canAddCandidateToPlan('PUBLISHED', true), false);
    assert.equal(canAddCandidateToPlan('CANCELLED'), false);
  });

  it('treats completed registration node as closed candidate intake', () => {
    assert.equal(isRegistrationClosed([{ nodeType: 'REGISTRATION', status: 'COMPLETED' }]), true);
    assert.equal(isRegistrationClosed([{ nodeType: 'REGISTRATION', status: 'IN_PROGRESS' }]), false);
    assert.equal(isRegistrationClosed([{ nodeType: 'PLAN_CREATE', status: 'COMPLETED' }]), false);
  });

  it('requires draft status, no candidates and a remark before cancellation', () => {
    assert.equal(getCancelPlanBlockReason({ status: 'DRAFT', candidateCount: 0, reason: '调整安排' }), null);
    assert.equal(getCancelPlanBlockReason({ status: 'PUBLISHED', candidateCount: 0, reason: '调整安排' }), 'PUBLISHED_PLAN_MUST_ROLLBACK_FIRST');
    assert.equal(getCancelPlanBlockReason({ status: 'DRAFT', candidateCount: 1, reason: '调整安排' }), 'PLAN_HAS_CANDIDATES');
    assert.equal(getCancelPlanBlockReason({ status: 'DRAFT', candidateCount: 0, reason: '' }), 'CANCEL_REASON_REQUIRED');
  });

  it('allows rollback only from published status', () => {
    assert.equal(canRollbackPlan('PUBLISHED'), true);
    assert.equal(canRollbackPlan('DRAFT'), false);
    assert.equal(canRollbackPlan('CANCELLED'), false);
  });
});

describe('tenant workday calendar rules', () => {
  const calendar: WorkdayCalendarConfig = {
    holidays: ['2026-05-08'],
    workdays: ['2026-05-09'],
  };

  it('treats configured holidays as non-workdays and make-up days as workdays', () => {
    assert.equal(isWorkdayWithCalendar(new Date('2026-05-08T12:00:00Z'), calendar), false);
    assert.equal(isWorkdayWithCalendar(new Date('2026-05-09T12:00:00Z'), calendar), true);
  });

  it('uses branch calendar overrides when calculating workday offsets', () => {
    const result = addWorkDaysWithCalendar(new Date('2026-05-07T00:00:00Z'), 1, calendar);
    assert.equal(result.toISOString().slice(0, 10), '2026-05-09');
  });
});
