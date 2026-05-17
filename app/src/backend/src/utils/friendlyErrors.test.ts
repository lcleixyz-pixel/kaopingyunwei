import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import multer from 'multer';
import { z } from 'zod';
import { AppError, normalizeFriendlyError } from './friendlyErrors.js';

describe('friendly backend error normalization', () => {
  it('keeps intentional application errors user-friendly', () => {
    const result = normalizeFriendlyError(new AppError('LOGIN_RATE_LIMITED', '登录失败次数过多，请稍后再试', 429), '登录失败');

    assert.equal(result.code, 'LOGIN_RATE_LIMITED');
    assert.equal(result.message, '登录失败次数过多，请稍后再试');
    assert.equal(result.statusCode, 429);
  });

  it('turns Zod validation errors into a concise Chinese message', () => {
    const parsed = z.object({ username: z.string().min(1) }).safeParse({ username: '' });
    assert.equal(parsed.success, false);

    const result = normalizeFriendlyError(parsed.error, '保存失败');

    assert.equal(result.code, 'VALIDATION_ERROR');
    assert.equal(result.message, '请求参数错误，请检查填写内容');
    assert.equal(result.statusCode, 400);
    assert.match(result.details || '', /username/);
  });

  it('turns oversized Multer uploads into a 413 Chinese message', () => {
    const result = normalizeFriendlyError(new multer.MulterError('LIMIT_FILE_SIZE'), '上传失败');

    assert.equal(result.code, 'FILE_TOO_LARGE');
    assert.equal(result.message, '文件过大，请压缩后再上传');
    assert.equal(result.statusCode, 413);
  });

  it('hides unexpected internal errors behind the route fallback message', () => {
    const result = normalizeFriendlyError(new Error('SQLITE_BUSY: database is locked'), '保存证书附件失败');

    assert.equal(result.code, 'INTERNAL_ERROR');
    assert.equal(result.message, '保存证书附件失败');
    assert.equal(result.statusCode, 500);
    assert.equal(result.details, undefined);
  });
});
