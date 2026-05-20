import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { createWriteRateLimitMiddleware, createWriteRateLimiter } from './writeRateLimit.js';

describe('write operation rate limiting', () => {
  it('limits repeated writes by tenant, user, ip and route key within the same window', () => {
    let now = 1_000;
    const limiter = createWriteRateLimiter({
      maxRequests: 2,
      windowMs: 1_000,
      now: () => now,
    });
    const identity = {
      tenantId: 'tenant-a',
      userId: 'user-a',
      ip: '10.0.0.1',
      routeKey: 'scores-import',
    };

    assert.equal(limiter.consume(identity).limited, false);
    assert.equal(limiter.consume(identity).limited, false);
    const limited = limiter.consume(identity);

    assert.equal(limited.limited, true);
    assert.equal(limited.retryAfterSeconds, 1);

    now += 1_001;
    assert.equal(limiter.consume(identity).limited, false);
  });

  it('keeps different users and route keys independent', () => {
    const limiter = createWriteRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      now: () => 1_000,
    });

    assert.equal(limiter.consume({ tenantId: 't', userId: 'u1', routeKey: 'scores-import' }).limited, false);
    assert.equal(limiter.consume({ tenantId: 't', userId: 'u2', routeKey: 'scores-import' }).limited, false);
    assert.equal(limiter.consume({ tenantId: 't', userId: 'u1', routeKey: 'certificate-import' }).limited, false);
    assert.equal(limiter.consume({ tenantId: 't', userId: 'u1', routeKey: 'scores-import' }).limited, true);
  });

  it('middleware returns a friendly Chinese 429 response when the bucket is exhausted', () => {
    const limiter = createWriteRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      now: () => 1_000,
    });
    const middleware = createWriteRateLimitMiddleware({
      limiter,
      routeKey: 'candidate-photo-upload',
      message: '操作太频繁，请稍后再试',
    });
    const req = {
      userId: 'user-a',
      tenantId: 'tenant-a',
      ip: '10.0.0.1',
      headers: {},
    } as Request;
    const first = createMockResponse();
    let nextCalls = 0;

    middleware(req, first.res, () => {
      nextCalls += 1;
    });
    const second = createMockResponse();
    middleware(req, second.res, () => {
      nextCalls += 1;
    });

    assert.equal(nextCalls, 1);
    assert.equal(second.statusCode, 429);
    assert.equal(second.headers['Retry-After'], '60');
    assert.equal(second.payload?.error?.code, 'WRITE_RATE_LIMITED');
    assert.equal(second.payload?.error?.message, '操作太频繁，请稍后再试');
  });
});

function createMockResponse() {
  const state: {
    statusCode?: number;
    payload?: {
      error?: {
        code: string;
        message: string;
      };
    };
    headers: Record<string, string>;
  } = { headers: {} };
  const res = {
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return res;
    },
    status(statusCode: number) {
      state.statusCode = statusCode;
      return res;
    },
    json(payload: typeof state.payload) {
      state.payload = payload;
      return res;
    },
  } as unknown as Response;
  return {
    res,
    get statusCode() {
      return state.statusCode;
    },
    get payload() {
      return state.payload;
    },
    headers: state.headers,
  };
}
