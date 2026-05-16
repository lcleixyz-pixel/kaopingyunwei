export interface LoginRateLimitIdentity {
  username: string;
  tenantCode?: string;
  ip?: string;
}

export interface LoginRateLimitOptions {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
  now?: () => number;
}

interface LoginFailureEntry {
  count: number;
  windowStartedAt: number;
  lockedUntil?: number;
}

export interface LoginRateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

export function createLoginRateLimiter(options: LoginRateLimitOptions) {
  const attempts = new Map<string, LoginFailureEntry>();
  const now = options.now || Date.now;

  function check(identity: LoginRateLimitIdentity): LoginRateLimitResult {
    const key = identityKey(identity);
    const entry = attempts.get(key);
    if (!entry) return { limited: false };

    const currentTime = now();
    if (entry.lockedUntil && entry.lockedUntil > currentTime) {
      return {
        limited: true,
        retryAfterSeconds: Math.ceil((entry.lockedUntil - currentTime) / 1000),
      };
    }

    if (entry.lockedUntil && entry.lockedUntil <= currentTime) {
      attempts.delete(key);
    }

    return { limited: false };
  }

  function recordFailure(identity: LoginRateLimitIdentity): void {
    const key = identityKey(identity);
    const currentTime = now();
    const previous = attempts.get(key);

    if (!previous || currentTime - previous.windowStartedAt > options.windowMs) {
      attempts.set(key, { count: 1, windowStartedAt: currentTime });
      return;
    }

    const count = previous.count + 1;
    attempts.set(key, {
      count,
      windowStartedAt: previous.windowStartedAt,
      lockedUntil: count >= options.maxFailures ? currentTime + options.lockMs : previous.lockedUntil,
    });
  }

  function recordSuccess(identity: LoginRateLimitIdentity): void {
    attempts.delete(identityKey(identity));
  }

  function reset(): void {
    attempts.clear();
  }

  return {
    check,
    recordFailure,
    recordSuccess,
    reset,
  };
}

export const loginRateLimiter = createLoginRateLimiter({
  maxFailures: 5,
  windowMs: 5 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
});

function identityKey(identity: LoginRateLimitIdentity): string {
  return [
    normalizeKeyPart(identity.tenantCode || 'no-tenant'),
    normalizeKeyPart(identity.username),
    normalizeKeyPart(identity.ip || 'unknown-ip'),
  ].join(':');
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase() || 'empty';
}
