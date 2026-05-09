// ═══════════════════════════════════════════════════
// 认证中间件 — JWT验证 + 多租户注入
// ═══════════════════════════════════════════════════

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken } from '../utils/crypto.js';
import { errors } from '../utils/response.js';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      tenantId?: string;
      userRole?: string;
    }
  }
}

/**
 * JWT认证中间件
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    errors.unauthorized(res);
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    errors.unauthorized(res, 'Token无效或已过期');
  }
}

/**
 * 角色权限中间件
 */
export function requireRoles(...roleGroups: Array<string | string[]>): RequestHandler {
  const roles = roleGroups.flat();
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      errors.forbidden(res);
      return;
    }
    next();
  };
}
