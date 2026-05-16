import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLoginRateLimiter } from './loginRateLimit.js';

describe('login rate limiting', () => {
  it('locks an account and IP combination after repeated failures', () => {
    let now = 1_000;
    const limiter = createLoginRateLimiter({
      maxFailures: 5,
      windowMs: 5 * 60 * 1000,
      lockMs: 15 * 60 * 1000,
      now: () => now,
    });
    const identity = { username: 'Admin', tenantCode: 'HQ', ip: '10.0.0.1' };

    for (let i = 0; i < 4; i++) {
      assert.equal(limiter.check(identity).limited, false);
      limiter.recordFailure(identity);
    }

    limiter.recordFailure(identity);
    const locked = limiter.check(identity);
    assert.equal(locked.limited, true);
    assert.equal(locked.retryAfterSeconds, 900);

    now += 15 * 60 * 1000 + 1;
    assert.equal(limiter.check(identity).limited, false);
  });

  it('clears failures after a successful login', () => {
    const limiter = createLoginRateLimiter({
      maxFailures: 3,
      windowMs: 5 * 60 * 1000,
      lockMs: 15 * 60 * 1000,
      now: () => 1_000,
    });
    const identity = { username: 'bjadmin', tenantCode: 'BJ', ip: '10.0.0.2' };

    limiter.recordFailure(identity);
    limiter.recordFailure(identity);
    limiter.recordSuccess(identity);
    limiter.recordFailure(identity);

    assert.equal(limiter.check(identity).limited, false);
  });

  it('starts a new failure window after the old window expires', () => {
    let now = 1_000;
    const limiter = createLoginRateLimiter({
      maxFailures: 2,
      windowMs: 60_000,
      lockMs: 15 * 60 * 1000,
      now: () => now,
    });
    const identity = { username: 'bjstaff', tenantCode: 'BJ', ip: '10.0.0.3' };

    limiter.recordFailure(identity);
    now += 60_001;
    limiter.recordFailure(identity);

    assert.equal(limiter.check(identity).limited, false);
  });
});
