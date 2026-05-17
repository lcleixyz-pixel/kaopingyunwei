import { ChevronLeft, ChevronRight } from 'lucide-react';
import { paginationSummary, type PaginationMeta, type PaginationState } from '@/lib/apiPagination';

interface PaginationBarProps {
  pagination: PaginationState;
  meta?: PaginationMeta;
  visibleCount: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationBar({
  pagination,
  meta,
  visibleCount,
  isLoading = false,
  onPageChange,
}: PaginationBarProps) {
  if (!meta || meta.total <= pagination.pageSize) return null;

  const currentPage = meta.page || pagination.page;
  const totalPages = Math.max(1, meta.totalPages);
  const canGoPrevious = currentPage > 1 && !isLoading;
  const canGoNext = currentPage < totalPages && !isLoading;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>{paginationSummary(meta, visibleCount)}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canGoPrevious}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          上一页
        </button>
        <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-slate-500">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一页
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
