import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getRequiredSubjectSummary, normalizeScorePlanDetail } from '../src/lib/scorePageRules.ts';

const plan = {
  id: 'plan-1',
  tenantId: 'tenant-1',
  title: '2026年贵金属考评',
  occupation: '贵金属首饰与宝玉石检测员',
  profession: '贵金属首饰检测员',
  level: '三级/高级工',
  examDate: '2026-05-12',
  registrationDeadline: '2026-05-01',
  status: 'PUBLISHED',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

function candidate(overrides = {}) {
  return {
    id: 'candidate-1',
    tenantId: 'tenant-1',
    planId: 'plan-1',
    name: '张三',
    idCard: '650100199001011234',
    gender: 'M',
    applyLevel: '三级/高级工',
    status: 'APPROVED',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('score page response normalization', () => {
  it('fills missing candidate requiredSubjects from the candidate level', () => {
    const detail = normalizeScorePlanDetail({
      plan,
      candidates: [
        {
          candidate: candidate(),
          score: null,
          isComplete: false,
          resultStatus: 'INCOMPLETE',
        },
      ],
      summary: { total: 1 },
    });

    assert.deepEqual(detail.candidates[0].requiredSubjects, ['theory', 'practice']);
    assert.equal(getRequiredSubjectSummary(detail.candidates), '理论、技能/实操');
    assert.equal(detail.summary.incomplete, 1);
    assert.equal(detail.summary.canComplete, false);
  });

  it('keeps rendering-safe defaults when the scores response is partial', () => {
    const detail = normalizeScorePlanDetail({
      plan,
      candidates: null,
      summary: null,
    });

    assert.deepEqual(detail.candidates, []);
    assert.equal(getRequiredSubjectSummary(detail.candidates), '-');
    assert.equal(detail.summary.total, 0);
  });
});
