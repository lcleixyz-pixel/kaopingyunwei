// ═══════════════════════════════════════════════════
// API响应封装 — 统一返回格式
// ═══════════════════════════════════════════════════

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

type SuccessMeta = Pick<ApiResponse<never>, 'meta'>['meta'];

export function success<T>(res: Response, data: T, statusCode = 200, extraMeta?: Partial<SuccessMeta>): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
      ...extraMeta,
    },
  };
  res.status(statusCode).json(response);
}

export function error(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: string
): void {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    },
  };
  res.status(statusCode).json(response);
}

// 常用错误快捷方法
export const errors = {
  unauthorized: (res: Response, message = '未授权，请先登录') =>
    error(res, 'UNAUTHORIZED', message, 401),
  
  forbidden: (res: Response, message = '无权限执行此操作') =>
    error(res, 'FORBIDDEN', message, 403),
  
  notFound: (res: Response, message = '资源不存在') =>
    error(res, 'NOT_FOUND', message, 404),
  
  badRequest: (res: Response, message = '请求参数错误') =>
    error(res, 'BAD_REQUEST', message, 400),
  
  internal: (res: Response, message = '服务器内部错误') =>
    error(res, 'INTERNAL_ERROR', message, 500),
};
