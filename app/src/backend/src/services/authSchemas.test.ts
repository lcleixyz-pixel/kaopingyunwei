import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setupSchema } from './authSchemas.js';

describe('auth request schemas', () => {
  it('requires a strong enough password for first-time setup', () => {
    const result = setupSchema.safeParse({
      username: 'admin',
      password: 'short',
      realName: '系统管理员',
      tenantName: '总部',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.message, /初始化密码至少 12 位/);
    }
  });

  it('trims setup text fields and rejects empty usernames', () => {
    const result = setupSchema.safeParse({
      username: '   ',
      password: 'Setup#2026-Strong',
      realName: '  系统管理员  ',
      tenantName: '  总部  ',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.message, /用户名不能为空/);
    }
  });

  it('accepts valid setup input with normalized text', () => {
    const result = setupSchema.parse({
      username: ' admin ',
      password: 'Setup#2026-Strong',
      realName: '  系统管理员  ',
      tenantName: '  总部  ',
    });

    assert.equal(result.username, 'admin');
    assert.equal(result.realName, '系统管理员');
    assert.equal(result.tenantName, '总部');
  });
});
