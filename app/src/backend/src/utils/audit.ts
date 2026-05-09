// ═══════════════════════════════════════════════════
// 审计日志工具 — 敏感业务操作统一留痕
// ═══════════════════════════════════════════════════

import type { Request } from 'express';
import { prisma } from '../lib/prisma.js';

interface AuditInput {
  action: string;
  target: string;
  targetId?: string;
  examNodeId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function recordAudit(req: Request, input: AuditInput): Promise<void> {
  if (!req.tenantId) return;

  await prisma.auditLog.create({
    data: {
      tenantId: req.tenantId,
      userId: req.userId,
      examNodeId: input.examNodeId,
      action: input.action,
      target: input.target,
      targetId: input.targetId,
      oldValue: serializeAuditValue(input.oldValue),
      newValue: serializeAuditValue(input.newValue),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });
}

function serializeAuditValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
