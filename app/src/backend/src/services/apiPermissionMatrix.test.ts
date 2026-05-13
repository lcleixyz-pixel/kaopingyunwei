import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccessApiArea } from './apiPermissionMatrix.js';

describe('API permission matrix', () => {
  const roles = ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'] as const;

  it('keeps settings limited to admin roles and denies branch staff', () => {
    assert.deepEqual(
      roles.map((role) => [role, canAccessApiArea(role, 'settings')]),
      [
        ['SYS_ADMIN', true],
        ['HQ_ADMIN', true],
        ['BRANCH_ADMIN', true],
        ['BRANCH_STAFF', false],
      ]
    );
  });

  it('keeps prospective candidates branch-only', () => {
    assert.deepEqual(
      roles.map((role) => [role, canAccessApiArea(role, 'prospectiveCandidates')]),
      [
        ['SYS_ADMIN', false],
        ['HQ_ADMIN', false],
        ['BRANCH_ADMIN', true],
        ['BRANCH_STAFF', true],
      ]
    );
  });

  it('keeps core business areas aligned with role expectations', () => {
    assert.deepEqual(
      roles.map((role) => [role, canAccessApiArea(role, 'examPlans')]),
      [
        ['SYS_ADMIN', true],
        ['HQ_ADMIN', true],
        ['BRANCH_ADMIN', true],
        ['BRANCH_STAFF', false],
      ]
    );
    assert.deepEqual(
      roles.map((role) => [role, canAccessApiArea(role, 'candidates')]),
      [
        ['SYS_ADMIN', true],
        ['HQ_ADMIN', true],
        ['BRANCH_ADMIN', true],
        ['BRANCH_STAFF', true],
      ]
    );
    assert.deepEqual(
      roles.map((role) => [role, canAccessApiArea(role, 'scores')]),
      [
        ['SYS_ADMIN', true],
        ['HQ_ADMIN', true],
        ['BRANCH_ADMIN', true],
        ['BRANCH_STAFF', true],
      ]
    );
    assert.deepEqual(
      roles.map((role) => [role, canAccessApiArea(role, 'certificates')]),
      [
        ['SYS_ADMIN', true],
        ['HQ_ADMIN', true],
        ['BRANCH_ADMIN', true],
        ['BRANCH_STAFF', true],
      ]
    );
    assert.deepEqual(
      roles.map((role) => [role, canAccessApiArea(role, 'pdfTemplates')]),
      [
        ['SYS_ADMIN', true],
        ['HQ_ADMIN', true],
        ['BRANCH_ADMIN', true],
        ['BRANCH_STAFF', true],
      ]
    );
  });
});
