import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { decrypt } from '../utils/crypto.js';
import { recordAudit } from '../utils/audit.js';
import {
  defaultRegistrationFieldsFromCandidate,
  mergeRegistrationDefaults,
  normalizeMaterials,
  validateRegistrationGate,
} from '../services/candidateRegistration.js';

const router = Router();

router.use(authenticate);
router.use(requireRoles('SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF'));

/**
 * GET /api/hq/reports/registration-progress — 总部报名资料进度报表
 */
router.get('/reports/registration-progress', async (req, res) => {
  try {
    const plans = await prisma.examPlan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: { id: true, code: true, name: true, type: true },
        },
        nodes: true,
        localUploadBatches: {
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
        candidates: {
          include: {
            registrationProfile: true,
          },
        },
      },
    });

    const rows = plans.map((plan) => {
      const candidateStats = plan.candidates.reduce((stats, candidate) => {
        const fields = mergeRegistrationDefaults(
          parseJson(candidate.registrationProfile?.fieldsJson),
          defaultRegistrationFieldsFromCandidate({
            ...candidate,
            idCard: decrypt(candidate.idCard),
            plan,
          }),
        );
        const materials = normalizeMaterials(parseJson(candidate.registrationProfile?.materialsJson));
        const gate = validateRegistrationGate({
          registrationFields: fields,
          materials,
          candidateStatus: candidate.status,
        });

        return {
          totalCandidates: stats.totalCandidates + 1,
          approvedCandidates: stats.approvedCandidates + (candidate.status === 'APPROVED' ? 1 : 0),
          materialCompleteCandidates: stats.materialCompleteCandidates + (gate.materialComplete ? 1 : 0),
          exportEligibleCandidates: stats.exportEligibleCandidates + (gate.isEligible ? 1 : 0),
        };
      }, {
        totalCandidates: 0,
        approvedCandidates: 0,
        materialCompleteCandidates: 0,
        exportEligibleCandidates: 0,
      });

      const latestUpload = plan.localUploadBatches[0] || null;
      return {
        planId: plan.id,
        planTitle: plan.title,
        tenant: plan.tenant,
        status: plan.status,
        profession: plan.profession,
        level: plan.level,
        examDate: plan.examDate,
        nodes: {
          total: plan.nodes.length,
          completed: plan.nodes.filter((node) => node.status === 'COMPLETED').length,
          overdue: plan.nodes.filter((node) => node.status === 'OVERDUE').length,
        },
        candidates: candidateStats,
        localUpload: latestUpload
          ? {
              status: latestUpload.status,
              uploadedAt: latestUpload.uploadedAt,
              notes: latestUpload.notes,
            }
          : null,
      };
    });

    await recordAudit(req, {
      action: 'HQ_REGISTRATION_PROGRESS_REPORT_VIEW',
      target: 'Report',
      newValue: { count: rows.length },
    });

    success(res, rows);
  } catch (err) {
    console.error('Get HQ registration progress report error:', err);
    error(res, 'INTERNAL_ERROR', '获取总部报名资料进度报表失败', 500);
  }
});

export default router;

function parseJson(value?: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}
