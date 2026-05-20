import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import type { Request, RequestHandler } from 'express';
import config from '../config/index.js';

const REDACT_PATHS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
  'req.body.SEED_USER_PASSWORDS_JSON',
  'req.body.SMOKE_USER_PASSWORDS_JSON',
  'headers.authorization',
  'headers.cookie',
];

export interface CreateAppLoggerOptions {
  level?: string;
  stream?: DestinationStream;
}

export function createAppLogger(options: CreateAppLoggerOptions = {}): Logger {
  const loggerOptions: LoggerOptions = {
    level: options.level || config.LOG_LEVEL,
    base: {
      service: 'kaopingyunwei-backend',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: REDACT_PATHS,
      censor: '[已脱敏]',
    },
  };

  return options.stream ? pino(loggerOptions, options.stream) : pino(loggerOptions);
}

export const logger = createAppLogger();

export function createRequestLogger(appLogger: Logger = logger, now: () => number = Date.now): RequestHandler {
  return (req, res, next): void => {
    const startedAt = now();
    res.on('finish', () => {
      const durationMs = now() - startedAt;
      appLogger.info({
        req: {
          method: req.method,
          url: requestUrl(req),
          userId: req.userId,
          tenantId: req.tenantId,
          ip: clientIp(req),
        },
        res: {
          statusCode: res.statusCode,
        },
        durationMs,
      }, 'HTTP 请求完成');
    });
    next();
  };
}

function requestUrl(req: Request): string {
  return req.originalUrl || req.url;
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown-ip';
}
