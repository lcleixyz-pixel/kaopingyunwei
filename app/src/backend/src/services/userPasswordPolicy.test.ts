import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateManagedUserPassword } from './userPasswordPolicy.js';

describe('managed user password policy', () => {
  it('accepts strong temporary passwords for managed accounts', () => {
    const result = validateManagedUserPassword({
      username: 'branchuser',
      password: 'River#2026-Copper-82',
    });

    assert.equal(result.valid, true);
  });

  it('rejects short temporary passwords', () => {
    const result = validateManagedUserPassword({
      username: 'branchuser',
      password: 'Short#1',
    });

    assert.equal(result.valid, false);
    assert.equal(result.message, '临时密码至少需要 12 位');
  });

  it('rejects passwords without mixed character types', () => {
    const result = validateManagedUserPassword({
      username: 'branchuser',
      password: 'onlylowercasepassword',
    });

    assert.equal(result.valid, false);
    assert.equal(result.message, '临时密码必须同时包含大写字母、小写字母、数字和特殊字符');
  });

  it('rejects passwords that contain the username', () => {
    const result = validateManagedUserPassword({
      username: 'branchuser',
      password: 'Safe#2026-branchuser',
    });

    assert.equal(result.valid, false);
    assert.equal(result.message, '临时密码不能包含用户名');
  });
});
