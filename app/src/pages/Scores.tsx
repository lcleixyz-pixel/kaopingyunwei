import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, Award, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Save, ShieldCheck, Upload } from 'lucide-react';
import { PageAlert } from '@/components/common/PageAlert';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useApi } from '@/hooks/useApi';
import {
  normalizeLevelLabel,
  type ImportedScoreRow,
  type ScoreCandidateRow,
  type ScoreImportPreview,
  type ScorePlanOption,
} from '@/shared';
import { formatDate } from '@/lib/dateUtils';
import { getRequiredSubjectSummary, normalizeScorePlanDetail, type ScorePlanDetail } from '@/lib/scorePageRules';
import { getFriendlyErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/stores/authStore';

interface ScoreDraft {
  theoryScore: string;
  practiceScore: string;
  comprehensiveScore: string;
  workPerformanceScore: string;
  theoryAbsent: boolean;
  practiceAbsent: boolean;
  comprehensiveAbsent: boolean;
  workPerformanceAbsent: boolean;
}

const emptyDraft: ScoreDraft = {
  theoryScore: '',
  practiceScore: '',
  comprehensiveScore: '',
  workPerformanceScore: '',
  theoryAbsent: false,
  practiceAbsent: false,
  comprehensiveAbsent: false,
  workPerformanceAbsent: false,
};

const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-100 disabled:text-slate-400';

export default function Scores() {
  const { get, post } = useApi();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<ScorePlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [detail, setDetail] = useState<ScorePlanDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<ImportedScoreRow[]>([]);
  const [preview, setPreview] = useState<ScoreImportPreview | null>(null);

  const canWrite = user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId), [plans, selectedPlanId]);

  const fetchPlans = useCallback(async () => {
    setIsLoadingPlans(true);
    setError('');
    try {
      const data = await get<ScorePlanOption[]>('/scores/plans');
      setPlans(data);
      setSelectedPlanId((current) => current || data[0]?.id || '');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '获取成绩检录计划失败'));
    } finally {
      setIsLoadingPlans(false);
    }
  }, [get]);

  const fetchDetail = useCallback(async (planId: string) => {
    if (!planId) {
      setDetail(null);
      setDrafts({});
      return;
    }
    setIsLoadingDetail(true);
    setError('');
    try {
      const data = await get<unknown>('/scores', { planId });
      const normalizedDetail = normalizeScorePlanDetail(data);
      setDetail(normalizedDetail);
      setDrafts(Object.fromEntries(normalizedDetail.candidates.map((row) => [row.candidate.id, draftFromRow(row)])));
      setPreview(null);
      setImportRows([]);
      setImportFileName('');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '获取计划成绩失败'));
    } finally {
      setIsLoadingDetail(false);
    }
  }, [get]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchDetail(selectedPlanId);
  }, [fetchDetail, selectedPlanId]);

  const saveManualScores = async () => {
    if (!selectedPlanId || !detail) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await post('/scores/batch', {
        planId: selectedPlanId,
        records: detail.candidates.map((row) => ({
          candidateId: row.candidate.id,
          ...draftToPayload(drafts[row.candidate.id] || emptyDraft),
        })),
      });
      setNotice('成绩已保存，系统已按规则自动判定合格状态，请核对。');
      await fetchDetail(selectedPlanId);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '保存成绩失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const previewImport = async (file: File | undefined) => {
    if (!file || !selectedPlanId) return;
    setIsImporting(true);
    setError('');
    setNotice('');
    try {
      const rows = await readScoreWorkbook(file);
      const data = await post<ScoreImportPreview>('/scores/import/preview', {
        planId: selectedPlanId,
        fileName: file.name,
        rows,
      });
      setImportFileName(file.name);
      setImportRows(rows);
      setPreview(data);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '预览成绩表失败'));
    } finally {
      setIsImporting(false);
    }
  };

  const commitImport = async () => {
    if (!selectedPlanId || importRows.length === 0) return;
    setIsImporting(true);
    setError('');
    setNotice('');
    try {
      const result = await post<{ writtenCount: number }>('/scores/import/commit', {
        planId: selectedPlanId,
        fileName: importFileName,
        rows: importRows,
      });
      setNotice(`已写入 ${result.writtenCount} 条匹配成绩，系统已自动判定合格状态，请核对。`);
      setPreview(null);
      setImportRows([]);
      setImportFileName('');
      await fetchDetail(selectedPlanId);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '确认导入失败'));
    } finally {
      setIsImporting(false);
    }
  };

  const completeScoreRecord = async () => {
    if (!selectedPlanId) return;
    const ok = await confirm({
      title: '完成成绩检录',
      description: '确认该计划全部考生成绩已核对无误，并结束成绩检录阶段？完成后会推进计划节点，后续如需调整需重新核对留痕。',
      confirmText: '确认完成',
      tone: 'warning',
    });
    if (!ok) return;
    setIsCompleting(true);
    setError('');
    setNotice('');
    try {
      await post(`/scores/plans/${selectedPlanId}/complete`, {});
      setNotice('成绩检录节点已完成，计划已进入下一节点。');
      await fetchPlans();
      await fetchDetail(selectedPlanId);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '完成成绩检录失败'));
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-600" />
            成绩管理
          </h1>
          <p className="text-slate-500 mt-1">按考试计划进行成绩检录、导入、核对和节点流转</p>
        </div>
        <button type="button" onClick={fetchPlans} className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 hover:bg-slate-50 rounded-lg font-medium transition-colors">
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {error && <PageAlert tone="error">{error}</PageAlert>}
      {notice && <PageAlert tone="success">{notice}</PageAlert>}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">选择成绩检录计划</label>
        <select
          className={inputClass}
          value={selectedPlanId}
          disabled={isLoadingPlans}
          onChange={(event) => setSelectedPlanId(event.target.value)}
        >
          <option value="">{isLoadingPlans ? '加载中...' : '请选择计划'}</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.title} · {formatDate(plan.examDate)} · {plan.profession} · {normalizeLevelLabel(plan.level)}
            </option>
          ))}
        </select>
        {!isLoadingPlans && plans.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">暂无处于“成绩检录”节点的已发布计划。</p>
        )}
      </div>

      {selectedPlan && detail && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <MetricCard label="计划考生" value={detail.summary.total} />
            <MetricCard label="已检录" value={detail.summary.complete} />
            <MetricCard label="未完成" value={detail.summary.incomplete} />
            <MetricCard label="合格" value={detail.summary.pass} />
            <MetricCard label="不合格" value={detail.summary.fail} />
          </div>

          <div className={`rounded-xl border p-5 shadow-sm ${detail.summary.canComplete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-bold text-slate-950">
                  <ShieldCheck className={`h-5 w-5 ${detail.summary.canComplete ? 'text-emerald-600' : 'text-amber-600'}`} />
                  成绩检录闸门
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {detail.summary.canComplete
                    ? '所有必考科目已完成检录，可以在确认无误后结束成绩检录节点。'
                    : `还有 ${detail.summary.incomplete} 名考生未完成必考科目检录，暂不能结束节点。`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-slate-700">导入前先预览</span>
                <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-slate-700">保存后自动判定</span>
                <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-slate-700">结束节点需全员完成</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  上传本地业务系统成绩表
                </h2>
                <p className="text-sm text-slate-500 mt-1">按乌鲁木齐成绩花名册模板解析，预览确认后写入。</p>
              </div>
              <label className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${canWrite ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                选择成绩表
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={!canWrite || isImporting}
                  className="hidden"
                  onChange={(event) => previewImport(event.target.files?.[0])}
                />
              </label>
            </div>

            {preview && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-slate-700">
                    <b>{importFileName}</b>：共 {preview.summary.total} 行，匹配 {preview.summary.matched} 行，未匹配 {preview.summary.unmatched} 行，姓名差异 {preview.summary.nameMismatches} 行
                  </div>
                  <button
                    type="button"
                    onClick={commitImport}
                    disabled={isImporting || preview.summary.matched === 0}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-medium"
                  >
                    确认写入匹配成绩
                  </button>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2">行</th>
                        <th className="text-left px-4 py-2">姓名</th>
                        <th className="text-left px-4 py-2">证件号码</th>
                        <th className="text-left px-4 py-2">理论/技能/综合/业绩</th>
                        <th className="text-left px-4 py-2">判定</th>
                        <th className="text-left px-4 py-2">提示</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.map((row) => (
                        <tr key={row.importRow.rowNumber} className={row.matched ? 'bg-white' : 'bg-amber-50'}>
                          <td className="px-4 py-2">{row.importRow.rowNumber}</td>
                          <td className="px-4 py-2">{row.importRow.name}</td>
                          <td className="px-4 py-2 font-mono text-xs">{row.importRow.idCard}</td>
                          <td className="px-4 py-2">{scoreText(row.importRow)}</td>
                          <td className="px-4 py-2"><ResultBadge status={row.resultStatus} /></td>
                          <td className="px-4 py-2 text-slate-600">{row.messages.join('；') || '可写入'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">手动检录成绩</h2>
                <p className="text-sm text-slate-500 mt-1">
                  必考科目：{getRequiredSubjectSummary(detail.candidates)}。工作业绩仅保存留痕，不参与合格判定。
                </p>
              </div>
              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveManualScores}
                    disabled={isSaving || detail.candidates.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    保存本计划成绩
                  </button>
                  {detail.summary.canComplete && (
                    <button
                      type="button"
                      onClick={completeScoreRecord}
                      disabled={isCompleting}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-medium"
                    >
                      {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      检录完毕
                    </button>
                  )}
                </div>
              )}
            </div>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="ml-3 text-slate-500">加载中...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">考生</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">等级</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">理论</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">技能/实操</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">综合评审</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">工作业绩</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">结果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.candidates.map((row) => {
                      const draft = drafts[row.candidate.id] || emptyDraft;
                      return (
                        <tr key={row.candidate.id} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-900">{row.candidate.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{row.candidate.idCard}</div>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">{normalizeLevelLabel(row.candidate.applyLevel)}</td>
                          <td className="px-4 py-4"><ScoreInput value={draft.theoryScore} absent={draft.theoryAbsent} disabled={!canWrite} onChange={(patch) => updateDraft(row.candidate.id, patch)} scoreKey="theoryScore" absentKey="theoryAbsent" /></td>
                          <td className="px-4 py-4"><ScoreInput value={draft.practiceScore} absent={draft.practiceAbsent} disabled={!canWrite} onChange={(patch) => updateDraft(row.candidate.id, patch)} scoreKey="practiceScore" absentKey="practiceAbsent" /></td>
                          <td className="px-4 py-4"><ScoreInput value={draft.comprehensiveScore} absent={draft.comprehensiveAbsent} disabled={!canWrite} onChange={(patch) => updateDraft(row.candidate.id, patch)} scoreKey="comprehensiveScore" absentKey="comprehensiveAbsent" /></td>
                          <td className="px-4 py-4"><ScoreInput value={draft.workPerformanceScore} absent={draft.workPerformanceAbsent} disabled={!canWrite} onChange={(patch) => updateDraft(row.candidate.id, patch)} scoreKey="workPerformanceScore" absentKey="workPerformanceAbsent" /></td>
                          <td className="px-4 py-4"><ResultBadge status={row.resultStatus} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoadingDetail && detail.candidates.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>该计划暂无审核通过考生</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  function updateDraft(candidateId: string, patch: Partial<ScoreDraft>) {
    setDrafts((current) => ({
      ...current,
      [candidateId]: {
        ...(current[candidateId] || emptyDraft),
        ...patch,
      },
    }));
  }
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ScoreInput(props: {
  value: string;
  absent: boolean;
  disabled: boolean;
  scoreKey: keyof ScoreDraft;
  absentKey: keyof ScoreDraft;
  onChange: (patch: Partial<ScoreDraft>) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        className={inputClass}
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={props.value}
        disabled={props.disabled || props.absent}
        onChange={(event) => props.onChange({ [props.scoreKey]: event.target.value } as Partial<ScoreDraft>)}
      />
      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={props.absent}
          disabled={props.disabled}
          onChange={(event) => props.onChange({
            [props.absentKey]: event.target.checked,
            [props.scoreKey]: event.target.checked ? '' : props.value,
          } as Partial<ScoreDraft>)}
        />
        缺考
      </label>
    </div>
  );
}

function ResultBadge({ status }: { status: string }) {
  const config = {
    PASS: 'bg-green-100 text-green-700',
    FAIL: 'bg-red-100 text-red-700',
    INCOMPLETE: 'bg-amber-100 text-amber-700',
  }[status] || 'bg-slate-100 text-slate-600';
  const label = {
    PASS: '合格',
    FAIL: '不合格',
    INCOMPLETE: '未完成',
  }[status] || '未判定';
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${config}`}>{label}</span>;
}

function draftFromRow(row: ScoreCandidateRow): ScoreDraft {
  const score = row.score;
  if (!score) return { ...emptyDraft };
  return {
    theoryScore: score.theoryScore == null ? '' : String(score.theoryScore),
    practiceScore: score.practiceScore == null ? '' : String(score.practiceScore),
    comprehensiveScore: score.comprehensiveScore == null ? '' : String(score.comprehensiveScore),
    workPerformanceScore: score.workPerformanceScore == null ? '' : String(score.workPerformanceScore),
    theoryAbsent: score.theoryAbsent === true,
    practiceAbsent: score.practiceAbsent === true,
    comprehensiveAbsent: score.comprehensiveAbsent === true,
    workPerformanceAbsent: score.workPerformanceAbsent === true,
  };
}

function draftToPayload(draft: ScoreDraft) {
  return {
    theoryScore: toNumberOrNull(draft.theoryScore),
    practiceScore: toNumberOrNull(draft.practiceScore),
    comprehensiveScore: toNumberOrNull(draft.comprehensiveScore),
    workPerformanceScore: toNumberOrNull(draft.workPerformanceScore),
    theoryAbsent: draft.theoryAbsent,
    practiceAbsent: draft.practiceAbsent,
    comprehensiveAbsent: draft.comprehensiveAbsent,
    workPerformanceAbsent: draft.workPerformanceAbsent,
  };
}

function scoreText(row: ImportedScoreRow): string {
  return [
    cellScoreText(row.theoryScore, row.theoryAbsent),
    cellScoreText(row.practiceScore, row.practiceAbsent),
    cellScoreText(row.comprehensiveScore, row.comprehensiveAbsent),
    cellScoreText(row.workPerformanceScore, row.workPerformanceAbsent),
  ].join(' / ');
}

function cellScoreText(score: number | null, absent: boolean): string {
  if (absent) return '缺考';
  return score == null ? '-' : String(score);
}

function toNumberOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readScoreWorkbook(file: File): Promise<ImportedScoreRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false });
  const records = parseScoreRosterRows(rows);
  if (records.length === 0) throw new Error('未识别到成绩花名册数据，请确认使用本地业务系统导出的成绩表');
  return records;
}

function parseScoreRosterRows(rows: unknown[][]): ImportedScoreRow[] {
  const headerIndex = rows.findIndex((row) => row.map(cellText).includes('准考证号') && row.map(cellText).includes('考核成绩'));
  if (headerIndex < 0) return [];

  const records: ImportedScoreRow[] = [];
  for (let index = headerIndex + 2; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const firstCell = cellText(row[0]);
    if (!firstCell || firstCell.includes('填报人')) break;
    if (!/^\d+$/.test(firstCell)) continue;

    const theory = parseScoreCell(row[8]);
    const practice = parseScoreCell(row[9]);
    const comprehensive = parseScoreCell(row[10]);
    const workPerformance = parseScoreCell(row[11]);
    records.push({
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
  return records;
}

function parseScoreCell(value: unknown): { score: number | null; absent: boolean } {
  const text = cellText(value);
  if (!text || text === '--' || text === '-') return { score: null, absent: false };
  if (text === '缺考') return { score: null, absent: true };
  const score = typeof value === 'number' ? value : Number(text);
  return Number.isFinite(score) ? { score, absent: false } : { score: null, absent: false };
}

function cellText(value: unknown): string {
  return String(value ?? '').trim();
}
