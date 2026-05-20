import type { z } from 'zod';
import { AppError, normalizeFriendlyError } from './friendlyErrors.js';

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  return parseRouteInput(schema, body);
}

export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.infer<T> {
  return parseRouteInput(schema, query);
}

function parseRouteInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const friendly = normalizeFriendlyError(result.error, '请求参数错误');
    throw new AppError(friendly.code, friendly.message, friendly.statusCode, friendly.details);
  }
  return result.data;
}
