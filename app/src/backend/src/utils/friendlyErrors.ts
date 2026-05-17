import type { Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { error } from './response.js';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
    public details?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type FriendlyError = {
  code: string;
  message: string;
  statusCode: number;
  details?: string;
};

export function normalizeFriendlyError(err: unknown, fallbackMessage: string): FriendlyError {
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    };
  }

  if (err instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: '请求参数错误，请检查填写内容',
      statusCode: 400,
      details: err.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; '),
    };
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return {
        code: 'FILE_TOO_LARGE',
        message: '文件过大，请压缩后再上传',
        statusCode: 413,
      };
    }
    return {
      code: 'UPLOAD_ERROR',
      message: '文件上传失败，请检查文件后重试',
      statusCode: 400,
    };
  }

  if (isFriendlyErrorShape(err)) {
    return {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: fallbackMessage,
    statusCode: 500,
  };
}

export function respondWithFriendlyError(res: Response, err: unknown, fallbackMessage: string): void {
  const friendly = normalizeFriendlyError(err, fallbackMessage);
  if (friendly.statusCode >= 500) {
    console.error(fallbackMessage, err);
  }
  error(res, friendly.code, friendly.message, friendly.statusCode, friendly.details);
}

function isFriendlyErrorShape(value: unknown): value is FriendlyError {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FriendlyError>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.statusCode === 'number' &&
    candidate.statusCode >= 400 &&
    candidate.statusCode < 600 &&
    (candidate.details === undefined || typeof candidate.details === 'string')
  );
}
