import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request } from 'express';
import {
  isRequestedPlanStatusVisibleForRead,
  nestedPlanTenantWhereForRead,
  nestedPublishedPlanWhereForRead,
  planTenantWhereForRead,
  publishedPlanWhereForRead,
} from './accessScope.js';

describe('plan access scopes', () => {
  const hqRequest = { userRole: 'HQ_ADMIN', tenantId: 'hq-tenant' } as Request;
  const branchRequest = { userRole: 'BRANCH_ADMIN', tenantId: 'branch-tenant' } as Request;

  it('hides branch drafts from cross-tenant headquarters reads', () => {
    assert.deepEqual(planTenantWhereForRead(hqRequest), { status: 'PUBLISHED' });
    assert.deepEqual(nestedPlanTenantWhereForRead(hqRequest), { plan: { status: 'PUBLISHED' } });
    assert.equal(isRequestedPlanStatusVisibleForRead(hqRequest, 'DRAFT'), false);
    assert.equal(isRequestedPlanStatusVisibleForRead(hqRequest, 'PUBLISHED'), true);
  });

  it('keeps branch drafts visible inside the owning branch plan workspace', () => {
    assert.deepEqual(planTenantWhereForRead(branchRequest), { tenantId: 'branch-tenant' });
    assert.deepEqual(nestedPlanTenantWhereForRead(branchRequest), { plan: { tenantId: 'branch-tenant' } });
    assert.equal(isRequestedPlanStatusVisibleForRead(branchRequest, 'DRAFT'), true);
  });

  it('limits workflow modules to published plans for both headquarters and branches', () => {
    assert.deepEqual(publishedPlanWhereForRead(hqRequest), { status: 'PUBLISHED' });
    assert.deepEqual(publishedPlanWhereForRead(branchRequest), { tenantId: 'branch-tenant', status: 'PUBLISHED' });
    assert.deepEqual(nestedPublishedPlanWhereForRead(branchRequest), {
      plan: { tenantId: 'branch-tenant', status: 'PUBLISHED' },
    });
  });
});
