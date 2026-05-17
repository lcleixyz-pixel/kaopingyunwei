import type { ApiResponse } from '@/shared';

type ApiErrorPayload = ApiResponse<unknown> & {
  error?: {
    code?: string;
    message?: string;
    details?: string;
  };
};

type UnknownHttpError = {
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: ApiErrorPayload;
  };
};

export class ApiClientError extends Error {
  code: string;
  status?: number;
  requestId?: string;
  details?: string;

  constructor(message: string, code = 'REQUEST_FAILED', status?: number, requestId?: string, details?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

export function normalizeApiError(error: unknown, fallbackMessage = '请求失败，请稍后重试'): ApiClientError {
  if (error instanceof ApiClientError) return error;

  const candidate = error as UnknownHttpError;
  if (candidate?.code === 'ECONNABORTED') {
    return new ApiClientError('请求超时，请稍后重试', 'REQUEST_TIMEOUT');
  }

  if (!candidate?.response) {
    return new ApiClientError('网络连接异常，请检查网络后重试', candidate?.code || 'NETWORK_ERROR');
  }

  const status = candidate.response.status;
  const payload = candidate.response.data;
  const backendCode = payload?.error?.code || statusCodeToCode(status);
  const backendMessage = payload?.error?.message;
  const message = isUserSafeChineseMessage(backendMessage) ? backendMessage! : statusCodeToMessage(status, fallbackMessage);

  return new ApiClientError(message, backendCode, status, payload?.meta?.requestId, payload?.error?.details);
}

function statusCodeToCode(status?: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 413:
      return 'FILE_TOO_LARGE';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL_ERROR';
    default:
      return 'REQUEST_FAILED';
  }
}

function statusCodeToMessage(status: number | undefined, fallbackMessage: string): string {
  switch (status) {
    case 400:
      return '请求参数有误，请检查后重试';
    case 401:
      return '登录状态已失效，请重新登录';
    case 403:
      return '没有权限执行此操作';
    case 404:
      return '请求的资源不存在或已被删除';
    case 413:
      return '文件过大，请压缩后再上传';
    case 429:
      return '操作过于频繁，请稍后再试';
    case 500:
    case 502:
    case 503:
    case 504:
      return '服务器暂时无法完成操作，请稍后再试';
    default:
      return fallbackMessage;
  }
}

function isUserSafeChineseMessage(message?: string): boolean {
  if (!message) return false;
  if (!/[\u4e00-\u9fa5]/.test(message)) return false;
  if (/SQLITE|Prisma|Error:|stack|database is locked|ECONN|ENOENT/i.test(message)) return false;
  return true;
}
