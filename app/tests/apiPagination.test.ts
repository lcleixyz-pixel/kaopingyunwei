import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_PAGE_SIZE,
  clampPageAfterMeta,
  paginationSummary,
  withPaginationParams,
} from '../src/lib/apiPagination.js';

describe('frontend API pagination helpers', () => {
  it('adds page and page size without dropping existing filters', () => {
    const params = withPaginationParams(
      { status: 'PUBLISHED', search: '焊工' },
      { page: 2, pageSize: DEFAULT_PAGE_SIZE },
    );

    assert.deepEqual(params, {
      status: 'PUBLISHED',
      search: '焊工',
      page: 2,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('clamps current page into a safe range after data changes', () => {
    assert.equal(clampPageAfterMeta(5, { page: 5, pageSize: 20, total: 45, totalPages: 3 }), 3);
    assert.equal(clampPageAfterMeta(0, { page: 0, pageSize: 20, total: 0, totalPages: 0 }), 1);
    assert.equal(clampPageAfterMeta(2), 2);
  });

  it('builds Chinese friendly pagination summary text', () => {
    assert.equal(
      paginationSummary({ page: 2, pageSize: 20, total: 45, totalPages: 3 }, 20),
      '第 2 / 3 页，共 45 条',
    );
    assert.equal(paginationSummary(undefined, 7), '当前显示 7 条');
  });
});
