import { AppError } from './friendlyErrors.js';

type ListPaginationOptions = {
  defaultPageSize?: number;
  maxPageSize?: number;
  maxUnpaged?: number;
  overflowMessage?: string;
};

export type ListPagination = {
  isPaginated: boolean;
  page?: number;
  pageSize?: number;
  skip?: number;
  take: number;
  maxUnpaged: number;
  overflowMessage: string;
};

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGE_SIZE = 200;
const DEFAULT_MAX_UNPAGED = 200;
const DEFAULT_OVERFLOW_MESSAGE = '数据较多，请输入筛选条件或分页查看';

export function parseListPagination(query: Record<string, unknown>, options: ListPaginationOptions = {}): ListPagination {
  const defaultPageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize ?? DEFAULT_MAX_PAGE_SIZE;
  const maxUnpaged = options.maxUnpaged ?? DEFAULT_MAX_UNPAGED;
  const overflowMessage = options.overflowMessage ?? DEFAULT_OVERFLOW_MESSAGE;
  const hasPagination = query.page !== undefined || query.pageSize !== undefined;

  if (!hasPagination) {
    return {
      isPaginated: false,
      take: maxUnpaged + 1,
      maxUnpaged,
      overflowMessage,
    };
  }

  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, defaultPageSize);
  const pageSize = Math.min(requestedPageSize, maxPageSize);

  return {
    isPaginated: true,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    maxUnpaged,
    overflowMessage,
  };
}

export function enforceUnpagedListLimit<T>(rows: T[], pagination: ListPagination): T[] {
  if (!pagination.isPaginated && rows.length > pagination.maxUnpaged) {
    throw new AppError('LIST_TOO_LARGE', pagination.overflowMessage, 400);
  }
  return rows;
}

export function paginationMeta(pagination: ListPagination, total: number) {
  if (!pagination.isPaginated || !pagination.page || !pagination.pageSize) return undefined;
  return {
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pagination.pageSize), 1),
    },
  };
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError('VALIDATION_ERROR', '分页参数格式不正确，请输入正整数', 400);
  }
  return parsed;
}
