import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from './friendlyErrors.js';
import { enforceUnpagedListLimit, parseListPagination } from './listSafety.js';

describe('safe list query handling', () => {
  it('uses an overflow sentinel for unpaged list reads', () => {
    const pagination = parseListPagination({}, {
      maxUnpaged: 2,
      overflowMessage: '数据较多，请先筛选后再查看',
    });

    assert.equal(pagination.isPaginated, false);
    assert.equal(pagination.take, 3);
    assert.deepEqual(enforceUnpagedListLimit([1, 2], pagination), [1, 2]);
    assert.throws(
      () => enforceUnpagedListLimit([1, 2, 3], pagination),
      (err) => err instanceof AppError
        && err.code === 'LIST_TOO_LARGE'
        && err.message === '数据较多，请先筛选后再查看'
    );
  });

  it('normalizes page and pageSize while capping oversized requests', () => {
    const pagination = parseListPagination({ page: '3', pageSize: '999' }, {
      defaultPageSize: 20,
      maxPageSize: 100,
      maxUnpaged: 200,
    });

    assert.equal(pagination.isPaginated, true);
    assert.equal(pagination.page, 3);
    assert.equal(pagination.pageSize, 100);
    assert.equal(pagination.skip, 200);
    assert.equal(pagination.take, 100);
  });

  it('rejects invalid pagination values with a Chinese validation error', () => {
    assert.throws(
      () => parseListPagination({ page: 'abc', pageSize: '10' }),
      (err) => err instanceof AppError
        && err.code === 'VALIDATION_ERROR'
        && err.message === '分页参数格式不正确，请输入正整数'
    );
  });
});
