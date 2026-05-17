// ═══════════════════════════════════════════════════
// 考评计划路由 — CRUD + 审批
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import type { NodeType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { respondWithFriendlyError } from '../utils/friendlyErrors.js';
import { addWorkDaysWithCalendar } from '../utils/dateUtils.js';
import { recordAudit } from '../utils/audit.js';
import {
  canRollbackPlan,
  getCancelPlanBlockReason,
  getInitialPlanStatus,
  getPublishNodeStatuses,
  getWorkTypesForOccupation,
  isRegistrationClosed,
  isCorePlanField,
  normalizeLevelLabel,
  type CancelPlanBlockReason,
} from '../services/phase1Rules.js';
import { isRequestedPlanStatusVisibleForRead, planTenantWhereForRead } from '../services/accessScope.js';
import { getWorkdayCalendarConfig } from '../services/workdayCalendars.js';

const router = Router();

router.use(authenticate);

// 节点元数据定义
const NODE_DEFINITIONS: Array<{ type: NodeType; deadlineDays: number; isMandatory: boolean }> = [
  { type: 'PLAN_CREATE', deadlineDays: -10, isMandatory: false },
  { type: 'REGISTRATION', deadlineDays: -7, isMandatory: false },
  { type: 'ROOM_ARRANGE', deadlineDays: -5, isMandatory: false },
  { type: 'EXAM_PREPARE', deadlineDays: -5, isMandatory: false },
  { type: 'EXAM_DAY', deadlineDays: 0, isMandatory: true },
  { type: 'SCORE_RECORD', deadlineDays: 3, isMandatory: true },
  { type: 'SCORE_PUBLISH', deadlineDays: 5, isMandatory: true },
  { type: 'CERT_MANAGE', deadlineDays: 10, isMandatory: true },
  { type: 'COMPLETE', deadlineDays: 10, isMandatory: true },
];

const createPlanSchema = z.object({
  title: z.string().min(1, '计划标题不能为空'),
  occupation: z.string().min(1, '职业不能为空'),
  examDate: z.string().datetime(),
  registrationDeadline: z.string().datetime(),
  profession: z.string().min(1, '工种不能为空'),
  level: z.string().min(1, '等级不能为空'),
  location: z.string().min(1, '考试地点不能为空'),
  maxCandidates: z.number().int().min(1).default(50),
  notes: z.string().optional(),
});

const updatePlanSchema = createPlanSchema.partial();

const cancelPlanSchema = z.object({
  reason: z.string().trim().min(1, '取消备注不能为空'),
});

const rollbackPlanSchema = z.object({
  reason: z.string().trim().optional(),
});

const localUploadBatchSchema = z.object({
  status: z.enum(['UPLOADED']).default('UPLOADED'),
  uploadedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  completeRegistrationNode: z.boolean().optional().default(false),
});

/**
 * GET /api/exam-plans — 考评计划列表
 */
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;

    const where: any = planTenantWhereForRead(req);

    if (!isRequestedPlanStatusVisibleForRead(req, status)) {
      success(res, []);
      return;
    }
    
    if (status && status !== 'ALL') {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { occupation: { contains: search as string } },
        { profession: { contains: search as string } },
      ];
    }

    const plans = await prisma.examPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: { id: true, code: true, name: true, type: true },
        },
        _count: {
          select: {
            candidates: true,
            nodes: true,
          },
        },
        nodes: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    success(res, plans.map(withRegistrationClosed));
  } catch (err) {
    respondWithFriendlyError(res, err, '获取计划列表失败');
  }
});

/**
 * POST /api/exam-plans — 创建考评计划
 */
router.post('/', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const result = createPlanSchema.safeParse(req.body);
    
    if (!result.success) {
      respondWithFriendlyError(res, result.error, '请求参数错误');
      return;
    }

    const data = result.data;
    const level = normalizeLevelLabel(data.level);
    const workTypes = getWorkTypesForOccupation(data.occupation, level);
    if (workTypes.length > 0 && !workTypes.includes(data.profession)) {
      error(res, 'VALIDATION_ERROR', '职业工种名称不属于所选职业', 400);
      return;
    }

    const examDate = new Date(data.examDate);
    const registrationDeadline = new Date(data.registrationDeadline);
    if (registrationDeadline > examDate) {
      error(res, 'VALIDATION_ERROR', '报名截止日期不能晚于考试日期', 400);
      return;
    }

    const calendar = await getWorkdayCalendarConfig(tenantId);

    // 创建计划
    const plan = await prisma.examPlan.create({
      data: {
        tenantId,
        title: data.title,
        occupation: data.occupation,
        examDate,
        registrationDeadline,
        profession: data.profession,
        level,
        location: data.location,
        maxCandidates: data.maxCandidates,
        notes: data.notes,
        status: getInitialPlanStatus(req.userRole as any),
        createdBy: req.userId!,
      },
    });

    // 自动创建9大节点
    const nodeData = NODE_DEFINITIONS.map((def) => ({
      planId: plan.id,
      nodeType: def.type,
      deadline: addWorkDaysWithCalendar(examDate, def.deadlineDays, calendar),
      status: 'PENDING' as const,
    }));

    await prisma.examNode.createMany({
      data: nodeData,
    });

    await recordAudit(req, {
      action: 'EXAM_PLAN_CREATE',
      target: 'ExamPlan',
      targetId: plan.id,
      newValue: plan,
    });

    success(res, plan, 201);
  } catch (err) {
    respondWithFriendlyError(res, err, '创建计划失败');
  }
});

/**
 * GET /api/exam-plans/:id/local-upload-batches — 地方系统上传回填记录
 */
router.get('/:id/local-upload-batches', async (req, res) => {
  try {
    const id = String(req.params.id);
    const plan = await prisma.examPlan.findFirst({
      where: { id, ...planTenantWhereForRead(req) },
      select: { id: true },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    const batches = await prisma.localUploadBatch.findMany({
      where: { planId: id },
      orderBy: { uploadedAt: 'desc' },
    });

    if (req.userRole === 'HQ_ADMIN' || req.userRole === 'HQ_STAFF' || req.userRole === 'SYS_ADMIN') {
      await recordAudit(req, {
        action: 'LOCAL_UPLOAD_BATCH_VIEW',
        target: 'LocalUploadBatch',
        targetId: id,
        newValue: { planId: id, count: batches.length },
      });
    }

    success(res, batches);
  } catch (err) {
    respondWithFriendlyError(res, err, '获取地方系统上传回填失败');
  }
});

/**
 * POST /api/exam-plans/:id/local-upload-batches — 新增地方系统上传回填
 */
router.post('/:id/local-upload-batches', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const result = localUploadBatchSchema.safeParse(req.body);

    if (!result.success) {
      respondWithFriendlyError(res, result.error, '请求参数错误');
      return;
    }

    const plan = await prisma.examPlan.findFirst({
      where: { id, tenantId },
      include: {
        nodes: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    if (result.data.completeRegistrationNode && plan.status !== 'PUBLISHED') {
      error(res, 'INVALID_PLAN_STATUS', '只有已发布计划可以结束考试报名阶段', 400);
      return;
    }

    const registrationNode = plan.nodes.find((node) => node.nodeType === 'REGISTRATION');
    if (result.data.completeRegistrationNode && !registrationNode) {
      error(res, 'REGISTRATION_NODE_MISSING', '未找到考试报名节点', 400);
      return;
    }

    const writeResult = await prisma.$transaction(async (tx) => {
      const batch = await tx.localUploadBatch.create({
        data: {
          planId: id,
          status: result.data.status,
          uploadedAt: result.data.uploadedAt ? new Date(result.data.uploadedAt) : new Date(),
          uploadedBy: req.userId,
          notes: result.data.notes,
        },
      });

      let completedRegistrationNode = null;
      let completedPlanCreateNode = null;
      let activatedNextNode = null;

      if (result.data.completeRegistrationNode && registrationNode && registrationNode.status !== 'COMPLETED') {
        const now = new Date();
        const planCreateNode = plan.nodes.find((node) => node.nodeType === 'PLAN_CREATE');

        if (planCreateNode && planCreateNode.status !== 'COMPLETED') {
          completedPlanCreateNode = await tx.examNode.update({
            where: { id: planCreateNode.id },
            data: {
              status: 'COMPLETED',
              completedAt: now,
              notes: appendPlanNote(planCreateNode.notes, '地方系统上传回填前补记制定计划节点完成'),
            },
          });
        }

        completedRegistrationNode = await tx.examNode.update({
          where: { id: registrationNode.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            notes: appendPlanNote(registrationNode.notes, '已回填地方系统上传状态，确认结束考试报名阶段'),
          },
        });

        const nextNode = plan.nodes
          .filter((node) => node.status === 'PENDING' && getNodeOrderIndex(node.nodeType) > getNodeOrderIndex('REGISTRATION'))
          .sort((a, b) => getNodeOrderIndex(a.nodeType) - getNodeOrderIndex(b.nodeType))[0];

        if (nextNode) {
          activatedNextNode = await tx.examNode.update({
            where: { id: nextNode.id },
            data: { status: 'IN_PROGRESS' },
          });
        }
      }

      return {
        batch,
        completedRegistrationNode,
        completedPlanCreateNode,
        activatedNextNode,
      };
    });

    await recordAudit(req, {
      action: 'LOCAL_UPLOAD_BATCH_CREATE',
      target: 'LocalUploadBatch',
      targetId: writeResult.batch.id,
      newValue: writeResult.batch,
    });

    if (writeResult.completedRegistrationNode) {
      await recordAudit(req, {
        action: 'EXAM_NODE_COMPLETE',
        target: 'ExamNode',
        targetId: writeResult.completedRegistrationNode.id,
        newValue: {
          nodeId: writeResult.completedRegistrationNode.id,
          planId: id,
          nodeType: 'REGISTRATION',
          source: 'LOCAL_UPLOAD_BATCH',
          activatedNextNodeId: writeResult.activatedNextNode?.id || null,
          completedPlanCreateNodeId: writeResult.completedPlanCreateNode?.id || null,
        },
      });
    }

    success(res, writeResult.batch, 201);
  } catch (err) {
    respondWithFriendlyError(res, err, '保存地方系统上传回填失败');
  }
});

/**
 * GET /api/exam-plans/:id — 计划详情
 */
router.get('/:id', async (req, res) => {
  try {
    const id = String(req.params.id);

    const plan = await prisma.examPlan.findFirst({
      where: { id, ...planTenantWhereForRead(req) },
      include: {
        tenant: {
          select: { id: true, code: true, name: true, type: true },
        },
        nodes: {
          orderBy: { createdAt: 'asc' },
        },
        candidates: true,
        _count: {
          select: { candidates: true, nodes: true },
        },
      },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    success(res, withRegistrationClosed(plan));
  } catch (err) {
    respondWithFriendlyError(res, err, '获取计划详情失败');
  }
});

/**
 * PATCH /api/exam-plans/:id — 编辑草稿计划，发布后仅允许备注变更
 */
router.patch('/:id', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const result = updatePlanSchema.safeParse(req.body);

    if (!result.success) {
      respondWithFriendlyError(res, result.error, '请求参数错误');
      return;
    }

    const where = req.userRole === 'SYS_ADMIN' ? { id } : { id, tenantId };
    const oldPlan = await prisma.examPlan.findFirst({ where });

    if (!oldPlan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    if (oldPlan.status === 'CANCELLED') {
      error(res, 'PLAN_CANCELLED', '已取消计划不能编辑', 400);
      return;
    }

    const data = result.data;
    const effectiveOccupation = data.occupation ?? oldPlan.occupation;
    const normalizedInputLevel = data.level === undefined ? undefined : normalizeLevelLabel(data.level);
    const effectiveLevel = normalizedInputLevel ?? normalizeLevelLabel(oldPlan.level);
    const effectiveProfession = data.profession ?? oldPlan.profession;
    const workTypes = getWorkTypesForOccupation(effectiveOccupation, effectiveLevel);
    if (workTypes.length > 0 && !workTypes.includes(effectiveProfession)) {
      error(res, 'VALIDATION_ERROR', '职业工种名称不属于所选职业', 400);
      return;
    }

    const effectiveExamDate = data.examDate ? new Date(data.examDate) : oldPlan.examDate;
    const effectiveRegistrationDeadline = data.registrationDeadline ? new Date(data.registrationDeadline) : oldPlan.registrationDeadline;
    if (effectiveRegistrationDeadline > effectiveExamDate) {
      error(res, 'VALIDATION_ERROR', '报名截止日期不能晚于考试日期', 400);
      return;
    }

    if (oldPlan.status !== 'DRAFT') {
      const attemptedCoreField = Object.keys(data).some((field) => isCorePlanField(field));
      if (attemptedCoreField) {
        error(res, 'PLAN_LOCKED', '计划发布后核心信息已锁定', 400);
        return;
      }
    }

    const updateData: any = {
      ...(data.title !== undefined && oldPlan.status === 'DRAFT' ? { title: data.title } : {}),
      ...(data.occupation !== undefined && oldPlan.status === 'DRAFT' ? { occupation: data.occupation } : {}),
      ...(data.examDate !== undefined && oldPlan.status === 'DRAFT' ? { examDate: new Date(data.examDate) } : {}),
      ...(data.registrationDeadline !== undefined && oldPlan.status === 'DRAFT' ? { registrationDeadline: new Date(data.registrationDeadline) } : {}),
      ...(data.profession !== undefined && oldPlan.status === 'DRAFT' ? { profession: data.profession } : {}),
      ...(data.level !== undefined && oldPlan.status === 'DRAFT' ? { level: normalizedInputLevel } : {}),
      ...(data.location !== undefined && oldPlan.status === 'DRAFT' ? { location: data.location } : {}),
      ...(data.maxCandidates !== undefined && oldPlan.status === 'DRAFT' ? { maxCandidates: data.maxCandidates } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    };

    if (Object.keys(updateData).length === 0) {
      error(res, 'VALIDATION_ERROR', '没有可更新的字段', 400);
      return;
    }

    const plan = await prisma.examPlan.update({
      where: { id },
      data: updateData,
    });

    if (oldPlan.status === 'DRAFT' && data.examDate) {
      const calendar = await getWorkdayCalendarConfig(plan.tenantId);
      await Promise.all(NODE_DEFINITIONS.map((def) => prisma.examNode.updateMany({
        where: { planId: plan.id, nodeType: def.type },
        data: { deadline: addWorkDaysWithCalendar(plan.examDate, def.deadlineDays, calendar) },
      })));
    }

    await recordAudit(req, {
      action: 'EXAM_PLAN_UPDATE',
      target: 'ExamPlan',
      targetId: id,
      oldValue: oldPlan,
      newValue: plan,
    });

    success(res, plan);
  } catch (err) {
    respondWithFriendlyError(res, err, '保存计划失败');
  }
});

/**
 * PATCH /api/exam-plans/:id/publish — 发布草稿计划并激活首个节点
 */
router.patch('/:id/publish', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const where = req.userRole === 'SYS_ADMIN' ? { id } : { id, tenantId };

    const oldPlan = await prisma.examPlan.findFirst({
      where,
      include: { nodes: { orderBy: { createdAt: 'asc' } } },
    });

    if (!oldPlan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    if (oldPlan.status !== 'DRAFT') {
      error(res, 'INVALID_STATUS', '只有草稿计划可以发布', 400);
      return;
    }

    const calendar = await getWorkdayCalendarConfig(oldPlan.tenantId);

    const plan = await prisma.$transaction(async (tx) => {
      if (oldPlan.nodes.length === 0) {
        await tx.examNode.createMany({
          data: NODE_DEFINITIONS.map((def) => ({
            planId: oldPlan.id,
            nodeType: def.type,
            deadline: addWorkDaysWithCalendar(oldPlan.examDate, def.deadlineDays, calendar),
            status: 'PENDING' as const,
          })),
        });
      }

      const nodes = oldPlan.nodes.length > 0
        ? oldPlan.nodes
        : await tx.examNode.findMany({ where: { planId: oldPlan.id }, orderBy: { createdAt: 'asc' } });

      for (const update of getPublishNodeStatuses(nodes)) {
        await tx.examNode.update({
          where: { id: update.id },
          data: {
            status: update.status,
            ...(update.shouldStampCompletedAt ? {
              completedAt: new Date(),
              notes: update.notes,
            } : {}),
          },
        });
      }

      return tx.examPlan.update({
        where: { id: oldPlan.id },
        data: { status: 'PUBLISHED' },
        include: {
          nodes: { orderBy: { createdAt: 'asc' } },
          _count: { select: { candidates: true, nodes: true } },
        },
      });
    });

    await recordAudit(req, {
      action: 'EXAM_PLAN_PUBLISH',
      target: 'ExamPlan',
      targetId: id,
      oldValue: oldPlan,
      newValue: plan,
    });

    success(res, withRegistrationClosed(plan));
  } catch (err) {
    respondWithFriendlyError(res, err, '发布计划失败');
  }
});

/**
 * PATCH /api/exam-plans/:id/rollback — 已发布计划回退为草稿，并将计划内考生转回意向考生
 */
router.patch('/:id/rollback', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const result = rollbackPlanSchema.safeParse(req.body || {});

    if (!result.success) {
      respondWithFriendlyError(res, result.error, '请求参数错误');
      return;
    }

    const where = req.userRole === 'SYS_ADMIN' ? { id } : { id, tenantId };
    const oldPlan = await prisma.examPlan.findFirst({
      where,
      include: {
        candidates: {
          include: {
            prospectiveSource: true,
          },
        },
      },
    });

    if (!oldPlan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    if (!canRollbackPlan(oldPlan.status)) {
      error(res, 'INVALID_STATUS', '只有已发布计划可以回退为草稿', 400);
      return;
    }

    const rollbackResult = await prisma.$transaction(async (tx) => {
      for (const candidate of oldPlan.candidates) {
        const prospectiveSource = candidate.prospectiveSource;

        if (prospectiveSource) {
          await tx.prospectiveCandidate.update({
            where: { id: prospectiveSource.id },
            data: {
              status: 'FOLLOWING',
              convertedCandidateId: null,
              notes: appendPlanNote(prospectiveSource.notes, `计划回退：${oldPlan.title}`),
            },
          });
        } else {
          const phone = candidate.phone || '未留存';
          const existingProspective = await tx.prospectiveCandidate.findFirst({
            where: {
              tenantId: oldPlan.tenantId,
              name: candidate.name,
              phone,
              convertedCandidateId: null,
            },
            orderBy: { updatedAt: 'desc' },
          });

          if (existingProspective) {
            await tx.prospectiveCandidate.update({
              where: { id: existingProspective.id },
              data: {
                status: 'FOLLOWING',
                intendedOccupation: existingProspective.intendedOccupation || oldPlan.occupation,
                intendedProfession: existingProspective.intendedProfession || oldPlan.profession,
                intendedLevel: existingProspective.intendedLevel || oldPlan.level,
                notes: appendPlanNote(existingProspective.notes, `计划回退：${oldPlan.title}`),
              },
            });
          } else {
            await tx.prospectiveCandidate.create({
              data: {
                tenantId: oldPlan.tenantId,
                name: candidate.name,
                phone,
                intendedOccupation: oldPlan.occupation,
                intendedProfession: oldPlan.profession,
                intendedLevel: oldPlan.level,
                source: '计划回退',
                status: 'FOLLOWING',
                notes: `由计划「${oldPlan.title}」回退生成`,
              },
            });
          }
        }
      }

      await tx.candidate.deleteMany({ where: { planId: id } });
      await tx.examNode.updateMany({
        where: { planId: id },
        data: {
          status: 'PENDING',
          completedAt: null,
        },
      });

      const plan = await tx.examPlan.update({
        where: { id },
        data: {
          status: 'DRAFT',
          notes: result.data.reason
            ? appendPlanNote(oldPlan.notes, `回退原因：${result.data.reason}`)
            : oldPlan.notes,
        },
        include: {
          tenant: {
            select: { id: true, code: true, name: true, type: true },
          },
          _count: { select: { candidates: true, nodes: true } },
        },
      });

      return { plan, revertedCandidateCount: oldPlan.candidates.length };
    });

    await recordAudit(req, {
      action: 'EXAM_PLAN_ROLLBACK',
      target: 'ExamPlan',
      targetId: id,
      oldValue: oldPlan,
      newValue: {
        ...rollbackResult.plan,
        revertedCandidateCount: rollbackResult.revertedCandidateCount,
      },
    });

    success(res, {
      ...rollbackResult.plan,
      revertedCandidateCount: rollbackResult.revertedCandidateCount,
    });
  } catch (err) {
    respondWithFriendlyError(res, err, '回退计划失败');
  }
});

/**
 * PATCH /api/exam-plans/:id/cancel — 取消计划
 */
router.patch('/:id/cancel', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const result = cancelPlanSchema.safeParse(req.body);

    if (!result.success) {
      respondWithFriendlyError(res, result.error, '请求参数错误');
      return;
    }

    const where = req.userRole === 'SYS_ADMIN' ? { id } : { id, tenantId };
    const oldPlan = await prisma.examPlan.findFirst({
      where,
      include: {
        _count: {
          select: { candidates: true },
        },
      },
    });

    if (!oldPlan) {
      error(res, 'NOT_FOUND', '计划不存在', 404);
      return;
    }

    const blockReason = getCancelPlanBlockReason({
      status: oldPlan.status,
      candidateCount: oldPlan._count.candidates,
      reason: result.data.reason,
    });

    if (blockReason) {
      const mapped = mapCancelPlanBlockReason(blockReason);
      error(res, mapped.code, mapped.message, 400);
      return;
    }

    const plan = await prisma.examPlan.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: appendPlanNote(oldPlan.notes, `取消原因：${result.data.reason}`),
      },
      include: {
        tenant: {
          select: { id: true, code: true, name: true, type: true },
        },
        _count: { select: { candidates: true, nodes: true } },
      },
    });

    await recordAudit(req, {
      action: 'EXAM_PLAN_CANCEL',
      target: 'ExamPlan',
      targetId: id,
      oldValue: oldPlan,
      newValue: plan,
    });

    success(res, plan);
  } catch (err) {
    respondWithFriendlyError(res, err, '取消计划失败');
  }
});

/**
 * PATCH /api/exam-plans/:id/approve — 兼容旧入口，Phase 1 已改为分支自审发布
 */
router.patch('/:id/approve', async (_req, res) => {
  error(res, 'PLAN_APPROVAL_DISABLED', 'Phase 1 已改为分支自审：请使用发布流程', 400);
});

function appendPlanNote(existing: string | null | undefined, note: string): string {
  return [existing?.trim(), note.trim()].filter(Boolean).join('\n');
}

function mapCancelPlanBlockReason(reason: CancelPlanBlockReason): { code: string; message: string } {
  const map: Record<CancelPlanBlockReason, { code: string; message: string }> = {
    PUBLISHED_PLAN_MUST_ROLLBACK_FIRST: {
      code: 'PLAN_MUST_ROLLBACK_FIRST',
      message: '已发布计划不能直接取消，请先回退到草稿',
    },
    PLAN_HAS_CANDIDATES: {
      code: 'PLAN_HAS_CANDIDATES',
      message: '该计划下已有考生，不能取消',
    },
    CANCEL_REASON_REQUIRED: {
      code: 'CANCEL_REASON_REQUIRED',
      message: '取消计划必须填写备注',
    },
    INVALID_PLAN_STATUS: {
      code: 'INVALID_STATUS',
      message: '当前状态不能取消计划',
    },
  };

  return map[reason];
}

function getNodeOrderIndex(nodeType: NodeType): number {
  const index = NODE_DEFINITIONS.findIndex((item) => item.type === nodeType);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function withRegistrationClosed<T extends { nodes?: Array<{ nodeType: string; status: string }> }>(plan: T): T & { registrationClosed: boolean } {
  return {
    ...plan,
    registrationClosed: isRegistrationClosed(plan.nodes || []),
  };
}

export default router;
