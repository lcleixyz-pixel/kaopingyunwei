import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getCandidateManagementPlanOptions,
  shouldLoadCandidatesForPlan,
} from '../../../lib/candidateManagementRules.js';

describe('candidate management page rules', () => {
  it('does not load candidates before a plan is selected', () => {
    assert.equal(shouldLoadCandidatesForPlan(''), false);
    assert.equal(shouldLoadCandidatesForPlan('   '), false);
    assert.equal(shouldLoadCandidatesForPlan('plan-1'), true);
  });

  it('shows only published plans as candidate management options', () => {
    const options = getCandidateManagementPlanOptions([
      { id: 'published', title: '已发布计划', status: 'PUBLISHED' },
      { id: 'draft', title: '草稿计划', status: 'DRAFT' },
      { id: 'cancelled', title: '已取消计划', status: 'CANCELLED' },
    ]);

    assert.deepEqual(options.map((plan) => plan.id), ['published']);
  });
});
