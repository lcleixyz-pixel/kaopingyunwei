export const DEFAULT_PAGE_SIZE = 20;
export const SUMMARY_PAGE_SIZE = 200;

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function withPaginationParams(
  params: Record<string, unknown> = {},
  pagination: PaginationState,
): Record<string, unknown> {
  return {
    ...params,
    page: Math.max(1, pagination.page),
    pageSize: Math.max(1, pagination.pageSize),
  };
}

export function clampPageAfterMeta(currentPage: number, meta?: PaginationMeta): number {
  const safePage = Math.max(1, currentPage);
  if (!meta) return safePage;
  return Math.min(safePage, Math.max(1, meta.totalPages));
}

export function paginationSummary(meta: PaginationMeta | undefined, visibleCount: number): string {
  if (!meta) return `当前显示 ${visibleCount} 条`;
  return `第 ${meta.page} / ${Math.max(1, meta.totalPages)} 页，共 ${meta.total} 条`;
}
