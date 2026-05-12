import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canReadGlobalSettings, canWriteGlobalSettings } from './settingsAccess.js';

describe('settings access', () => {
  it('keeps global settings away from branch staff API access', () => {
    assert.equal(canReadGlobalSettings('SYS_ADMIN'), true);
    assert.equal(canReadGlobalSettings('HQ_ADMIN'), true);
    assert.equal(canReadGlobalSettings('BRANCH_ADMIN'), true);
    assert.equal(canReadGlobalSettings('BRANCH_STAFF'), false);
    assert.equal(canReadGlobalSettings('HQ_STAFF'), false);
  });

  it('allows only system and headquarters admins to update global settings', () => {
    assert.equal(canWriteGlobalSettings('SYS_ADMIN'), true);
    assert.equal(canWriteGlobalSettings('HQ_ADMIN'), true);
    assert.equal(canWriteGlobalSettings('BRANCH_ADMIN'), false);
  });
});
