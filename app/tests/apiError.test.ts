import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiClientError, normalizeApiError } from '../src/lib/apiError.js';

describe('frontend API error normalization', () => {
  it('keeps Chinese backend messages and request id for rate limiting', () => {
    const result = normalizeApiError({
      response: {
        status: 429,
        data: {
          success: false,
          error: { code: 'LOGIN_RATE_LIMITED', message: '登录失败次数过多，请稍后再试' },
          meta: { requestId: 'req-1' },
        },
      },
    });

    assert.ok(result instanceof ApiClientError);
    assert.equal(result.code, 'LOGIN_RATE_LIMITED');
    assert.equal(result.status, 429);
    assert.equal(result.requestId, 'req-1');
    assert.equal(result.message, '登录失败次数过多，请稍后再试');
  });

  it('turns timeouts into a friendly Chinese message', () => {
    const result = normalizeApiError({ code: 'ECONNABORTED' });

    assert.equal(result.code, 'REQUEST_TIMEOUT');
    assert.equal(result.message, '请求超时，请稍后重试');
  });

  it('does not expose English server internals to users', () => {
    const result = normalizeApiError({
      response: {
        status: 500,
        data: {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'SQLITE_BUSY: database is locked' },
          meta: { requestId: 'req-2' },
        },
      },
    });

    assert.equal(result.code, 'INTERNAL_ERROR');
    assert.equal(result.status, 500);
    assert.equal(result.requestId, 'req-2');
    assert.equal(result.message, '服务器暂时无法完成操作，请稍后再试');
  });

  it('uses status-specific Chinese fallbacks when the backend has no message', () => {
    assert.equal(normalizeApiError({ response: { status: 403, data: {} } }).message, '没有权限执行此操作');
    assert.equal(normalizeApiError({ response: { status: 413, data: {} } }).message, '文件过大，请压缩后再上传');
  });
});
