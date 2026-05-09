import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getNodeTrackingPlans, isPlanCompleteRecognition } from '../../../lib/nodeTrackingRules.js';

describe('node tracking plan rules', () => {
  it('shows published plans that have not reached complete recognition, ordered by exam date', () => {
    const plans = getNodeTrackingPlans([
      {
        id: 'draft',
        status: 'DRAFT',
        examDate: '2026-06-01T00:00:00.000Z',
        nodes: [],
      },
      {
        id: 'later',
        status: 'PUBLISHED',
        examDate: '2026-06-20T00:00:00.000Z',
        nodes: [{ nodeType: 'REGISTRATION', status: 'IN_PROGRESS' }],
      },
      {
        id: 'completed',
        status: 'PUBLISHED',
        examDate: '2026-06-05T00:00:00.000Z',
        nodes: [{ nodeType: 'COMPLETE', status: 'COMPLETED' }],
      },
      {
        id: 'nearer',
        status: 'PUBLISHED',
        examDate: '2026-06-10T00:00:00.000Z',
        nodes: [{ nodeType: 'REGISTRATION', status: 'COMPLETED' }],
      },
    ]);

    assert.deepEqual(plans.map((plan) => plan.id), ['nearer', 'later']);
  });

  it('detects completion only from the final recognition node', () => {
    assert.equal(isPlanCompleteRecognition({
      status: 'PUBLISHED',
      examDate: '2026-06-01T00:00:00.000Z',
      nodes: [{ nodeType: 'REGISTRATION', status: 'COMPLETED' }],
    }), false);

    assert.equal(isPlanCompleteRecognition({
      status: 'PUBLISHED',
      examDate: '2026-06-01T00:00:00.000Z',
      nodes: [{ nodeType: 'COMPLETE', status: 'COMPLETED' }],
    }), true);
  });
});
