import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldScopeRemindersToCurrentUser } from './reminderVisibility.js';

describe('reminder visibility', () => {
  it('shows branch reminders for the current login user only', () => {
    assert.equal(shouldScopeRemindersToCurrentUser('BRANCH_ADMIN'), true);
    assert.equal(shouldScopeRemindersToCurrentUser('BRANCH_STAFF'), true);
  });

  it('keeps cross-tenant roles unscoped for supervision views', () => {
    assert.equal(shouldScopeRemindersToCurrentUser('SYS_ADMIN'), false);
    assert.equal(shouldScopeRemindersToCurrentUser('HQ_ADMIN'), false);
    assert.equal(shouldScopeRemindersToCurrentUser('HQ_STAFF'), false);
  });
});
