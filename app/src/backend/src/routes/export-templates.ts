// ═══════════════════════════════════════════════════
// 导出模板路由 — 分支模板库 + 单元格映射
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { recordAudit } from '../utils/audit.js';
import { canReadAcrossTenants } from '../services/accessScope.js';
import { DEFAULT_CANDIDATE_TEMPLATE_MAPPINGS, parseTemplateMappings } from '../services/templateExport.js';

const router = Router();

router.use(authenticate);

const mappingSchema = z.object({
  field: z.string().min(1),
  cell: z.string().regex(/^[A-Z]{1,3}[1-9]\d*$/i, '单元格格式应类似 B6'),
  label: z.string().optional(),
});

const templateSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().trim().min(1, '模板名称不能为空'),
  type: z.string().default('CANDIDATE_REGISTRATION'),
  fileName: z.string().optional(),
  fileBase64: z.string().optional(),
  mappings: z.array(mappingSchema).default(DEFAULT_CANDIDATE_TEMPLATE_MAPPINGS),
  isDefault: z.boolean().default(true),
});

router.get('/', async (req, res) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const where: any = canReadAcrossTenants(req.userRole) ? {} : { tenantId: req.tenantId! };
    if (type) where.type = type;

    const templates = await prisma.exportTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      include: {
        tenant: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    success(res, templates.map((template) => ({
      id: template.id,
      tenantId: template.tenantId,
      tenant: template.tenant,
      name: template.name,
      type: template.type,
      fileName: template.fileName,
      mappings: parseTemplateMappings(template.mappingJson),
      isDefault: template.isDefault,
      createdBy: template.createdBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    })));
  } catch (err) {
    console.error('Get export templates error:', err);
    error(res, 'INTERNAL_ERROR', '获取导出模板失败', 500);
  }
});

router.post('/', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const result = templateSchema.safeParse(req.body);
    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const data = result.data;
    const targetTenantId = data.tenantId || req.tenantId!;
    if (req.userRole !== 'SYS_ADMIN' && targetTenantId !== req.tenantId) {
      error(res, 'FORBIDDEN', '只能维护本分支模板', 403);
      return;
    }

    const template = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.exportTemplate.updateMany({
          where: { tenantId: targetTenantId, type: data.type },
          data: { isDefault: false },
        });
      }

      return tx.exportTemplate.create({
        data: {
          tenantId: targetTenantId,
          name: data.name,
          type: data.type,
          fileName: data.fileName,
          fileBase64: data.fileBase64,
          mappingJson: JSON.stringify(data.mappings),
          isDefault: data.isDefault,
          createdBy: req.userId,
        },
      });
    });

    await recordAudit(req, {
      action: 'EXPORT_TEMPLATE_CREATE',
      target: 'ExportTemplate',
      targetId: template.id,
      newValue: {
        id: template.id,
        tenantId: template.tenantId,
        name: template.name,
        type: template.type,
        fileName: template.fileName,
        mappings: data.mappings,
        isDefault: template.isDefault,
      },
    });

    success(res, {
      ...template,
      fileBase64: undefined,
      mappings: data.mappings,
    }, 201);
  } catch (err) {
    console.error('Create export template error:', err);
    error(res, 'INTERNAL_ERROR', '保存导出模板失败', 500);
  }
});

router.patch('/:id/default', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const template = await prisma.exportTemplate.findFirst({
      where: req.userRole === 'SYS_ADMIN' ? { id } : { id, tenantId: req.tenantId! },
    });

    if (!template) {
      error(res, 'NOT_FOUND', '模板不存在', 404);
      return;
    }

    await prisma.$transaction([
      prisma.exportTemplate.updateMany({
        where: { tenantId: template.tenantId, type: template.type },
        data: { isDefault: false },
      }),
      prisma.exportTemplate.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    await recordAudit(req, {
      action: 'EXPORT_TEMPLATE_SET_DEFAULT',
      target: 'ExportTemplate',
      targetId: id,
      newValue: { id, tenantId: template.tenantId, type: template.type },
    });

    success(res, { message: '默认模板已更新' });
  } catch (err) {
    console.error('Set default template error:', err);
    error(res, 'INTERNAL_ERROR', '设置默认模板失败', 500);
  }
});

router.delete('/:id', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const template = await prisma.exportTemplate.findFirst({
      where: req.userRole === 'SYS_ADMIN' ? { id } : { id, tenantId: req.tenantId! },
    });

    if (!template) {
      error(res, 'NOT_FOUND', '模板不存在', 404);
      return;
    }

    await prisma.exportTemplate.delete({ where: { id } });
    await recordAudit(req, {
      action: 'EXPORT_TEMPLATE_DELETE',
      target: 'ExportTemplate',
      targetId: id,
      oldValue: {
        id: template.id,
        tenantId: template.tenantId,
        name: template.name,
        type: template.type,
      },
    });

    success(res, { message: '模板已删除' });
  } catch (err) {
    console.error('Delete export template error:', err);
    error(res, 'INTERNAL_ERROR', '删除模板失败', 500);
  }
});

export default router;
