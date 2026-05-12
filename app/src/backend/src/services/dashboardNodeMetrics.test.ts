import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dashboardOverdueNodeWhere, isDashboardOverdueNode } from './dashboardNodeMetrics.js';

describe('dashboard node metrics', () => {
  const now = new Date('2026-05-12T10:00:00.000Z');

  it('counts explicit overdue nodes and timed-out active nodes only', () => {
    assert.equal(isDashboardOverdueNode({ status: 'OVERDUE', deadline: new Date('2026-05-20T00:00:00.000Z') }, now), true);
    assert.equal(isDashboardOverdueNode({ status: 'PENDING', deadline: new Date('2026-05-01T00:00:00.000Z') }, now), true);
    assert.equal(isDashboardOverdueNode({ status: 'IN_PROGRESS', deadline: new Date('2026-05-01T00:00:00.000Z') }, now), true);
    assert.equal(isDashboardOverdueNode({ status: 'COMPLETED', deadline: new Date('2026-05-01T00:00:00.000Z') }, now), false);
    assert.equal(isDashboardOverdueNode({ status: 'SKIPPED', deadline: new Date('2026-05-01T00:00:00.000Z') }, now), false);
  });

  it('builds the Prisma where clause used by dashboard overdue counts', () => {
    assert.deepEqual(dashboardOverdueNodeWhere(now), {
      OR: [
        { status: 'OVERDUE' },
        {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deadline: { lt: now },
        },
      ],
    });
  });
});
