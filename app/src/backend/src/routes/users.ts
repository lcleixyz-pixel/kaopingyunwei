// ═══════════════════════════════════════════════════
// 用户管理路由 — 轻量账号管理
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { error, success } from '../utils/response.js';
import { hashPassword } from '../utils/crypto.js';
import { recordAudit } from '../utils/audit.js';
import {
  canAssignUserRole,
  canManageTargetUser,
  getAssignableUserRoles,
  isRoleCompatibleWithTenant,
} from '../services/userManagementRules.js';

const router = Router();

router.use(authenticate);
router.use(requireRoles('SYS_ADMIN', 'HQ_ADMIN'));

const assignableUserRoleSchema = z.enum(['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF']);
const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']);

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().nullable().optional()
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().email().nullable().optional()
);

const listUsersSchema = z.object({
  tenantId: z.string().uuid().optional(),
  role: assignableUserRoleSchema.optional(),
  status: userStatusSchema.optional(),
  keyword: z.string().trim().optional(),
});

const createUserSchema = z.object({
  tenantId: z.string().uuid(),
  username: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_.-]+$/),
  realName: z.string().trim().min(1).max(50),
  role: assignableUserRoleSchema,
  phone: optionalText,
  email: optionalEmail,
  password: z.string().min(6).max(72),
  status: userStatusSchema.default('ACTIVE'),
});

const updateUserSchema = z.object({
  realName: z.string().trim().min(1).max(50).optional(),
  role: assignableUserRoleSchema.optional(),
  phone: optionalText,
  email: optionalEmail,
  status: userStatusSchema.optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6).max(72),
});

type ManagedUser = Prisma.UserGetPayload<{
  include: {
    tenant: {
      select: {
        id: true;
        code: true;
        name: true;
        type: true;
        status: true;
      };
    };
  };
}>;

router.get('/options', async (req, res) => {
  try {
    const roles = getAssignableUserRoles(req.userRole);
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
      },
    });

    success(res, { tenants, roles });
  } catch (err) {
    console.error('Get user options error:', err);
    error(res, 'INTERNAL_ERROR', '获取账号选项失败', 500);
  }
});

router.get('/', async (req, res) => {
  try {
    const result = listUsersSchema.safeParse(req.query);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const manageableRoles = getAssignableUserRoles(req.userRole);
    const where: Prisma.UserWhereInput = {};
    if (req.userRole === 'HQ_ADMIN') {
      where.role = { in: manageableRoles };
    }
    if (result.data.tenantId) where.tenantId = result.data.tenantId;
    if (result.data.role) {
      if (!manageableRoles.includes(result.data.role)) {
        success(res, []);
        return;
      }
      where.role = result.data.role;
    }
    if (result.data.status) where.status = result.data.status;
    if (result.data.keyword) {
      const keyword = result.data.keyword;
      where.OR = [
        { username: { contains: keyword } },
        { realName: { contains: keyword } },
        { phone: { contains: keyword } },
        { email: { contains: keyword } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: userInclude,
      orderBy: [{ tenantId: 'asc' }, { role: 'asc' }, { username: 'asc' }],
    });

    success(res, users.map(sanitizeUser));
  } catch (err) {
    console.error('List users error:', err);
    error(res, 'INTERNAL_ERROR', '获取账号列表失败', 500);
  }
});

router.post('/', async (req, res) => {
  try {
    const result = createUserSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const data = result.data;
    if (!canAssignUserRole(req.userRole, data.role)) {
      error(res, 'FORBIDDEN', '无权创建该角色账号', 403);
      return;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId } });
    if (!tenant || tenant.status !== 'ACTIVE') {
      error(res, 'NOT_FOUND', '机构不存在或不可用', 404);
      return;
    }
    if (!isRoleCompatibleWithTenant(data.role, tenant.type)) {
      error(res, 'VALIDATION_ERROR', '账号角色与机构类型不匹配', 400);
      return;
    }

    const existing = await prisma.user.findFirst({ where: { username: data.username } });
    if (existing) {
      error(res, 'USERNAME_EXISTS', '用户名已存在', 409);
      return;
    }

    const user = await prisma.user.create({
      data: {
        tenantId: data.tenantId,
        username: data.username,
        password: await hashPassword(data.password),
        realName: data.realName,
        role: data.role,
        phone: data.phone,
        email: data.email,
        status: data.status,
      },
      include: userInclude,
    });

    const safeUser = sanitizeUser(user);
    await recordAudit(req, {
      action: 'USER_CREATE',
      target: 'User',
      targetId: user.id,
      newValue: safeUser,
    });

    success(res, safeUser, 201);
  } catch (err) {
    console.error('Create user error:', err);
    error(res, 'INTERNAL_ERROR', '创建账号失败', 500);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const result = updateUserSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldUser = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      include: userInclude,
    });
    if (!oldUser) {
      error(res, 'NOT_FOUND', '账号不存在', 404);
      return;
    }

    const data = result.data;
    if (!canManageTargetUser({
      actorRole: req.userRole,
      actorUserId: req.userId,
      targetRole: oldUser.role,
      targetUserId: oldUser.id,
      nextRole: data.role,
      nextStatus: data.status,
    })) {
      error(res, 'FORBIDDEN', '无权修改该账号', 403);
      return;
    }
    if (data.role && !isRoleCompatibleWithTenant(data.role, oldUser.tenant.type)) {
      error(res, 'VALIDATION_ERROR', '账号角色与机构类型不匹配', 400);
      return;
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.realName !== undefined) updateData.realName = data.realName;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length === 0) {
      error(res, 'VALIDATION_ERROR', '没有可更新的字段', 400);
      return;
    }

    const user = await prisma.user.update({
      where: { id: oldUser.id },
      data: updateData,
      include: userInclude,
    });

    const safeUser = sanitizeUser(user);
    await recordAudit(req, {
      action: 'USER_UPDATE',
      target: 'User',
      targetId: user.id,
      oldValue: sanitizeUser(oldUser),
      newValue: safeUser,
    });

    success(res, safeUser);
  } catch (err) {
    console.error('Update user error:', err);
    error(res, 'INTERNAL_ERROR', '保存账号失败', 500);
  }
});

router.post('/:id/reset-password', async (req, res) => {
  try {
    const result = resetPasswordSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const oldUser = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      include: userInclude,
    });
    if (!oldUser) {
      error(res, 'NOT_FOUND', '账号不存在', 404);
      return;
    }
    if (!canManageTargetUser({
      actorRole: req.userRole,
      actorUserId: req.userId,
      targetRole: oldUser.role,
      targetUserId: oldUser.id,
    })) {
      error(res, 'FORBIDDEN', '无权重置该账号密码', 403);
      return;
    }

    const user = await prisma.user.update({
      where: { id: oldUser.id },
      data: { password: await hashPassword(result.data.password) },
      include: userInclude,
    });

    await recordAudit(req, {
      action: 'USER_PASSWORD_RESET',
      target: 'User',
      targetId: user.id,
      oldValue: sanitizeUser(oldUser),
      newValue: {
        id: user.id,
        username: user.username,
        passwordReset: true,
      },
    });

    success(res, sanitizeUser(user));
  } catch (err) {
    console.error('Reset user password error:', err);
    error(res, 'INTERNAL_ERROR', '重置密码失败', 500);
  }
});

const userInclude = {
  tenant: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      status: true,
    },
  },
} satisfies Prisma.UserInclude;

function sanitizeUser(user: ManagedUser) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    tenant: user.tenant,
    username: user.username,
    realName: user.realName,
    role: user.role,
    phone: user.phone,
    email: user.email,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export default router;
