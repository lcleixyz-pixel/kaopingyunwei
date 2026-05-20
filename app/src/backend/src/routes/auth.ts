// ═══════════════════════════════════════════════════
// 认证路由 — 登录/登出/获取当前用户
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, generateToken } from '../utils/crypto.js';
import { success, error } from '../utils/response.js';
import { loginRateLimiter } from '../services/loginRateLimit.js';
import { loginSchema, setupSchema } from '../services/authSchemas.js';
import { respondWithFriendlyError } from '../utils/friendlyErrors.js';

const router = Router();

/**
 * POST /api/auth/login — 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      respondWithFriendlyError(res, result.error, '登录失败');
      return;
    }

    const { username, password, tenantCode } = result.data;
    const loginIdentity = {
      username,
      tenantCode,
      ip: clientIp(req),
    };
    const rateLimit = loginRateLimiter.check(loginIdentity);
    if (rateLimit.limited) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds || 60));
      error(res, 'LOGIN_RATE_LIMITED', '登录失败次数过多，请稍后再试', 429);
      return;
    }

    // 查找用户
    let user;
    if (tenantCode) {
      user = await prisma.user.findFirst({
        where: {
          username,
          tenant: { code: tenantCode },
        },
        include: { tenant: true },
      });
    } else {
      // 系统管理员不指定tenantCode
      user = await prisma.user.findFirst({
        where: { username },
        include: { tenant: true },
      });
    }

    if (!user || !user.tenant) {
      loginRateLimiter.recordFailure(loginIdentity);
      error(res, 'LOGIN_FAILED', '用户名或密码错误', 401);
      return;
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      loginRateLimiter.recordFailure(loginIdentity);
      error(res, 'LOGIN_FAILED', '用户名或密码错误', 401);
      return;
    }

    // 检查用户状态
    if (user.status !== 'ACTIVE') {
      error(res, 'ACCOUNT_LOCKED', '账户已被锁定或禁用', 403);
      return;
    }

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 生成token
    const token = generateToken(user.id, user.tenantId, user.role);
    loginRateLimiter.recordSuccess(loginIdentity);

    success(res, {
      token,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        realName: user.realName,
        role: user.role,
        phone: user.phone,
        email: user.email,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
      },
      tenant: {
        id: user.tenant.id,
        code: user.tenant.code,
        name: user.tenant.name,
        type: user.tenant.type,
        status: user.tenant.status,
      },
    });
  } catch (err) {
    respondWithFriendlyError(res, err, '登录失败');
  }
});

/**
 * POST /api/auth/setup — 初始化注册（仅用于首次设置）
 */
router.post('/setup', async (req, res) => {
  try {
    const result = setupSchema.safeParse(req.body);
    if (!result.success) {
      respondWithFriendlyError(res, result.error, '初始化失败');
      return;
    }

    // 检查是否已有用户
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      error(res, 'SETUP_COMPLETED', '系统已初始化，不能重复设置', 403);
      return;
    }

    const { username, password, realName, tenantName } = result.data;

    // 创建总部租户
    const tenant = await prisma.tenant.create({
      data: {
        code: 'HQ001',
        name: tenantName || '总部',
        type: 'HQ',
        status: 'ACTIVE',
      },
    });

    // 创建系统管理员
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username,
        password: await hashPassword(password),
        realName: realName || '系统管理员',
        role: 'SYS_ADMIN',
        status: 'ACTIVE',
      },
    });

    success(res, {
      message: '系统初始化成功',
      tenant: {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
      },
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        realName: user.realName,
      },
    });
  } catch (err) {
    respondWithFriendlyError(res, err, '初始化失败');
  }
});

/**
 * GET /api/auth/me — 获取当前用户信息
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      error(res, 'UNAUTHORIZED', '未授权', 401);
      return;
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('../utils/crypto.js');
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!user) {
      error(res, 'NOT_FOUND', '用户不存在', 404);
      return;
    }

    success(res, {
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        phone: user.phone,
        email: user.email,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
      },
      tenant: {
        id: user.tenant.id,
        code: user.tenant.code,
        name: user.tenant.name,
        type: user.tenant.type,
        status: user.tenant.status,
      },
    });
  } catch {
    error(res, 'UNAUTHORIZED', 'Token无效', 401);
  }
});

export default router;

function clientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown-ip';
}
