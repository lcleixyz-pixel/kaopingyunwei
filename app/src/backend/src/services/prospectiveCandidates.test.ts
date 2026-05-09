import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAccessProspectiveCandidates,
  canConvertProspectiveCandidate,
  canDeleteProspectiveCandidate,
  canConvertToFormalCandidate,
  getRejectedCandidateDisposition,
  shouldRevertProspectiveOnPlanRollback,
} from './prospectiveCandidates.js';

describe('Prospective candidate permissions', () => {
  it('keeps prospective candidates branch-internal only', () => {
    assert.equal(canAccessProspectiveCandidates('BRANCH_ADMIN'), true);
    assert.equal(canAccessProspectiveCandidates('BRANCH_STAFF'), true);
    assert.equal(canAccessProspectiveCandidates('HQ_ADMIN'), false);
    assert.equal(canAccessProspectiveCandidates('HQ_STAFF'), false);
    assert.equal(canAccessProspectiveCandidates('SYS_ADMIN'), false);
  });

  it('allows deletion only for branch administrators', () => {
    assert.equal(canDeleteProspectiveCandidate('BRANCH_ADMIN'), true);
    assert.equal(canDeleteProspectiveCandidate('BRANCH_STAFF'), false);
  });

  it('allows conversion for branch operators', () => {
    assert.equal(canConvertProspectiveCandidate('BRANCH_ADMIN'), true);
    assert.equal(canConvertProspectiveCandidate('BRANCH_STAFF'), true);
    assert.equal(canConvertProspectiveCandidate('HQ_ADMIN'), false);
  });
});

describe('Prospective candidate conversion rules', () => {
  it('converts only to published plans in the same tenant', () => {
    assert.equal(canConvertToFormalCandidate({
      prospectiveTenantId: 'tenant-a',
      planTenantId: 'tenant-a',
      planStatus: 'PUBLISHED',
    }), true);

    assert.equal(canConvertToFormalCandidate({
      prospectiveTenantId: 'tenant-a',
      planTenantId: 'tenant-a',
      planStatus: 'DRAFT',
    }), false);

    assert.equal(canConvertToFormalCandidate({
      prospectiveTenantId: 'tenant-a',
      planTenantId: 'tenant-b',
      planStatus: 'PUBLISHED',
    }), false);
  });

  it('does not convert after the registration node is completed', () => {
    assert.equal(canConvertToFormalCandidate({
      prospectiveTenantId: 'tenant-a',
      planTenantId: 'tenant-a',
      planStatus: 'PUBLISHED',
      registrationClosed: true,
    }), false);
  });
});

describe('Prospective candidate plan rollback rules', () => {
  it('reverts only converted prospects linked to the rolled back plan', () => {
    assert.equal(shouldRevertProspectiveOnPlanRollback({
      prospectiveStatus: 'CONVERTED',
      convertedCandidatePlanId: 'plan-a',
      rolledBackPlanId: 'plan-a',
    }), true);

    assert.equal(shouldRevertProspectiveOnPlanRollback({
      prospectiveStatus: 'FOLLOWING',
      convertedCandidatePlanId: 'plan-a',
      rolledBackPlanId: 'plan-a',
    }), false);

    assert.equal(shouldRevertProspectiveOnPlanRollback({
      prospectiveStatus: 'CONVERTED',
      convertedCandidatePlanId: 'plan-b',
      rolledBackPlanId: 'plan-a',
    }), false);
  });
});

describe('Rejected formal candidate disposition', () => {
  it('moves rejected formal candidates back to prospective follow-up instead of keeping them visible as formal candidates', () => {
    assert.equal(getRejectedCandidateDisposition({ hasProspectiveSource: true }), 'RESTORE_EXISTING_PROSPECT');
    assert.equal(getRejectedCandidateDisposition({ hasProspectiveSource: false }), 'CREATE_OR_UPDATE_PROSPECT');
  });
});
