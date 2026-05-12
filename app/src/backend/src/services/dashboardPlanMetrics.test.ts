import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateDashboardPlanMetrics } from './dashboardPlanMetrics.js';

describe('dashboard plan metrics', () => {
  it('summarizes plans by business stage instead of multiplying draft nodes', () => {
    const today = new Date('2026-05-12T10:00:00');
    const metrics = calculateDashboardPlanMetrics([
      { id: 'draft-1', status: 'DRAFT', examDate: new Date('2026-05-30T00:00:00') },
      { id: 'pre-1', status: 'PUBLISHED', examDate: new Date('2026-05-20T00:00:00') },
      { id: 'post-1', status: 'PUBLISHED', examDate: new Date('2026-05-01T00:00:00') },
      { id: 'done-1', status: 'PUBLISHED', examDate: new Date('2026-04-20T00:00:00'), isComplete: true },
      { id: 'cancelled-1', status: 'CANCELLED', examDate: new Date('2026-05-25T00:00:00') },
    ], ['post-1', 'post-1'], today);

    assert.deepEqual(metrics, {
      draftPlans: 1,
      publishedPlans: 3,
      preExamPlans: 1,
      postExamPlans: 1,
      riskPlans: 1,
    });
  });
});
