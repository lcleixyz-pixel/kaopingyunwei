import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request } from 'express';
import { registrationProgressPlanWhere } from './hqReports.js';

describe('headquarters reports access scopes', () => {
  it('limits registration progress to published plans for headquarters users', () => {
    const req = { userRole: 'HQ_ADMIN', tenantId: 'hq-tenant' } as Request;

    assert.deepEqual(registrationProgressPlanWhere(req), { status: 'PUBLISHED' });
  });
});
