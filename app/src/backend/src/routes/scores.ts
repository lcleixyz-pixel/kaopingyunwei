// ═══════════════════════════════════════════════════
// 成绩路由 — 按考试计划进行成绩检录
// ═══════════════════════════════════════════════════

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { recordAudit } from '../utils/audit.js';
import { decrypt } from '../utils/crypto.js';
import { canReadAcrossTenants, planTenantWhereForRead, tenantWhereForRead } from '../services/accessScope.js';
import {
  evaluateScoreRecord,
  getRequiredScoreSubjects,
  isScoreCompleteForLevel,
  type ImportedScoreRow,
  type ScoreEvaluationInput,
  type ScoreSource,
} from '../services/scoreRules.js';

const router = Router();

router.use(authenticate);

const SCORE_PARTICIPANT_STATUSES = ['APPROVED', 'PASSED', 'FAILED'] as const;
const NODE_ORDER = [
  'PLAN_CREATE',
  'REGISTRATION',
  'ROOM_ARRANGE',
  'EXAM_PREPARE',
  'EXAM_DAY',
  'SCORE_RECORD',
  'SCORE_PUBLISH',
  'CERT_MANAGE',
  'COMPLETE',
] as const;

const scoreRecordSchema = z.object({
  candidateId: z.string().min(1),
  theoryScore: z.number().min(0).max(100).nullable().optional(),
  practiceScore: z.number().min(0).max(100).nullable().optional(),
  comprehensiveScore: z.number().min(0).max(100).nullable().optional(),
  workPerformanceScore: z.number().min(0).max(100).nullable().optional(),
  theoryAbsent: z.boolean().optional(),
  practiceAbsent: z.boolean().optional(),
  comprehensiveAbsent: z.boolean().optional(),
  workPerformanceAbsent: z.boolean().optional(),
});

const batchScoreSchema = z.object({
  planId: z.string().uuid(),
  records: z.array(scoreRecordSchema).min(1),
});

const importedScoreRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  ticketNo: z.string().optional().default(''),
  name: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  idCard: z.string().min(1),
  organization: z.string().optional().default(''),
  profession: z.string().optional().default(''),
  level: z.string().min(1),
  theoryScore: z.number().min(0).max(100).nullable().optional(),
  practiceScore: z.number().min(0).max(100).nullable().optional(),
  comprehensiveScore: z.number().min(0).max(100).nullable().optional(),
  workPerformanceScore: z.number().min(0).max(100).nullable().optional(),
  theoryAbsent: z.boolean().optional().default(false),
  practiceAbsent: z.boolean().optional().default(false),
  comprehensiveAbsent: z.boolean().optional().default(false),
  workPerformanceAbsent: z.boolean().optional().default(false),
});

const importSchema = z.object({
  planId: z.string().uuid(),
  fileName: z.string().optional(),
  rows: z.array(importedScoreRowSchema).min(1),
});

router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.examPlan.findMany({
      where: {
        ...planTenantWhereForRead(req),
        status: 'PUBLISHED',
        nodes: {
          some: {
            nodeType: 'SCORE_RECORD',
            status: 'IN_PROGRESS',
          },
        },
      },
      orderBy: { examDate: 'asc' },
      include: {
        tenant: { select: { id: true, code: true, name: true, type: true } },
        nodes: { where: { nodeType: 'SCORE_RECORD' } },
        _count: { select: { candidates: true } },
      },
    });

    success(res, plans.map((plan) => ({
      ...plan,
      scoreRecordNodeId: plan.nodes[0]?.id,
      scoreRecordNodeStatus: plan.nodes[0]?.status,
    })));
  } catch (err) {
    console.error('Get score plans error:', err);
    error(res, 'INTERNAL_ERROR', '获取成绩检录计划失败', 500);
  }
});

router.get('/', async (req, res) => {
  try {
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;
    if (planId) {
      const plan = await prisma.examPlan.findFirst({
        where: { id: planId, ...planTenantWhereForRead(req) },
        include: {
          tenant: { select: { id: true, code: true, name: true, type: true } },
          nodes: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!plan) {
        error(res, 'NOT_FOUND', '考试计划不存在', 404);
        return;
      }

      const candidates = await getScoreParticipants(planId, req);
      success(res, {
        plan,
        candidates: candidates.map(toScoreCandidateRow),
        summary: buildPlanScoreSummary(candidates),
      });
      return;
    }

    const scores = await prisma.score.findMany({
      where: { candidate: tenantWhereForRead(req) },
      orderBy: { updatedAt: 'desc' },
      include: {
        candidate: {
          include: {
            plan: {
              include: { tenant: { select: { id: true, code: true, name: true, type: true } } },
            },
          },
        },
      },
    });

    success(res, scores);
  } catch (err) {
    console.error('Get scores error:', err);
    error(res, 'INTERNAL_ERROR', '获取成绩列表失败', 500);
  }
});

router.post('/import/preview', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, parsed.error.message);
      return;
    }

    const plan = await ensureWritableScorePlan(parsed.data.planId, req);
    if (!plan.ok) {
      error(res, plan.code, plan.message, plan.status);
      return;
    }

    const candidates = await getScoreParticipants(parsed.data.planId, req);
    success(res, buildImportPreview(parsed.data.rows, candidates));
  } catch (err) {
    console.error('Preview score import error:', err);
    error(res, 'INTERNAL_ERROR', '预览成绩导入失败', 500);
  }
});

router.post('/import/commit', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, parsed.error.message);
      return;
    }

    const plan = await ensureWritableScorePlan(parsed.data.planId, req);
    if (!plan.ok) {
      error(res, plan.code, plan.message, plan.status);
      return;
    }

    const candidates = await getScoreParticipants(parsed.data.planId, req);
    const preview = buildImportPreview(parsed.data.rows, candidates);
    const writableRows = preview.rows.filter((row) => row.matched && row.candidate);
    if (writableRows.length === 0) {
      error(res, 'NO_MATCHED_ROWS', '没有可写入的匹配成绩行', 400);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const written = [];
      for (const row of writableRows) {
        const score = await upsertScore(tx, {
          candidate: row.candidate!,
          input: row.importRow,
          userId: req.userId,
          source: 'IMPORT',
          sourceFileName: parsed.data.fileName,
        });
        written.push(score);
      }
      return written;
    });

    await recordAudit(req, {
      action: 'SCORE_IMPORT_COMMIT',
      target: 'Score',
      targetId: parsed.data.planId,
      newValue: {
        planId: parsed.data.planId,
        fileName: parsed.data.fileName || null,
        written: result.length,
        skipped: preview.summary.total - result.length,
        summary: preview.summary,
      },
    });

    success(res, {
      writtenCount: result.length,
      preview,
    }, 201);
  } catch (err) {
    console.error('Commit score import error:', err);
    error(res, 'INTERNAL_ERROR', '确认导入成绩失败', 500);
  }
});

router.post('/batch', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const parsed = batchScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      error(res, 'VALIDATION_ERROR', '请求参数错误', 400, parsed.error.message);
      return;
    }

    const plan = await ensureWritableScorePlan(parsed.data.planId, req);
    if (!plan.ok) {
      error(res, plan.code, plan.message, plan.status);
      return;
    }

    const candidates = await getScoreParticipants(parsed.data.planId, req);
    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const invalidCandidate = parsed.data.records.find((record) => !candidateById.has(record.candidateId));
    if (invalidCandidate) {
      error(res, 'INVALID_CANDIDATE', '只能录入所选计划下已审核通过考生的成绩', 400);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const written = [];
      for (const record of parsed.data.records) {
        const candidate = candidateById.get(record.candidateId)!;
        const score = await upsertScore(tx, {
          candidate,
          input: { ...record, level: candidate.applyLevel },
          userId: req.userId,
          source: 'MANUAL',
        });
        written.push(score);
      }
      return written;
    });

    await recordAudit(req, {
      action: 'SCORE_BATCH_UPSERT',
      target: 'Score',
      targetId: parsed.data.planId,
      newValue: { planId: parsed.data.planId, count: result.length },
    });

    success(res, { writtenCount: result.length }, 201);
  } catch (err) {
    console.error('Batch score upsert error:', err);
    error(res, 'INTERNAL_ERROR', '保存成绩失败', 500);
  }
});

router.post('/plans/:planId/complete', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const planId = String(req.params.planId);
    const plan = await ensureWritableScorePlan(planId, req);
    if (!plan.ok) {
      error(res, plan.code, plan.message, plan.status);
      return;
    }

    const candidates = await getScoreParticipants(planId, req);
    if (candidates.length === 0) {
      error(res, 'NO_SCORE_PARTICIPANTS', '该计划没有审核通过考生，无法完成成绩检录', 400);
      return;
    }

    const incomplete = candidates.filter((candidate) => !candidate.score || !isScoreCompleteForLevel(scoreInputFromCandidate(candidate)));
    if (incomplete.length > 0) {
      error(res, 'SCORE_RECORD_INCOMPLETE', `还有 ${incomplete.length} 名考生未完成成绩检录`, 400);
      return;
    }

    const scoreNode = plan.value.nodes.find((node: any) => node.nodeType === 'SCORE_RECORD');
    if (!scoreNode) {
      error(res, 'SCORE_NODE_MISSING', '未找到成绩检录节点', 400);
      return;
    }

    const writeResult = await prisma.$transaction(async (tx) => {
      const completedNode = await tx.examNode.update({
        where: { id: scoreNode.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes: appendNodeNote(scoreNode.notes, '成绩已检录完毕'),
        },
      });

      const nextNode = plan.value.nodes
        .filter((node: any) => node.status === 'PENDING' && getNodeOrderIndex(node.nodeType) > getNodeOrderIndex('SCORE_RECORD'))
        .sort((a: any, b: any) => getNodeOrderIndex(a.nodeType) - getNodeOrderIndex(b.nodeType))[0];

      const activatedNextNode = nextNode
        ? await tx.examNode.update({
          where: { id: nextNode.id },
          data: { status: 'IN_PROGRESS' },
        })
        : null;

      return { completedNode, activatedNextNode };
    });

    await recordAudit(req, {
      action: 'EXAM_NODE_COMPLETE',
      target: 'ExamNode',
      targetId: writeResult.completedNode.id,
      examNodeId: writeResult.completedNode.id,
      newValue: {
        planId,
        nodeType: 'SCORE_RECORD',
        source: 'SCORE_RECORDING',
        activatedNextNodeId: writeResult.activatedNextNode?.id || null,
      },
    });

    success(res, writeResult.completedNode);
  } catch (err) {
    console.error('Complete score node error:', err);
    error(res, 'INTERNAL_ERROR', '完成成绩检录失败', 500);
  }
});

router.patch('/:id/verify', requireRoles('BRANCH_ADMIN', 'BRANCH_STAFF'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const oldScore = await prisma.score.findFirst({
      where: { id, candidate: tenantWhereForRead(req) },
    });

    if (!oldScore) {
      error(res, 'NOT_FOUND', '成绩不存在', 404);
      return;
    }

    const score = await prisma.score.update({
      where: { id },
      data: {
        verifiedBy: req.userId,
        verifiedAt: new Date(),
      },
      include: scoreInclude(),
    });

    await recordAudit(req, {
      action: 'SCORE_VERIFY',
      target: 'Score',
      targetId: score.id,
      oldValue: oldScore,
      newValue: score,
    });

    success(res, score);
  } catch (err) {
    console.error('Verify score error:', err);
    error(res, 'INTERNAL_ERROR', '复核成绩失败', 500);
  }
});

async function getScoreParticipants(planId: string, req: any) {
  return prisma.candidate.findMany({
    where: {
      planId,
      ...tenantWhereForRead(req),
      status: { in: [...SCORE_PARTICIPANT_STATUSES] as any },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      plan: {
        include: { tenant: { select: { id: true, code: true, name: true, type: true } } },
      },
      score: true,
    },
  });
}

function toScoreCandidateRow(candidate: any) {
  const input = scoreInputFromCandidate(candidate);
  const evaluation = evaluateScoreRecord(input);
  return {
    candidate: {
      ...candidate,
      idCard: decrypt(candidate.idCard),
    },
    score: candidate.score,
    requiredSubjects: getRequiredScoreSubjects(candidate.applyLevel),
    isComplete: Boolean(candidate.score) && isScoreCompleteForLevel(input),
    resultStatus: candidate.score?.resultStatus || evaluation.resultStatus,
  };
}

function buildPlanScoreSummary(candidates: any[]) {
  const rows = candidates.map(toScoreCandidateRow);
  return {
    total: rows.length,
    complete: rows.filter((row) => row.isComplete).length,
    incomplete: rows.filter((row) => !row.isComplete).length,
    pass: rows.filter((row) => row.resultStatus === 'PASS').length,
    fail: rows.filter((row) => row.resultStatus === 'FAIL').length,
    canComplete: rows.length > 0 && rows.every((row) => row.isComplete),
  };
}

function buildImportPreview(rows: ImportedScoreRow[], candidates: any[]) {
  const candidateByIdCard = new Map<string, any>();
  for (const candidate of candidates) {
    candidateByIdCard.set(decrypt(candidate.idCard), candidate);
  }

  const previewRows = rows.map((importRow) => {
    const candidate = candidateByIdCard.get(importRow.idCard);
    const evaluation = evaluateScoreRecord(importRow);
    const nameMismatch = Boolean(candidate && importRow.name && candidate.name !== importRow.name);
    const messages: string[] = [];
    if (!candidate) messages.push('未匹配到本计划审核通过考生');
    if (nameMismatch) messages.push(`姓名不一致：系统为 ${candidate.name}`);
    if (evaluation.resultStatus === 'INCOMPLETE') messages.push('必考成绩未填写完整');

    return {
      importRow,
      candidate,
      matched: Boolean(candidate),
      nameMismatch,
      messages,
      resultStatus: evaluation.resultStatus,
      isPass: evaluation.isPass,
    };
  });

  return {
    rows: previewRows,
    summary: {
      total: previewRows.length,
      matched: previewRows.filter((row) => row.matched).length,
      unmatched: previewRows.filter((row) => !row.matched).length,
      nameMismatches: previewRows.filter((row) => row.nameMismatch).length,
      pass: previewRows.filter((row) => row.resultStatus === 'PASS').length,
      fail: previewRows.filter((row) => row.resultStatus === 'FAIL').length,
      incomplete: previewRows.filter((row) => row.resultStatus === 'INCOMPLETE').length,
    },
  };
}

async function ensureWritableScorePlan(planId: string, req: any): Promise<
  | { ok: true; value: any }
  | { ok: false; code: string; message: string; status: number }
> {
  if (canReadAcrossTenants(req.userRole)) {
    return { ok: false, code: 'FORBIDDEN', message: '总部和系统管理员仅可查看成绩，不能录入或完成节点', status: 403 };
  }

  const plan = await prisma.examPlan.findFirst({
    where: { id: planId, tenantId: req.tenantId },
    include: { nodes: { orderBy: { createdAt: 'asc' } } },
  });

  if (!plan) return { ok: false, code: 'NOT_FOUND', message: '考试计划不存在', status: 404 };
  if (plan.status !== 'PUBLISHED') return { ok: false, code: 'INVALID_PLAN_STATUS', message: '只有已发布计划可以进行成绩检录', status: 400 };

  const scoreNode = plan.nodes.find((node) => node.nodeType === 'SCORE_RECORD');
  if (!scoreNode) return { ok: false, code: 'SCORE_NODE_MISSING', message: '未找到成绩检录节点', status: 400 };
  if (scoreNode.status !== 'IN_PROGRESS') return { ok: false, code: 'SCORE_NODE_NOT_CURRENT', message: '计划尚未进入成绩检录节点', status: 400 };

  return { ok: true, value: plan };
}

async function upsertScore(tx: any, input: {
  candidate: any;
  input: ScoreEvaluationInput;
  userId?: string;
  source: ScoreSource;
  sourceFileName?: string;
}) {
  const scoreInput = {
    ...input.input,
    level: input.candidate.applyLevel || input.input.level,
  };
  const evaluation = evaluateScoreRecord(scoreInput);
  const totalScore = calculateTotalScore(scoreInput);
  const data = {
    theoryScore: cleanScore(scoreInput.theoryScore),
    practiceScore: cleanScore(scoreInput.practiceScore),
    comprehensiveScore: cleanScore(scoreInput.comprehensiveScore),
    workPerformanceScore: cleanScore(scoreInput.workPerformanceScore),
    theoryAbsent: scoreInput.theoryAbsent === true,
    practiceAbsent: scoreInput.practiceAbsent === true,
    comprehensiveAbsent: scoreInput.comprehensiveAbsent === true,
    workPerformanceAbsent: scoreInput.workPerformanceAbsent === true,
    totalScore,
    isPass: evaluation.isPass,
    resultStatus: evaluation.resultStatus,
    source: input.source,
    sourceFileName: input.sourceFileName || null,
    evaluatedBy: input.userId,
    evaluatedAt: new Date(),
  };

  const score = await tx.score.upsert({
    where: { candidateId: input.candidate.id },
    update: data,
    create: {
      candidateId: input.candidate.id,
      ...data,
    },
    include: scoreInclude(),
  });

  if (evaluation.resultStatus !== 'INCOMPLETE') {
    await tx.candidate.update({
      where: { id: input.candidate.id },
      data: { status: evaluation.isPass ? 'PASSED' : 'FAILED' },
    });
  }

  return score;
}

function scoreInputFromCandidate(candidate: any): ScoreEvaluationInput {
  return {
    level: candidate.applyLevel,
    theoryScore: candidate.score?.theoryScore ?? null,
    practiceScore: candidate.score?.practiceScore ?? null,
    comprehensiveScore: candidate.score?.comprehensiveScore ?? null,
    workPerformanceScore: candidate.score?.workPerformanceScore ?? null,
    theoryAbsent: candidate.score?.theoryAbsent === true,
    practiceAbsent: candidate.score?.practiceAbsent === true,
    comprehensiveAbsent: candidate.score?.comprehensiveAbsent === true,
    workPerformanceAbsent: candidate.score?.workPerformanceAbsent === true,
  };
}

function calculateTotalScore(input: ScoreEvaluationInput): number | null {
  if (!isScoreCompleteForLevel(input)) return null;
  if (getRequiredScoreSubjects(input.level).some((subject) => {
    if (subject === 'theory') return input.theoryAbsent;
    if (subject === 'practice') return input.practiceAbsent;
    return input.comprehensiveAbsent;
  })) return null;

  const scores = getRequiredScoreSubjects(input.level)
    .map((subject) => {
      if (subject === 'theory') return input.theoryScore;
      if (subject === 'practice') return input.practiceScore;
      return input.comprehensiveScore;
    })
    .filter((score): score is number => typeof score === 'number');

  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
}

function cleanScore(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getNodeOrderIndex(nodeType: string): number {
  const index = NODE_ORDER.indexOf(nodeType as any);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function appendNodeNote(existing: string | null | undefined, addition: string): string {
  return [existing, addition].filter(Boolean).join('\n');
}

function scoreInclude() {
  return {
    candidate: {
      include: {
        plan: {
          include: { tenant: { select: { id: true, code: true, name: true, type: true } } },
        },
      },
    },
  };
}

export default router;
