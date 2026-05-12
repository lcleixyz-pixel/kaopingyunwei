import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Pencil, Plus, Search, Trash2, UserPlus, XCircle } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { EDUCATION_OPTIONS, getWorkTypesForOccupation, LEVEL_OPTIONS, normalizeLevelLabel, OCCUPATION_OPTIONS, type ConvertProspectiveCandidateResponse, type ExamPlan, type ProspectiveCandidate, type ProspectiveCandidateStatus } from '@/shared';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/dateUtils';
import { getProspectSummarySource, summarizeProspects } from '@/lib/workbenchRules';

interface ProspectForm {
  name: string;
  phone: string;
  intendedOccupation: string;
  intendedProfession: string;
  intendedLevel: string;
  source: string;
  status: ProspectiveCandidateStatus;
  notes: string;
}

interface ConvertForm {
  planId: string;
  idCard: string;
  gender: 'M' | 'F';
  education: string;
  workYears: string;
}

const statusLabels: Record<ProspectiveCandidateStatus, string> = {
  FOLLOWING: '跟进中',
  CONVERTED: '已转正式',
  NOT_INTERESTED: '暂无意向',
};

const statusColors: Record<ProspectiveCandidateStatus, string> = {
  FOLLOWING: 'bg-blue-100 text-blue-700',
  CONVERTED: 'bg-green-100 text-green-700',
  NOT_INTERESTED: 'bg-slate-100 text-slate-600',
};

const defaultOccupation = OCCUPATION_OPTIONS[0].occupation;
const defaultLevel = '三级/高级工';
const defaultProfession = getWorkTypesForOccupation(defaultOccupation, defaultLevel)[0];

const emptyForm: ProspectForm = {
  name: '',
  phone: '',
  intendedOccupation: defaultOccupation,
  intendedProfession: defaultProfession,
  intendedLevel: defaultLevel,
  source: '',
  status: 'FOLLOWING',
  notes: '',
};

const emptyConvertForm: ConvertForm = {
  planId: '',
  idCard: '',
  gender: 'M',
  education: '',
  workYears: '',
};

export default function ProspectiveCandidates() {
  const { get, post, patch, del } = useApi();
  const { user } = useAuthStore();
  const [candidates, setCandidates] = useState<ProspectiveCandidate[]>([]);
  const [allCandidates, setAllCandidates] = useState<ProspectiveCandidate[]>([]);
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('FOLLOWING');
  const [editingCandidate, setEditingCandidate] = useState<ProspectiveCandidate | null>(null);
  const [convertingCandidate, setConvertingCandidate] = useState<ProspectiveCandidate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState<ProspectForm>(emptyForm);
  const [convertForm, setConvertForm] = useState<ConvertForm>(emptyConvertForm);

  const canDelete = user?.role === 'BRANCH_ADMIN';
  const summary = useMemo(
    () => summarizeProspects(getProspectSummarySource({ allCandidates, visibleCandidates: candidates })),
    [allCandidates, candidates],
  );
  const publishedPlans = useMemo(
    () => plans.filter((plan) => plan.status === 'PUBLISHED' && !plan.registrationClosed),
    [plans],
  );
  const workTypeOptions = getWorkTypesForOccupation(form.intendedOccupation, form.intendedLevel);
  const selectedPlan = publishedPlans.find((plan) => plan.id === convertForm.planId);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const [visibleCandidates, summaryCandidates] = await Promise.all([
        get<ProspectiveCandidate[]>('/prospective-candidates', params),
        get<ProspectiveCandidate[]>('/prospective-candidates'),
      ]);
      setCandidates(visibleCandidates);
      setAllCandidates(summaryCandidates);
    } catch (err) {
      setError(getErrorMessage(err, '获取意向考生失败'));
    } finally {
      setIsLoading(false);
    }
  }, [get, searchQuery, statusFilter]);

  const fetchPlans = useCallback(async () => {
    try {
      setPlans(await get<ExamPlan[]>('/exam-plans'));
    } catch {
      setPlans([]);
    }
  }, [get]);

  useEffect(() => {
    fetchCandidates();
    fetchPlans();
  }, [fetchCandidates, fetchPlans]);

  const openCreate = () => {
    setEditingCandidate(null);
    setForm(emptyForm);
    setShowEditor(true);
  };

  const openEdit = (candidate: ProspectiveCandidate) => {
    setEditingCandidate(candidate);
    setForm({
      name: candidate.name,
      phone: candidate.phone,
      intendedOccupation: candidate.intendedOccupation || defaultOccupation,
      intendedProfession: candidate.intendedProfession || defaultProfession,
      intendedLevel: normalizeLevelLabel(candidate.intendedLevel) || defaultLevel,
      source: candidate.source || '',
      status: candidate.status,
      notes: candidate.notes || '',
    });
    setShowEditor(true);
  };

  const openConvert = (candidate: ProspectiveCandidate) => {
    setConvertingCandidate(candidate);
    setConvertForm({
      ...emptyConvertForm,
      planId: findMatchingPublishedPlan(candidate, publishedPlans)?.id || publishedPlans[0]?.id || '',
    });
  };

  const updateOccupation = (occupation: string) => {
    const workTypes = getWorkTypesForOccupation(occupation, form.intendedLevel);
    setForm({ ...form, intendedOccupation: occupation, intendedProfession: workTypes[0] || '' });
  };
  const updateLevel = (intendedLevel: string) => {
    const workTypes = getWorkTypesForOccupation(form.intendedOccupation, intendedLevel);
    setForm({
      ...form,
      intendedLevel,
      intendedProfession: workTypes.includes(form.intendedProfession) ? form.intendedProfession : workTypes[0] || '',
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;

    const duplicate = allCandidates.find((candidate) => (
      candidate.phone === form.phone.trim() && candidate.id !== editingCandidate?.id
    ));
    if (duplicate && !window.confirm(`重复手机号提醒：${form.phone.trim()} 已存在于「${duplicate.name}」。仍然保存会保留两条线索，请确认是否继续。`)) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        source: form.source.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editingCandidate) {
        await patch(`/prospective-candidates/${editingCandidate.id}`, payload);
      } else {
        await post('/prospective-candidates', payload);
      }
      setShowEditor(false);
      setEditingCandidate(null);
      await fetchCandidates();
    } catch (err) {
      setError(getErrorMessage(err, '保存意向考生失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (candidate: ProspectiveCandidate) => {
    if (!window.confirm(`确定删除意向考生「${candidate.name}」吗？删除后不能恢复。`)) return;

    setError('');
    try {
      await del(`/prospective-candidates/${candidate.id}`);
      await fetchCandidates();
    } catch (err) {
      setError(getErrorMessage(err, '删除意向考生失败'));
    }
  };

  const handleConvert = async () => {
    if (!convertingCandidate || !convertForm.planId || !convertForm.idCard.trim()) return;

    setSaving(true);
    setError('');
    try {
      await post<ConvertProspectiveCandidateResponse>(`/prospective-candidates/${convertingCandidate.id}/convert`, {
        planId: convertForm.planId,
        idCard: convertForm.idCard.trim(),
        gender: convertForm.gender,
        education: convertForm.education.trim() || undefined,
        workYears: convertForm.workYears ? Number.parseInt(convertForm.workYears, 10) || undefined : undefined,
      });
      setConvertingCandidate(null);
      await fetchCandidates();
    } catch (err) {
      setError(getErrorMessage(err, '转为正式考生失败'));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-blue-600" />
            意向考生
          </h1>
          <p className="text-slate-500 mt-1">分支内部线索台账，可转入报名未结束的已发布考评计划</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增意向考生
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <ProspectMetric icon={<UserPlus className="h-4 w-4" />} label="跟进中" value={summary.following} tone="blue" />
        <ProspectMetric icon={<CheckCircle2 className="h-4 w-4" />} label="已转正式" value={summary.converted} tone="green" />
        <ProspectMetric icon={<CalendarIcon />} label="可转计划" value={publishedPlans.length} tone="slate" />
        <ProspectMetric icon={<AlertTriangle className="h-4 w-4" />} label="重复手机号" value={summary.duplicatePhones.length} tone={summary.duplicatePhones.length > 0 ? 'amber' : 'slate'} />
      </div>

      {summary.duplicatePhones.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">重复手机号：</span>
          {summary.duplicatePhones.join('、')}。转正式前建议先合并备注或确认是否为同一人。
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 sm:max-w-sm sm:flex-1 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索姓名或手机号..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        {['FOLLOWING', 'ALL', 'CONVERTED', 'NOT_INTERESTED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status === 'ALL' ? '全部' : statusLabels[status as ProspectiveCandidateStatus]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-slate-500">加载中...</span>
          </div>
        ) : (
          <table className="w-full min-w-[1080px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">姓名</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">手机号码</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">意向职业/工种</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">来源</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">状态</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">创建时间</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-900">{candidate.name}</div>
                    <div className="text-xs text-slate-500">{candidate.notes || '-'}</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">{candidate.phone}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">
                    <div>{candidate.intendedOccupation || '-'}</div>
                    <div className="text-xs text-slate-500">{candidate.intendedProfession || '-'} · {normalizeLevelLabel(candidate.intendedLevel) || '-'}</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{candidate.source || '-'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[candidate.status]}`}>
                      {statusLabels[candidate.status]}
                    </span>
                    {candidate.convertedCandidate?.plan && (
                      <div className="text-xs text-slate-500 mt-1">{candidate.convertedCandidate.plan.title}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{formatDate(candidate.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(candidate)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                        <Pencil className="w-4 h-4" />
                        编辑
                      </button>
                      {candidate.status !== 'CONVERTED' && (
                        <button onClick={() => openConvert(candidate)} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium">
                          <ArrowRight className="w-4 h-4" />
                          转正式
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(candidate)} className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium">
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && candidates.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <UserPlus className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>暂无意向考生</p>
          </div>
        )}
      </div>

      {showEditor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{editingCandidate ? '编辑意向考生' : '新增意向考生'}</h2>
              <button onClick={() => setShowEditor(false)} className="text-slate-500 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="姓名">
                <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="手机号码">
                <input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </Field>
              <Field label="意向职业">
                <select className={inputClass} value={form.intendedOccupation} onChange={(event) => updateOccupation(event.target.value)}>
                  {OCCUPATION_OPTIONS.map((item) => <option key={item.occupation} value={item.occupation}>{item.occupation}</option>)}
                </select>
              </Field>
              <Field label="意向职业工种名称">
                <select className={inputClass} value={form.intendedProfession} onChange={(event) => setForm({ ...form, intendedProfession: event.target.value })}>
                  {workTypeOptions.map((workType) => <option key={workType} value={workType}>{workType}</option>)}
                </select>
              </Field>
              <Field label="意向等级">
                <select className={inputClass} value={form.intendedLevel} onChange={(event) => updateLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </Field>
              <Field label="跟进状态">
                <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProspectiveCandidateStatus })}>
                  <option value="FOLLOWING">跟进中</option>
                  <option value="NOT_INTERESTED">暂无意向</option>
                  {editingCandidate?.status === 'CONVERTED' && <option value="CONVERTED">已转正式</option>}
                </select>
              </Field>
              <Field label="来源">
                <input className={inputClass} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="如：电话咨询、线下报名" />
              </Field>
              <Field label="备注">
                <input className={inputClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.phone.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {convertingCandidate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConvertingCandidate(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">转为正式考生</h2>
              <button onClick={() => setConvertingCandidate(null)} className="text-slate-500 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">{convertingCandidate.name} · {convertingCandidate.phone}</div>
                {selectedPlan ? (
                  <div className="mt-1">
                    {selectedPlan.title} · {selectedPlan.occupation} · {selectedPlan.profession} · {normalizeLevelLabel(selectedPlan.level)} · 考试 {formatDate(selectedPlan.examDate)} · 报名截止 {formatDate(selectedPlan.registrationDeadline)}
                  </div>
                ) : (
                  <div className="mt-1 text-amber-700">当前没有可转入的已发布计划，或计划报名阶段已结束</div>
                )}
              </div>
              <Field label="已发布考评计划">
                <select className={inputClass} value={convertForm.planId} onChange={(event) => setConvertForm({ ...convertForm, planId: event.target.value })}>
                  <option value="">请选择计划</option>
                  {publishedPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title} · {plan.profession} · {normalizeLevelLabel(plan.level)} · 截止 {formatDate(plan.registrationDeadline)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="证件号码">
                  <input className={inputClass} value={convertForm.idCard} onChange={(event) => setConvertForm({ ...convertForm, idCard: event.target.value })} />
                </Field>
                <Field label="性别">
                  <select className={inputClass} value={convertForm.gender} onChange={(event) => setConvertForm({ ...convertForm, gender: event.target.value as 'M' | 'F' })}>
                    <option value="M">男</option>
                    <option value="F">女</option>
                  </select>
                </Field>
                <Field label="文化程度">
                  <select className={inputClass} value={convertForm.education} onChange={(event) => setConvertForm({ ...convertForm, education: event.target.value })}>
                    <option value="">请选择</option>
                    {EDUCATION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="专业年限">
                  <input type="number" min="0" className={inputClass} value={convertForm.workYears} onChange={(event) => setConvertForm({ ...convertForm, workYears: event.target.value })} />
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setConvertingCandidate(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
              <button
                onClick={handleConvert}
                disabled={saving || !convertForm.planId || !convertForm.idCard.trim()}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                确认转正式
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProspectMetric(props: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'amber' | 'slate';
}) {
  const toneClass = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-white text-slate-700',
  }[props.tone];
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {props.icon}
        {props.label}
      </div>
      <div className="mt-2 text-2xl font-bold">{props.value}</div>
    </div>
  );
}

function CalendarIcon() {
  return <ArrowRight className="h-4 w-4" />;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function findMatchingPublishedPlan(candidate: ProspectiveCandidate, plans: ExamPlan[]): ExamPlan | undefined {
  return plans.find((plan) => (
    (!candidate.intendedOccupation || plan.occupation === candidate.intendedOccupation)
    && (!candidate.intendedProfession || plan.profession === candidate.intendedProfession)
    && (!candidate.intendedLevel || plan.level === candidate.intendedLevel)
  ));
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: { error?: { message?: string; details?: string } } } }).response;
    const message = response?.data?.error?.message;
    const details = response?.data?.error?.details;
    return details ? `${message || fallback}：${details}` : message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
