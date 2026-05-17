// ═══════════════════════════════════════════════════
// 意向考生路由 — 分支内部线索管理
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { respondWithFriendlyError } from '../utils/friendlyErrors.js';
import { encrypt } from '../utils/crypto.js';
import { recordAudit } from '../utils/audit.js';
import {
  defaultRegistrationFieldsFromCandidate,
  filterRegistrationProfileForRole,
  normalizeMaterials,
  validateRegistrationGate,
} from '../services/candidateRegistration.js';
import { isRegistrationClosed, normalizeLevelLabel } from '../services/phase1Rules.js';
import { canConvertToFormalCandidate } from '../services/prospectiveCandidates.js';

const router = Router();

router.use(authenticate);
router.use(requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'));

const prospectiveCandidateSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空'),
  phone: z.string().trim().min(1, '手机号码不能为空'),
  intendedOccupation: z.string().trim().optional(),
  intendedProfession: z.string().trim().optional(),
  intendedLevel: z.string().trim().optional(),
  source: z.string().trim().optional(),
  status: z.enum(['FOLLOWING', 'CONVERTED', 'NOT_INTERESTED']).optional(),
  notes: z.string().trim().optional(),
});

const prospectiveCandidateUpdateSchema = prospectiveCandidateSchema.partial();

const convertSchema = z.object({
  planId: z.string().uuid(),
  idCard: z.string().trim().min(15, '证件号码至少15位').max(18, '证件号码最多18位'),
  gender: z.enum(['M', 'F']),
  education: z.string().trim().optional(),
  workYears: z.number().int().min(0).optional(),
});

router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { search, status } = req.query;
    const where: any = { tenantId };

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { phone: { contains: search as string } },
      ];
    }

    const candidates = await prisma.prospectiveCandidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: convertedCandidateInclude(),
    });

    success(res, candidates);
  } catch (err) {
    respondWithFriendlyError(res, err, '获取意向考生失败');
  }
});

router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const result = prospectiveCandidateSchema.safeParse(req.body);

    if (!result.success) {
      respondWithFriendlyError(res, result.error, '请求参数错误');
      return;
    }

    const candidate = await prisma.prospectiveCandidate.create({
      data: {
        tenantId,
        ...result.data,
        intendedLevel: result.data.intendedLevel ? normalizeLevelLabel(result.data.intendedLevel) : undefined,
        status: result.data.status || 'FOLLOWING',
      },
      include: convertedCandidateInclude(),
    });

    await recordAudit(req, {
      action: 'PROSPECTIVE_CANDIDATE_CREATE',
      target: 'ProspectiveCandidate',
      targetId: candidate.id,
      newValue: candidate,
    });

    success(res, candidate, 201);
  } catch (err) {
    respondWithFriendlyError(res, err, '新增意向考生失败');
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const result = prospectiveCandidateUpdateSchema.safeParse(req.body);

    if (!result.success) {
      respondWithFriendlyError(res, result.error, '请求参数错误');
      return;
    }

    const oldCandidate = await prisma.prospectiveCandidate.findFirst({ where: { id, tenantId } });
    if (!oldCandidate) {
      error(res, 'NOT_FOUND', '意向考生不存在', 404);
      return;
    }

    const candidate = await prisma.prospectiveCandidate.update({
      where: { id },
      data: {
        ...result.data,
        ...(result.data.intendedLevel !== undefined ? { intendedLevel: normalizeLevelLabel(result.data.intendedLevel) } : {}),
      },
      include: convertedCandidateInclude(),
    });

    await recordAudit(req, {
      action: 'PROSPECTIVE_CANDIDATE_UPDATE',
      target: 'ProspectiveCandidate',
      targetId: id,
      oldValue: oldCandidate,
      newValue: candidate,
    });

    success(res, candidate);
  } catch (err) {
    respondWithFriendlyError(res, err, '保存意向考生失败');
  }
});

router.delete('/:id', requireRoles('BRANCH_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const oldCandidate = await prisma.prospectiveCandidate.findFirst({ where: { id, tenantId } });

    if (!oldCandidate) {
      error(res, 'NOT_FOUND', '意向考生不存在', 404);
      return;
    }

    await prisma.prospectiveCandidate.delete({ where: { id } });

    await recordAudit(req, {
      action: 'PROSPECTIVE_CANDIDATE_DELETE',
      target: 'ProspectiveCandidate',
      targetId: id,
      oldValue: oldCandidate,
    });

    success(res, { message: '意向考生已删除' });
  } catch (err) {
    respondWithFriendlyError(res, err, '删除意向考生失败');
  }
});

router.post('/:id/convert', async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const result = convertSchema.safeParse(req.body);

    if (!result.success) {
      respondWithFriendlyError(res, result.error, '请求参数错误');
      return;
    }

    const prospectiveCandidate = await prisma.prospectiveCandidate.findFirst({
      where: { id, tenantId },
    });

    if (!prospectiveCandidate) {
      error(res, 'NOT_FOUND', '意向考生不存在', 404);
      return;
    }

    if (prospectiveCandidate.convertedCandidateId) {
      error(res, 'ALREADY_CONVERTED', '该意向考生已转为正式考生', 400);
      return;
    }

    const plan = await prisma.examPlan.findFirst({
      where: { id: result.data.planId, tenantId },
      include: {
        tenant: true,
        nodes: {
          where: { nodeType: 'REGISTRATION' },
        },
      },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '考评计划不存在', 404);
      return;
    }

    if (!canConvertToFormalCandidate({
      prospectiveTenantId: prospectiveCandidate.tenantId,
      planTenantId: plan.tenantId,
      planStatus: plan.status,
      registrationClosed: isRegistrationClosed(plan.nodes),
    })) {
      const message = isRegistrationClosed(plan.nodes)
        ? '考试报名阶段已结束，不能继续转入正式考生'
        : '只能转入本机构已发布的考评计划';
      error(res, isRegistrationClosed(plan.nodes) ? 'REGISTRATION_CLOSED' : 'INVALID_PLAN', message, 400);
      return;
    }

    const idCard = result.data.idCard;
    const encryptedIdCard = encrypt(idCard);
    const materials = normalizeMaterials();
    const converted = await prisma.$transaction(async (tx) => {
      const formalCandidate = await tx.candidate.create({
        data: {
          tenantId,
          planId: plan.id,
          name: prospectiveCandidate.name,
          idCard: encryptedIdCard,
          phone: prospectiveCandidate.phone,
          gender: result.data.gender,
          education: result.data.education || undefined,
          workYears: result.data.workYears,
          applyLevel: plan.level,
          status: 'PENDING',
        },
        include: {
          plan: { include: { tenant: true } },
          registrationProfile: true,
        },
      });

      const registrationFields = defaultRegistrationFieldsFromCandidate({
        ...formalCandidate,
        idCard,
        plan,
      });

      const registrationProfile = await tx.candidateRegistrationProfile.create({
        data: {
          candidateId: formalCandidate.id,
          fieldsJson: JSON.stringify(registrationFields),
          materialsJson: JSON.stringify(materials),
          paymentStatus: 'UNPAID',
        },
      });

      const updatedProspective = await tx.prospectiveCandidate.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedCandidateId: formalCandidate.id,
        },
        include: convertedCandidateInclude(),
      });

      return {
        prospectiveCandidate: updatedProspective,
        candidate: {
          ...formalCandidate,
          idCard,
          registrationProfile,
        },
        registrationFields,
      };
    });

    await recordAudit(req, {
      action: 'PROSPECTIVE_CANDIDATE_CONVERT',
      target: 'ProspectiveCandidate',
      targetId: id,
      oldValue: prospectiveCandidate,
      newValue: {
        prospectiveCandidateId: id,
        candidateId: converted.candidate.id,
        planId: plan.id,
      },
    });

    success(res, {
      prospectiveCandidate: converted.prospectiveCandidate,
      candidate: {
        ...converted.candidate,
        registrationProfile: filterRegistrationProfileForRole({
          id: converted.candidate.registrationProfile.id,
          registrationFields: converted.registrationFields,
          materials,
          paymentStatus: 'UNPAID',
          completeness: validateRegistrationGate({
            registrationFields: converted.registrationFields,
            materials,
            candidateStatus: converted.candidate.status,
          }),
        }, req.userRole),
      },
    }, 201);
  } catch (err) {
    respondWithFriendlyError(res, err, '转为正式考生失败');
  }
});

export default router;

function convertedCandidateInclude() {
  return {
    convertedCandidate: {
      select: {
        id: true,
        name: true,
        planId: true,
        plan: {
          select: {
            id: true,
            title: true,
            occupation: true,
            profession: true,
            level: true,
          },
        },
      },
    },
  } as const;
}
