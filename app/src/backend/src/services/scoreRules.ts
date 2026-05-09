import { normalizeLevelLabel } from './phase1Rules.js';

export type ScoreResultStatus = 'PASS' | 'FAIL' | 'INCOMPLETE';
export type ScoreSource = 'MANUAL' | 'IMPORT';

export interface ScoreEvaluationInput {
  level: string;
  theoryScore?: number | null;
  practiceScore?: number | null;
  comprehensiveScore?: number | null;
  workPerformanceScore?: number | null;
  theoryAbsent?: boolean | null;
  practiceAbsent?: boolean | null;
  comprehensiveAbsent?: boolean | null;
  workPerformanceAbsent?: boolean | null;
}

export interface ScoreEvaluationResult {
  resultStatus: ScoreResultStatus;
  isPass: boolean;
}

export interface ImportedScoreRow extends ScoreEvaluationInput {
  rowNumber: number;
  ticketNo: string;
  name: string;
  gender: string;
  idCard: string;
  organization: string;
  profession: string;
  level: string;
}

type RequiredSubject = 'theory' | 'practice' | 'comprehensive';

export function getRequiredScoreSubjects(level: string): RequiredSubject[] {
  const normalized = normalizeLevelLabel(level);
  if (normalized === '一级/高级技师' || normalized === '二级/技师') {
    return ['theory', 'practice', 'comprehensive'];
  }
  return ['theory', 'practice'];
}

export function isScoreCompleteForLevel(input: ScoreEvaluationInput): boolean {
  return getRequiredScoreSubjects(input.level).every((subject) => isSubjectComplete(input, subject));
}

export function evaluateScoreRecord(input: ScoreEvaluationInput): ScoreEvaluationResult {
  const requiredSubjects = getRequiredScoreSubjects(input.level);
  const hasAbsentRequiredSubject = requiredSubjects.some((subject) => isSubjectAbsent(input, subject));
  if (hasAbsentRequiredSubject) return { resultStatus: 'FAIL', isPass: false };

  if (!isScoreCompleteForLevel(input)) return { resultStatus: 'INCOMPLETE', isPass: false };

  const passed = requiredSubjects.every((subject) => {
    const score = getSubjectScore(input, subject);
    return typeof score === 'number' && score >= 60;
  });

  return {
    resultStatus: passed ? 'PASS' : 'FAIL',
    isPass: passed,
  };
}

export function parseScoreRosterRows(rows: unknown[][]): ImportedScoreRow[] {
  const headerRowIndex = rows.findIndex((row) => row.map(cellText).includes('准考证号') && row.map(cellText).includes('考核成绩'));
  if (headerRowIndex < 0) return [];

  const dataStartIndex = headerRowIndex + 2;
  const parsedRows: ImportedScoreRow[] = [];

  for (let index = dataStartIndex; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const firstCell = cellText(row[0]);
    if (!firstCell || firstCell.includes('填报人')) break;
    if (!/^\d+$/.test(firstCell)) continue;

    const theory = parseScoreCell(row[8]);
    const practice = parseScoreCell(row[9]);
    const comprehensive = parseScoreCell(row[10]);
    const workPerformance = parseScoreCell(row[11]);

    parsedRows.push({
      rowNumber: index + 1,
      ticketNo: cellText(row[1]),
      name: cellText(row[2]),
      gender: cellText(row[3]),
      idCard: cellText(row[4]),
      organization: cellText(row[5]),
      profession: cellText(row[6]),
      level: normalizeLevelLabel(cellText(row[7])),
      theoryScore: theory.score,
      practiceScore: practice.score,
      comprehensiveScore: comprehensive.score,
      workPerformanceScore: workPerformance.score,
      theoryAbsent: theory.absent,
      practiceAbsent: practice.absent,
      comprehensiveAbsent: comprehensive.absent,
      workPerformanceAbsent: workPerformance.absent,
    });
  }

  return parsedRows;
}

export function parseScoreCell(value: unknown): { score: number | null; absent: boolean } {
  const text = cellText(value);
  if (!text || text === '--' || text === '-') return { score: null, absent: false };
  if (text === '缺考') return { score: null, absent: true };

  const score = typeof value === 'number' ? value : Number(text);
  return Number.isFinite(score) ? { score, absent: false } : { score: null, absent: false };
}

function isSubjectComplete(input: ScoreEvaluationInput, subject: RequiredSubject): boolean {
  return isSubjectAbsent(input, subject) || typeof getSubjectScore(input, subject) === 'number';
}

function isSubjectAbsent(input: ScoreEvaluationInput, subject: RequiredSubject): boolean {
  if (subject === 'theory') return input.theoryAbsent === true;
  if (subject === 'practice') return input.practiceAbsent === true;
  return input.comprehensiveAbsent === true;
}

function getSubjectScore(input: ScoreEvaluationInput, subject: RequiredSubject): number | null | undefined {
  if (subject === 'theory') return input.theoryScore;
  if (subject === 'practice') return input.practiceScore;
  return input.comprehensiveScore;
}

function cellText(value: unknown): string {
  return String(value ?? '').trim();
}
