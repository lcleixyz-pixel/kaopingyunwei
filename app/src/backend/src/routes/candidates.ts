// ═══════════════════════════════════════════════════
// 考生路由 — 报名、审核、管理
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import yazl from 'yazl';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { recordAudit } from '../utils/audit.js';
import { canReadAcrossTenants, tenantWhereForRead } from '../services/accessScope.js';
import {
  defaultRegistrationFieldsFromCandidate,
  filterRegistrationProfileForRole,
  formatGateFailure,
  isPaymentVisibleRole,
  mergeRegistrationDefaults,
  normalizeMaterials,
  normalizePaymentStatus,
  normalizeRegistrationFields,
  renderCandidateInfoXls,
  validateRegistrationGate,
} from '../services/candidateRegistration.js';
import { CandidatePhotoError, processCandidatePhoto } from '../services/candidatePhotos.js';
import { canAddCandidateToPlan, isRegistrationClosed, normalizeLevelLabel } from '../services/phase1Rules.js';
import { getRejectedCandidateDisposition } from '../services/prospectiveCandidates.js';
import { createUploadFileFilter, uploadProfiles } from '../utils/uploadValidation.js';
import { respondWithFriendlyError } from '../utils/friendlyErrors.js';
import { createWriteRateLimitMiddleware } from '../services/writeRateLimit.js';

const router = Router();

router.use(authenticate);
const candidatePhotoRateLimit = createWriteRateLimitMiddleware({
  routeKey: 'candidate-photo-upload',
  message: '考生照片上传过于频繁，请稍后再试',
});

const PRIVATE_DATA_DIR = path.resolve(process.cwd(), 'data', 'private');
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: createUploadFileFilter(uploadProfiles.photo, '考生照片'),
});

const candidateSchema = z.object({
  planId: z.string().uuid(),
  name: z.string().optional(),
  idCard: z.string().optional(),
  phone: z.string().optional(),
  gender: z.enum(['M', 'F']).optional(),
  education: z.string().optional(),
  workYears: z.number().int().optional(),
  applyLevel: z.string().optional(),
  registrationFields: z.record(z.string(), z.unknown()).optional(),
  materials: z.record(z.string(), z.boolean()).optional(),
  paymentStatus: z.enum(['UNPAID', 'PAID', '未缴', '已缴']).optional(),
});

const registrationProfileSchema = z.object({
  registrationFields: z.record(z.string(), z.unknown()).optional(),
  materials: z.record(z.string(), z.boolean()).optional(),
  paymentStatus: z.enum(['UNPAID', 'PAID', '未缴', '已缴']).optional(),
});

/**
 * GET /api/candidates — 考生列表
 */
router.get('/', async (req, res) => {
  try {
    const { planId, status, search } = req.query;

    const where: any = tenantWhereForRead(req);

    if (planId) {
      where.planId = planId as string;
    }

    if (status && status !== 'ALL') {
      where.status = status as string;
    } else {
      where.status = { not: 'REJECTED' };
    }

    if (search) {
      where.name = { contains: search as string };
    }

    const candidates = await prisma.candidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          include: {
            tenant: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
        score: {
          select: { totalScore: true, isPass: true },
        },
        registrationProfile: true,
      },
    });

    const canViewSensitive = canReadAcrossTenants(req.userRole)
      || req.userRole === 'BRANCH_ADMIN'
      || req.userRole === 'BRANCH_STAFF';
    const sanitizedCandidates = candidates.map((c: any) => {
      const idCard = decrypt(c.idCard);
      return {
        ...c,
        idCard: canViewSensitive ? idCard : maskIdCard(c.idCard),
        photo: c.photo ? candidatePhotoUrl(c.id) : null,
        phone: canViewSensitive
          ? c.phone
          : c.phone
            ? `${c.phone.slice(0, 3)}****${c.phone.slice(-4)}`
            : null,
        registrationProfile: buildRegistrationProfileResponse({ ...c, idCard }, req.userRole),
      };
    });

    if (canReadAcrossTenants(req.userRole) && sanitizedCandidates.length > 0) {
      await recordAudit(req, {
        action: 'CANDIDATE_SENSITIVE_LIST',
        target: 'Candidate',
        newValue: { count: sanitizedCandidates.length, planId: planId || null },
      });
    }

    success(res, sanitizedCandidates);
  } catch (err) {
    console.error('Get candidates error:', err);
    error(res, 'INTERNAL_ERROR', '获取考生列表失败', 500);
  }
});

/**
 * POST /api/candidates — 添加考生
 */
router.post('/', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF', 'SYS_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const result = candidateSchema.safeParse(req.body);

    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const data = result.data;

    // 验证计划是否属于当前租户
    const plan = await prisma.examPlan.findFirst({
      where: req.userRole === 'SYS_ADMIN' ? { id: data.planId } : { id: data.planId, tenantId },
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

    const registrationClosed = isRegistrationClosed(plan.nodes);
    if (registrationClosed) {
      error(res, 'REGISTRATION_CLOSED', '考试报名阶段已结束，不能继续新增考生', 400);
      return;
    }

    if (!canAddCandidateToPlan(plan.status, registrationClosed)) {
      error(res, 'PLAN_NOT_PUBLISHED', '计划发布后才能录入考生', 400);
      return;
    }

    const incomingFields = normalizeRegistrationFields(data.registrationFields);
    const name = data.name || incomingFields.姓名;
    const idCard = data.idCard || incomingFields.证件号码;
    const gender = data.gender || genderFromTemplate(incomingFields.性别);
    const applyLevel = normalizeLevelLabel(data.applyLevel || levelFromTemplate(incomingFields.认定等级) || plan.level);

    if (!name || !idCard || idCard.length < 15 || idCard.length > 18 || !applyLevel) {
      error(res, 'VALIDATION_ERROR', '姓名、证件号码、申报等级为必填项', 400);
      return;
    }

    // 加密身份证号
    const encryptedIdCard = encrypt(idCard);

    const candidate = await prisma.candidate.create({
      data: {
        tenantId: req.userRole === 'SYS_ADMIN' ? plan.tenantId : tenantId,
        planId: data.planId,
        name,
        idCard: encryptedIdCard,
        phone: data.phone || incomingFields.手机号码 || undefined,
        gender,
        education: data.education || incomingFields.文化程度 || undefined,
        workYears: data.workYears ?? numberFromText(incomingFields.专业年限),
        applyLevel,
        status: 'PENDING',
      },
      include: {
        plan: { include: { tenant: true } },
        registrationProfile: true,
      },
    });

    const defaults = defaultRegistrationFieldsFromCandidate({
      ...candidate,
      idCard,
      plan,
    });
    const registrationFields = mergeRegistrationDefaults(incomingFields, defaults);
    const materials = normalizeMaterials(data.materials);
    materials.photo = false;

    const registrationProfile = await prisma.candidateRegistrationProfile.create({
      data: {
        candidateId: candidate.id,
        fieldsJson: JSON.stringify(registrationFields),
        materialsJson: JSON.stringify(materials),
        paymentStatus: isPaymentVisibleRole(req.userRole) ? normalizePaymentStatus(data.paymentStatus) : 'UNPAID',
      },
    });

    await recordAudit(req, {
      action: 'CANDIDATE_CREATE',
      target: 'Candidate',
      targetId: candidate.id,
      newValue: { ...candidate, idCard: '***' },
    });

    success(res, {
      ...candidate,
      idCard,
      registrationProfile: buildRegistrationProfileResponse({
        ...candidate,
        photo: null,
        idCard,
        registrationProfile,
      }, req.userRole),
    }, 201);
  } catch (err) {
    console.error('Create candidate error:', err);
    error(res, 'INTERNAL_ERROR', '添加考生失败', 500);
  }
});

/**
 * GET /api/candidates/export — 按官方报名表模板导出审核通过考生
 */
router.get('/export', async (req, res) => {
  try {
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;

    if (!planId) {
      error(res, 'VALIDATION_ERROR', '缺少计划ID', 400);
      return;
    }

    const plan = await prisma.examPlan.findFirst({
      where: {
        id: planId,
        ...tenantWhereForRead(req),
      },
      include: {
        tenant: true,
      },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '考评计划不存在', 404);
      return;
    }

    const { exportCandidates } = await buildCandidateExportRows(plan.id, plan.tenantId, req.userRole);

    if (exportCandidates.length === 0) {
      error(res, 'NO_EXPORTABLE_CANDIDATES', '没有符合导出条件的考生：需补全模板必填项、材料齐全并审核通过', 400);
      return;
    }

    const workbook = renderCandidateInfoXls(exportCandidates);
    const fileName = `${plan.title}-考生信息模板.xls`.replace(/[\\/:*?"<>|]/g, '-');

    await recordAudit(req, {
      action: 'CANDIDATE_EXPORT',
      target: 'Candidate',
      targetId: plan.id,
      newValue: {
        planId: plan.id,
        count: exportCandidates.length,
        format: 'xls',
      },
    });

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(workbook);
  } catch (err) {
    console.error('Export candidates error:', err);
    error(res, 'INTERNAL_ERROR', '导出考生报名表失败', 500);
  }
});

/**
 * GET /api/candidates/export-package — 按计划导出报名表和身份证命名照片 ZIP
 */
router.get('/export-package', async (req, res) => {
  try {
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;

    if (!planId) {
      error(res, 'VALIDATION_ERROR', '缺少计划ID', 400);
      return;
    }

    const plan = await prisma.examPlan.findFirst({
      where: {
        id: planId,
        ...tenantWhereForRead(req),
      },
      include: { tenant: true },
    });

    if (!plan) {
      error(res, 'NOT_FOUND', '考评计划不存在', 404);
      return;
    }

    const { rows, exportCandidates, missingPhotoCandidates } = await buildCandidateExportRows(plan.id, plan.tenantId, req.userRole);

    if (missingPhotoCandidates.length > 0) {
      error(res, 'MISSING_CANDIDATE_PHOTOS', `以下考生缺少证件照：${missingPhotoCandidates.map((item) => item.name).join('、')}`, 400, JSON.stringify({
        candidates: missingPhotoCandidates,
      }));
      return;
    }

    if (exportCandidates.length === 0) {
      error(res, 'NO_EXPORTABLE_CANDIDATES', '没有符合导出条件的考生：需补全模板必填项、材料齐全并审核通过', 400);
      return;
    }

    const workbook = renderCandidateInfoXls(exportCandidates);
    const zip = new yazl.ZipFile();
    zip.addBuffer(workbook, `${sanitizeFilename(plan.title)}-考生信息模板.xls`);

    for (const row of rows) {
      if (!row.photoPath) continue;
      zip.addFile(resolvePrivatePath(row.photoPath), `photos/${sanitizeFilename(row.idCard)}.jpg`);
    }

    await recordAudit(req, {
      action: 'CANDIDATE_EXPORT_PACKAGE',
      target: 'Candidate',
      targetId: plan.id,
      newValue: {
        planId: plan.id,
        count: exportCandidates.length,
        format: 'zip',
      },
    });

    const fileName = `${sanitizeFilename(plan.title)}-考生资料包.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    zip.outputStream.on('error', (err) => {
      console.error('Export candidate ZIP stream error:', err);
      if (!res.headersSent) {
        error(res, 'INTERNAL_ERROR', '导出考生资料包失败', 500);
      } else {
        res.destroy(err);
      }
    });
    zip.outputStream.pipe(res);
    zip.end();
  } catch (err) {
    console.error('Export candidate package error:', err);
    error(res, 'INTERNAL_ERROR', '导出考生资料包失败', 500);
  }
});

/**
 * GET /api/candidates/:id/photo — 鉴权预览一寸证件照
 */
router.get('/:id/photo', async (req, res) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: { id: String(req.params.id), ...tenantWhereForRead(req) },
      select: { photo: true },
    });

    if (!candidate?.photo) {
      error(res, 'NOT_FOUND', '证件照不存在', 404);
      return;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.sendFile(resolvePrivatePath(candidate.photo));
  } catch (err) {
    console.error('Get candidate photo error:', err);
    error(res, 'INTERNAL_ERROR', '获取证件照失败', 500);
  }
});

/**
 * POST /api/candidates/:id/photo — 上传或替换指定考生一寸证件照
 */
router.post('/:id/photo', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), candidatePhotoRateLimit, photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      error(res, 'VALIDATION_ERROR', '请选择要上传的证件照', 400);
      return;
    }

    const candidate = await prisma.candidate.findFirst({
      where: req.userRole === 'SYS_ADMIN' ? { id: String(req.params.id) } : { id: String(req.params.id), tenantId: req.tenantId! },
      include: {
        plan: { include: { tenant: true } },
        registrationProfile: true,
      },
    });

    if (!candidate) {
      error(res, 'NOT_FOUND', '考生不存在', 404);
      return;
    }

    const processed = await processCandidatePhoto(req.file.buffer);
    const relativePath = candidatePhotoRelativePath(candidate.tenantId, candidate.id);
    const outputPath = resolvePrivatePath(relativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, processed.buffer);

    const updated = await prisma.candidate.update({
      where: { id: candidate.id },
      data: { photo: relativePath },
      include: {
        plan: { include: { tenant: true } },
        registrationProfile: true,
      },
    });

    await recordAudit(req, {
      action: 'CANDIDATE_PHOTO_UPLOAD',
      target: 'Candidate',
      targetId: candidate.id,
      oldValue: { photo: candidate.photo ? 'uploaded' : null },
      newValue: { photo: 'uploaded', size: processed.size, width: processed.width, height: processed.height },
    });

    success(res, {
      candidate: sanitizeCandidateForResponse(updated, req.userRole),
      photo: {
        url: `/api/candidates/${updated.id}/photo`,
        size: processed.size,
        width: processed.width,
        height: processed.height,
      },
    });
  } catch (err) {
    if (err instanceof CandidatePhotoError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    respondWithFriendlyError(res, err, '上传证件照失败');
  }
});

/**
 * DELETE /api/candidates/:id/photo — 删除指定考生证件照
 */
router.delete('/:id/photo', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: req.userRole === 'SYS_ADMIN' ? { id: String(req.params.id) } : { id: String(req.params.id), tenantId: req.tenantId! },
      include: {
        plan: { include: { tenant: true } },
        registrationProfile: true,
      },
    });

    if (!candidate) {
      error(res, 'NOT_FOUND', '考生不存在', 404);
      return;
    }

    await removePrivateFileIfSafe(candidate.photo);

    const updated = await prisma.candidate.update({
      where: { id: candidate.id },
      data: { photo: null },
      include: {
        plan: { include: { tenant: true } },
        registrationProfile: true,
      },
    });

    await recordAudit(req, {
      action: 'CANDIDATE_PHOTO_DELETE',
      target: 'Candidate',
      targetId: candidate.id,
      oldValue: { photo: candidate.photo ? 'uploaded' : null },
      newValue: { photo: null },
    });

    success(res, sanitizeCandidateForResponse(updated, req.userRole));
  } catch (err) {
    console.error('Delete candidate photo error:', err);
    error(res, 'INTERNAL_ERROR', '删除证件照失败', 500);
  }
});

/**
 * GET /api/candidates/:id/registration-profile — 读取报名模板资料
 */
router.get('/:id/registration-profile', async (req, res) => {
  try {
    const id = String(req.params.id);
    const candidate = await prisma.candidate.findFirst({
      where: { id, ...tenantWhereForRead(req) },
      include: {
        plan: { include: { tenant: true } },
        registrationProfile: true,
      },
    });

    if (!candidate) {
      error(res, 'NOT_FOUND', '考生不存在', 404);
      return;
    }

    success(res, buildRegistrationProfileResponse({
      ...candidate,
      idCard: decrypt(candidate.idCard),
    }, req.userRole));
  } catch (err) {
    console.error('Get registration profile error:', err);
    error(res, 'INTERNAL_ERROR', '获取报名资料失败', 500);
  }
});

/**
 * PUT /api/candidates/:id/registration-profile — 保存报名模板资料与材料清单
 */
router.put('/:id/registration-profile', requireRoles('SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const result = registrationProfileSchema.safeParse(req.body);

    if (!result.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, result.error.message);
      return;
    }

    const candidate = await prisma.candidate.findFirst({
      where: req.userRole === 'SYS_ADMIN' ? { id } : { id, tenantId },
      include: {
        plan: { include: { tenant: true } },
        registrationProfile: true,
      },
    });

    if (!candidate) {
      error(res, 'NOT_FOUND', '考生不存在', 404);
      return;
    }

    const idCard = decrypt(candidate.idCard);
    const oldProfile = buildRegistrationProfileResponse({ ...candidate, idCard }, req.userRole);
    const defaults = defaultRegistrationFieldsFromCandidate({ ...candidate, idCard, plan: candidate.plan });
    const registrationFields = mergeRegistrationDefaults(
      result.data.registrationFields || oldProfile.registrationFields,
      defaults,
    );
    const materials = normalizeMaterials(result.data.materials || oldProfile.materials);
    materials.photo = Boolean(candidate.photo);
    const profile = await prisma.candidateRegistrationProfile.upsert({
      where: { candidateId: id },
      update: {
        fieldsJson: JSON.stringify(registrationFields),
        materialsJson: JSON.stringify(materials),
        ...(isPaymentVisibleRole(req.userRole) && result.data.paymentStatus
          ? { paymentStatus: normalizePaymentStatus(result.data.paymentStatus) }
          : {}),
      },
      create: {
        candidateId: id,
        fieldsJson: JSON.stringify(registrationFields),
        materialsJson: JSON.stringify(materials),
        paymentStatus: isPaymentVisibleRole(req.userRole) ? normalizePaymentStatus(result.data.paymentStatus) : 'UNPAID',
      },
    });

    await recordAudit(req, {
      action: 'CANDIDATE_REGISTRATION_PROFILE_UPDATE',
      target: 'CandidateRegistrationProfile',
      targetId: profile.id,
      oldValue: { candidateId: id, completeness: oldProfile.completeness },
      newValue: {
        candidateId: id,
        completeness: validateRegistrationGate({
          registrationFields,
          materials,
          candidateStatus: candidate.status,
          photoUploaded: Boolean(candidate.photo),
        }),
      },
    });

    success(res, buildRegistrationProfileResponse({
      ...candidate,
      idCard,
      registrationProfile: profile,
    }, req.userRole));
  } catch (err) {
    console.error('Save registration profile error:', err);
    error(res, 'INTERNAL_ERROR', '保存报名资料失败', 500);
  }
});

/**
 * POST /api/candidates/:id/approve — 审核考生
 */
router.post('/:id/approve', requireRoles('BRANCH_ADMIN'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.tenantId!;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      error(res, 'VALIDATION_ERROR', '审核状态无效', 400);
      return;
    }

    const oldCandidate = await prisma.candidate.findFirst({
      where: { id, tenantId },
      include: {
        plan: { include: { tenant: true } },
        registrationProfile: true,
        prospectiveSource: true,
      },
    });

    if (!oldCandidate) {
      error(res, 'NOT_FOUND', '考生不存在', 404);
      return;
    }

    if (status === 'APPROVED') {
      const idCard = decrypt(oldCandidate.idCard);
      const profile = buildRegistrationProfileResponse({ ...oldCandidate, idCard }, req.userRole);
      const gate = validateRegistrationGate({
        registrationFields: profile.registrationFields,
        materials: profile.materials,
        requireApproved: false,
        photoUploaded: Boolean(oldCandidate.photo),
      });

      if (!gate.isEligible) {
        error(res, 'REGISTRATION_PROFILE_INCOMPLETE', '报名资料未满足审核通过条件', 400, formatGateFailure(gate));
        return;
      }
    }

    if (status === 'APPROVED') {
      const candidate = await prisma.candidate.update({
        where: { id },
        data: { status },
      });

      await prisma.candidateRegistrationProfile.updateMany({
        where: { candidateId: id },
        data: {
          reviewedBy: req.userId,
          reviewedAt: new Date(),
        },
      });

      await recordAudit(req, {
        action: 'CANDIDATE_APPROVE',
        target: 'Candidate',
        targetId: id,
        oldValue: { ...oldCandidate, idCard: '***' },
        newValue: { ...candidate, idCard: '***' },
      });

      success(res, { message: '考生已审核通过' });
      return;
    }

    const rejectResult = await prisma.$transaction(async (tx) => {
      const disposition = getRejectedCandidateDisposition({
        hasProspectiveSource: Boolean(oldCandidate.prospectiveSource),
      });

      if (oldCandidate.prospectiveSource) {
        const prospectiveCandidate = await tx.prospectiveCandidate.update({
          where: { id: oldCandidate.prospectiveSource.id },
          data: {
            status: 'FOLLOWING',
            convertedCandidateId: null,
            notes: appendCandidateNote(oldCandidate.prospectiveSource.notes, `审核驳回：${oldCandidate.plan.title}`),
          },
        });

        await tx.candidate.delete({ where: { id } });
        return { disposition, prospectiveCandidateId: prospectiveCandidate.id };
      }

      const phone = oldCandidate.phone || '未留存';
      const existingProspective = await tx.prospectiveCandidate.findFirst({
        where: {
          tenantId,
          name: oldCandidate.name,
          phone,
          convertedCandidateId: null,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (existingProspective) {
        const prospectiveCandidate = await tx.prospectiveCandidate.update({
          where: { id: existingProspective.id },
          data: {
            status: 'FOLLOWING',
            intendedOccupation: existingProspective.intendedOccupation || oldCandidate.plan.occupation,
            intendedProfession: existingProspective.intendedProfession || oldCandidate.plan.profession,
            intendedLevel: existingProspective.intendedLevel || oldCandidate.plan.level,
            notes: appendCandidateNote(existingProspective.notes, `审核驳回：${oldCandidate.plan.title}`),
          },
        });

        await tx.candidate.delete({ where: { id } });
        return { disposition, prospectiveCandidateId: prospectiveCandidate.id };
      }

      const prospectiveCandidate = await tx.prospectiveCandidate.create({
        data: {
          tenantId,
          name: oldCandidate.name,
          phone,
          intendedOccupation: oldCandidate.plan.occupation,
          intendedProfession: oldCandidate.plan.profession,
          intendedLevel: oldCandidate.plan.level,
          source: '审核驳回',
          status: 'FOLLOWING',
          notes: `由计划「${oldCandidate.plan.title}」审核驳回生成`,
        },
      });

      await tx.candidate.delete({ where: { id } });
      return { disposition, prospectiveCandidateId: prospectiveCandidate.id };
    });

    await recordAudit(req, {
      action: 'CANDIDATE_REJECT',
      target: 'Candidate',
      targetId: id,
      oldValue: { ...oldCandidate, idCard: '***' },
      newValue: {
        status: 'REJECTED',
        formalCandidateRemoved: true,
        prospectiveCandidateId: rejectResult.prospectiveCandidateId,
        disposition: rejectResult.disposition,
      },
    });

    success(res, { message: '考生已审核驳回，并转回意向考生跟进中' });
  } catch (err) {
    console.error('Approve candidate error:', err);
    error(res, 'INTERNAL_ERROR', '审核失败', 500);
  }
});

export default router;

function appendCandidateNote(existing: string | null | undefined, note: string): string {
  return [existing?.trim(), note.trim()].filter(Boolean).join('\n');
}

function maskIdCard(value: string): string {
  const idCard = decrypt(value);
  return idCard.length > 8 ? `${idCard.slice(0, 4)}****${idCard.slice(-4)}` : idCard;
}

function candidatePhotoUrl(candidateId: string): string {
  return `/api/candidates/${encodeURIComponent(candidateId)}/photo`;
}

function candidatePhotoRelativePath(tenantId: string, candidateId: string): string {
  return path.posix.join('candidate-photos', sanitizePathSegment(tenantId), `${sanitizePathSegment(candidateId)}.jpg`);
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown';
}

function resolvePrivatePath(relativePath: string): string {
  const resolved = path.resolve(PRIVATE_DATA_DIR, relativePath);
  if (!resolved.startsWith(`${PRIVATE_DATA_DIR}${path.sep}`)) {
    throw new Error('Invalid private file path');
  }
  return resolved;
}

async function privateFileExists(relativePath?: string | null): Promise<boolean> {
  if (!relativePath) return false;
  try {
    await fs.access(resolvePrivatePath(relativePath));
    return true;
  } catch {
    return false;
  }
}

async function removePrivateFileIfSafe(relativePath?: string | null): Promise<void> {
  if (!relativePath) return;
  try {
    await fs.rm(resolvePrivatePath(relativePath), { force: true });
  } catch {
    // Legacy or malformed paths should not block clearing the database pointer.
  }
}

function sanitizeCandidateForResponse(candidate: any, role?: string) {
  const canViewSensitive = canReadAcrossTenants(role)
    || role === 'BRANCH_ADMIN'
    || role === 'BRANCH_STAFF';
  const idCard = decrypt(candidate.idCard);
  return {
    ...candidate,
    idCard: canViewSensitive ? idCard : idCard.length > 8 ? `${idCard.slice(0, 4)}****${idCard.slice(-4)}` : idCard,
    photo: candidate.photo ? candidatePhotoUrl(candidate.id) : null,
    registrationProfile: buildRegistrationProfileResponse({ ...candidate, idCard }, role),
  };
}

async function buildCandidateExportRows(planId: string, tenantId: string, role?: string) {
  const candidates = await prisma.candidate.findMany({
    where: {
      planId,
      tenantId,
      status: 'APPROVED',
    },
    orderBy: { createdAt: 'asc' },
    include: {
      plan: {
        include: { tenant: true },
      },
      registrationProfile: true,
    },
  });

  const rows: Array<{ id: string; name: string; idCard: string; photoPath: string; registrationFields: Record<string, string> }> = [];
  const exportCandidates: Array<{ registrationFields: Record<string, string> }> = [];
  const missingPhotoCandidates: Array<{ id: string; name: string; idCard: string }> = [];

  for (const candidate of candidates) {
    const idCard = decrypt(candidate.idCard);
    const profile = buildRegistrationProfileResponse({ ...candidate, idCard }, role);
    const wouldBeEligibleWithPhoto = validateRegistrationGate({
      registrationFields: profile.registrationFields,
      materials: profile.materials,
      candidateStatus: candidate.status,
      photoUploaded: true,
    });
    const hasPhotoFile = await privateFileExists(candidate.photo);
    if (wouldBeEligibleWithPhoto.isEligible && !hasPhotoFile) {
      missingPhotoCandidates.push({ id: candidate.id, name: candidate.name, idCard });
      continue;
    }

    const gate = validateRegistrationGate({
      registrationFields: profile.registrationFields,
      materials: profile.materials,
      candidateStatus: candidate.status,
      photoUploaded: hasPhotoFile,
    });
    if (!gate.isEligible || !candidate.photo) continue;

    rows.push({
      id: candidate.id,
      name: candidate.name,
      idCard,
      photoPath: candidate.photo,
      registrationFields: profile.registrationFields,
    });
    exportCandidates.push({ registrationFields: profile.registrationFields });
  }

  return { rows, exportCandidates, missingPhotoCandidates };
}

function sanitizeFilename(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ') || '未命名';
}

function buildRegistrationProfileResponse(candidate: any, role?: string) {
  const defaults = defaultRegistrationFieldsFromCandidate(candidate);
  const profile = candidate.registrationProfile;
  const registrationFields = mergeRegistrationDefaults(parseJson(profile?.fieldsJson), defaults);
  const materials = normalizeMaterials(parseJson(profile?.materialsJson));
  materials.photo = Boolean(candidate.photo);
  const completeness = validateRegistrationGate({
    registrationFields,
    materials,
    candidateStatus: candidate.status,
    photoUploaded: Boolean(candidate.photo),
  });

  return filterRegistrationProfileForRole({
    id: profile?.id,
    registrationFields,
    materials,
    paymentStatus: (profile?.paymentStatus || 'UNPAID') as 'UNPAID' | 'PAID',
    completeness,
  }, role);
}

function parseJson(value?: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function genderFromTemplate(value?: string): 'M' | 'F' {
  return value === '女' ? 'F' : 'M';
}

function levelFromTemplate(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes('一级')) return '一级/高级技师';
  if (value.includes('二级')) return '二级/技师';
  if (value.includes('三级')) return '三级/高级工';
  if (value.includes('四级')) return '四级/中级工';
  if (value.includes('五级')) return '五级/初级工';
  const match = value.match(/[1-5]/);
  return match?.[0];
}

function numberFromText(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
