import { z } from 'zod';

const trimmedText = (message: string) => z.string().trim().min(1, message);

export const loginSchema = z.object({
  username: trimmedText('用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
  tenantCode: z.string().trim().optional(),
});

export const setupSchema = z.object({
  username: trimmedText('用户名不能为空'),
  password: z.string().min(12, '初始化密码至少 12 位'),
  realName: trimmedText('真实姓名不能为空').optional(),
  tenantName: trimmedText('租户名称不能为空').optional(),
});
