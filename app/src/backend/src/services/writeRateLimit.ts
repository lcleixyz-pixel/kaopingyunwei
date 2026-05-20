import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { error } from '../utils/response.js';

export interface WriteRateLimitIdentity {
  tenantId?: string;
  userId?: string;
  ip?: string;
  routeKey: string;
}

export interface WriteRateLimitOptions {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}

interface WriteRateLimitBucket {
  count: number;
  windowStartedAt: number;
}

export interface WriteRateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

export interface WriteRateLimitMiddlewareOptions {
  limiter?: ReturnType<typeof createWriteRateLimiter>;
  routeKey: string;
  message?: string;
}

export function createWriteRateLimiter(options: WriteRateLimitOptions) {
  const buckets = new Map<string, WriteRateLimitBucket>();
  const now = options.now || Date.now;

  function consume(identity: WriteRateLimitIdentity): WriteRateLimitResult {
    const currentTime = now();
    const key = identityKey(identity);
    const bucket = buckets.get(key);

    if (!bucket || currentTime - bucket.windowStartedAt >= options.windowMs) {
      buckets.set(key, { count: 1, windowStartedAt: currentTime });
      return { limited: false };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStartedAt + options.windowMs - currentTime) / 1000));
    if (bucket.count >= options.maxRequests) {
      bucket.count += 1;
      return { limited: true, retryAfterSeconds };
    }

    bucket.count += 1;
    return { limited: false };
  }

  function reset(): void {
    buckets.clear();
  }

  return {
    consume,
    reset,
  };
}

export const highRiskWriteRateLimiter = createWriteRateLimiter({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
});

export function createWriteRateLimitMiddleware(options: WriteRateLimitMiddlewareOptions): RequestHandler {
  const limiter = options.limiter || highRiskWriteRateLimiter;
  const message = options.message || '操作过于频繁，请稍后再试';

  return (req: Request, res: Response, next: NextFunction): void => {
    const result = limiter.consume({
      tenantId: req.tenantId,
      userId: req.userId,
      ip: clientIp(req),
      routeKey: options.routeKey,
    });

    if (result.limited) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds || 60));
      error(res, 'WRITE_RATE_LIMITED', message, 429);
      return;
    }

    next();
  };
}

function identityKey(identity: WriteRateLimitIdentity): string {
  return [
    normalizeKeyPart(identity.tenantId || 'no-tenant'),
    normalizeKeyPart(identity.userId || 'anonymous'),
    normalizeKeyPart(identity.ip || 'unknown-ip'),
    normalizeKeyPart(identity.routeKey),
  ].join(':');
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase() || 'empty';
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown-ip';
}
