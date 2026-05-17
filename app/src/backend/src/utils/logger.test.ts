import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { createAppLogger, createRequestLogger } from './logger.js';

describe('structured logger', () => {
  it('writes JSON logs and redacts sensitive request fields', () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const logger = createAppLogger({
      level: 'info',
      stream,
    });

    logger.info({
      password: 'PlainTextPassword',
      token: 'jwt-token',
      req: {
        headers: {
          authorization: 'Bearer jwt-token',
          cookie: 'session=secret',
        },
      },
      safe: 'visible',
    }, '用户操作日志');

    const output = JSON.parse(chunks.join('').trim()) as {
      msg: string;
      password: string;
      token: string;
      req: { headers: { authorization: string; cookie: string } };
      safe: string;
      service: string;
    };

    assert.equal(output.msg, '用户操作日志');
    assert.equal(output.service, 'kaopingyunwei-backend');
    assert.equal(output.safe, 'visible');
    assert.equal(output.password, '[已脱敏]');
    assert.equal(output.token, '[已脱敏]');
    assert.equal(output.req.headers.authorization, '[已脱敏]');
    assert.equal(output.req.headers.cookie, '[已脱敏]');
  });

  it('logs completed API requests with request context and duration', () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const logger = createAppLogger({ level: 'info', stream });
    const middleware = createRequestLogger(logger, () => 1_000);
    const req = {
      method: 'POST',
      originalUrl: '/api/scores/import/commit',
      userId: 'user-a',
      tenantId: 'tenant-a',
      ip: '10.0.0.1',
      headers: {},
    } as Request;
    const res = Object.assign(new EventEmitter(), {
      statusCode: 201,
    }) as Response & EventEmitter;
    let nextCalls = 0;

    middleware(req, res, () => {
      nextCalls += 1;
    });
    res.emit('finish');

    const output = JSON.parse(chunks.join('').trim()) as {
      msg: string;
      req: { method: string; url: string; userId: string; tenantId: string; ip: string };
      res: { statusCode: number };
      durationMs: number;
    };

    assert.equal(nextCalls, 1);
    assert.equal(output.msg, 'HTTP 请求完成');
    assert.equal(output.req.method, 'POST');
    assert.equal(output.req.url, '/api/scores/import/commit');
    assert.equal(output.req.userId, 'user-a');
    assert.equal(output.req.tenantId, 'tenant-a');
    assert.equal(output.req.ip, '10.0.0.1');
    assert.equal(output.res.statusCode, 201);
    assert.equal(output.durationMs, 0);
  });
});
