// ═══════════════════════════════════════════════════
// Prisma 客户端单例 — 防止开发时热重载创建多个实例
// ═══════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
