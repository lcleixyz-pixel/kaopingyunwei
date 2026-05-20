import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { AppError } from './friendlyErrors.js';
import { parseBody, parseQuery } from './routeValidation.js';

describe('route validation helpers', () => {
  it('returns parsed body data when the schema matches', () => {
    const data = parseBody(z.object({ name: z.string().trim().min(1) }), { name: ' 张三 ' });

    assert.deepEqual(data, { name: '张三' });
  });

  it('throws a friendly validation error when body validation fails', () => {
    assert.throws(
      () => parseBody(z.object({ name: z.string().trim().min(1, '姓名不能为空') }), { name: '' }),
      (err) => err instanceof AppError
        && err.code === 'VALIDATION_ERROR'
        && err.message === '请求参数错误，请检查填写内容'
    );
  });

  it('returns parsed query data when the schema matches', () => {
    const data = parseQuery(z.object({ page: z.coerce.number().int().min(1) }), { page: '2' });

    assert.deepEqual(data, { page: 2 });
  });
});
