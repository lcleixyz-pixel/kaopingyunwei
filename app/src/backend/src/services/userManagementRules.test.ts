import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAccessUserManagement,
  canAssignUserRole,
  canManageTargetUser,
  getAssignableUserRoles,
  isRoleCompatibleWithTenant,
} from './userManagementRules.js';

describe('User management access rules', () => {
  it('keeps account management centralized at system and headquarters roles', () => {
    assert.equal(canAccessUserManagement('SYS_ADMIN'), true);
    assert.equal(canAccessUserManagement('HQ_ADMIN'), true);
    assert.equal(canAccessUserManagement('BRANCH_ADMIN'), false);
    assert.equal(canAccessUserManagement('BRANCH_STAFF'), false);
  });

  it('limits role assignment to lightweight account roles', () => {
    assert.deepEqual(getAssignableUserRoles('SYS_ADMIN'), [
      'SYS_ADMIN',
      'HQ_ADMIN',
      'HQ_STAFF',
      'BRANCH_ADMIN',
      'BRANCH_STAFF',
    ]);
    assert.deepEqual(getAssignableUserRoles('HQ_ADMIN'), [
      'HQ_STAFF',
      'BRANCH_ADMIN',
      'BRANCH_STAFF',
    ]);
    assert.deepEqual(getAssignableUserRoles('BRANCH_ADMIN'), []);
  });

  it('prevents headquarters admins from managing system administrators', () => {
    assert.equal(canAssignUserRole('HQ_ADMIN', 'SYS_ADMIN'), false);
    assert.equal(canManageTargetUser({
      actorRole: 'HQ_ADMIN',
      targetRole: 'SYS_ADMIN',
      targetUserId: 'sys',
      actorUserId: 'hq',
      nextStatus: 'INACTIVE',
    }), false);
  });

  it('prevents administrators from disabling or locking their current account', () => {
    assert.equal(canManageTargetUser({
      actorRole: 'SYS_ADMIN',
      targetRole: 'SYS_ADMIN',
      targetUserId: 'same-user',
      actorUserId: 'same-user',
      nextStatus: 'ACTIVE',
    }), true);
    assert.equal(canManageTargetUser({
      actorRole: 'SYS_ADMIN',
      targetRole: 'SYS_ADMIN',
      targetUserId: 'same-user',
      actorUserId: 'same-user',
      nextStatus: 'INACTIVE',
    }), false);
    assert.equal(canManageTargetUser({
      actorRole: 'SYS_ADMIN',
      targetRole: 'SYS_ADMIN',
      targetUserId: 'same-user',
      actorUserId: 'same-user',
      nextStatus: 'LOCKED',
    }), false);
  });

  it('matches account roles to headquarters or branch tenants', () => {
    assert.equal(isRoleCompatibleWithTenant('SYS_ADMIN', 'HQ'), true);
    assert.equal(isRoleCompatibleWithTenant('HQ_ADMIN', 'HQ'), true);
    assert.equal(isRoleCompatibleWithTenant('HQ_STAFF', 'HQ'), true);
    assert.equal(isRoleCompatibleWithTenant('BRANCH_ADMIN', 'BRANCH'), true);
    assert.equal(isRoleCompatibleWithTenant('BRANCH_STAFF', 'BRANCH'), true);
    assert.equal(isRoleCompatibleWithTenant('BRANCH_ADMIN', 'HQ'), false);
    assert.equal(isRoleCompatibleWithTenant('HQ_STAFF', 'BRANCH'), false);
  });
});
