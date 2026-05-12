import { normalizeLevelLabel, type ScoreCandidateRow, type ScorePlanOption } from '../shared';

type RequiredScoreSubject = ScoreCandidateRow['requiredSubjects'][number];

export interface ScorePlanDetail {
  plan: ScorePlanOption;
  candidates: ScoreCandidateRow[];
  summary: {
    total: number;
    complete: number;
    incomplete: number;
    pass: number;
    fail: number;
    canComplete: boolean;
  };
}

const requiredSubjectLabels: Record<RequiredScoreSubject, string> = {
  theory: '理论',
  practice: '技能/实操',
  comprehensive: '综合评审',
};

const validRequiredSubjects = new Set<RequiredScoreSubject>(['theory', 'practice', 'comprehensive']);

export function normalizeScorePlanDetail(value: unknown): ScorePlanDetail {
  const input = isRecord(value) ? value : {};
  const candidates = normalizeCandidates(input.candidates);
  const summary = isRecord(input.summary) ? input.summary : {};
  const complete = numberOr(summary.complete, candidates.filter((row) => row.isComplete).length);
  const total = numberOr(summary.total, candidates.length);

  return {
    plan: (isRecord(input.plan) ? input.plan : {}) as unknown as ScorePlanOption,
    candidates,
    summary: {
      total,
      complete,
      incomplete: numberOr(summary.incomplete, Math.max(total - complete, 0)),
      pass: numberOr(summary.pass, candidates.filter((row) => row.resultStatus === 'PASS').length),
      fail: numberOr(summary.fail, candidates.filter((row) => row.resultStatus === 'FAIL').length),
      canComplete: typeof summary.canComplete === 'boolean' ? summary.canComplete : candidates.length > 0 && candidates.every((row) => row.isComplete),
    },
  };
}

export function getRequiredSubjectSummary(candidates: Pick<ScoreCandidateRow, 'requiredSubjects'>[]): string {
  const requiredSubjects = candidates.find((row) => row.requiredSubjects.length > 0)?.requiredSubjects ?? [];
  return requiredSubjects.map((subject) => requiredSubjectLabels[subject]).filter(Boolean).join('、') || '-';
}

function normalizeCandidates(value: unknown): ScoreCandidateRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const normalized = normalizeCandidateRow(row);
    return normalized ? [normalized] : [];
  });
}

function normalizeCandidateRow(value: unknown): ScoreCandidateRow | null {
  if (!isRecord(value) || !isRecord(value.candidate)) return null;
  const candidate = value.candidate as unknown as ScoreCandidateRow['candidate'];
  return {
    ...(value as unknown as ScoreCandidateRow),
    candidate,
    score: isRecord(value.score) ? (value.score as unknown as ScoreCandidateRow['score']) : null,
    requiredSubjects: normalizeRequiredSubjects(value.requiredSubjects, candidate.applyLevel),
    isComplete: typeof value.isComplete === 'boolean' ? value.isComplete : false,
    resultStatus: isResultStatus(value.resultStatus) ? value.resultStatus : 'INCOMPLETE',
  };
}

function normalizeRequiredSubjects(value: unknown, level: string): RequiredScoreSubject[] {
  if (Array.isArray(value)) {
    const subjects = value.filter((item): item is RequiredScoreSubject => validRequiredSubjects.has(item as RequiredScoreSubject));
    if (subjects.length > 0) return subjects;
  }
  return requiredSubjectsForLevel(level);
}

function requiredSubjectsForLevel(level: string): RequiredScoreSubject[] {
  const normalized = normalizeLevelLabel(level);
  if (normalized === '一级/高级技师' || normalized === '二级/技师') {
    return ['theory', 'practice', 'comprehensive'];
  }
  return ['theory', 'practice'];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isResultStatus(value: unknown): value is ScoreCandidateRow['resultStatus'] {
  return value === 'PASS' || value === 'FAIL' || value === 'INCOMPLETE';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
