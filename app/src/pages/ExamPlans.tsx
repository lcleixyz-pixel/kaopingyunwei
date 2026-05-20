import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Plus, Search, Filter, Loader2, Pencil, Send, RotateCcw, XCircle } from 'lucide-react';
import { PageAlert } from '@/components/common/PageAlert';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { PaginationBar } from '@/components/common/PaginationBar';
import { useApi } from '@/hooks/useApi';
import { getWorkTypesForOccupation, LEVEL_OPTIONS, normalizeLevelLabel, OCCUPATION_OPTIONS, type ExamPlan } from '@/shared';
import { PLAN_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/dateUtils';
import { DEFAULT_PAGE_SIZE, SUMMARY_PAGE_SIZE, clampPageAfterMeta, withPaginationParams, type PaginationMeta, type PaginationState } from '@/lib/apiPagination';
import { getFriendlyErrorMessage } from '@/lib/apiError';
import { getPlanStageSummary } from '@/lib/workbenchRules';
import { useAuthStore } from '@/stores/authStore';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

interface CreatePlanForm {
  title: string;
  occupation: string;
  examDate: string;
  registrationDeadline: string;
  profession: string;
  level: string;
  location: string;
  maxCandidates: number;
  notes: string;
}

const defaultOccupation = OCCUPATION_OPTIONS[0].occupation;
const defaultLevel = '三级/高级工';
const defaultProfession = getWorkTypesForOccupation(defaultOccupation, defaultLevel)[0];

const emptyForm: CreatePlanForm = {
  title: '',
  occupation: defaultOccupation,
  examDate: '',
  registrationDeadline: '',
  profession: defaultProfession,
  level: defaultLevel,
  location: '',
  maxCandidates: 50,
  notes: '',
};

export default function ExamPlans() {
  const { get, getWithMeta, post, patch } = useApi();
  const { confirm, prompt, confirmDialog } = useConfirmDialog();
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [allPlans, setAllPlans] = useState<ExamPlan[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('PUBLISHED');
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ExamPlan | null>(null);
  const [form, setForm] = useState<CreatePlanForm>(emptyForm);
  const [creating, setCreating] = useState(false);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      const { data, meta } = await getWithMeta<ExamPlan[]>('/exam-plans', withPaginationParams(params, pagination));
      const nextPaginationMeta = meta?.pagination;
      setPlans(data);
      setPaginationMeta(nextPaginationMeta);
      const safePage = clampPageAfterMeta(pagination.page, nextPaginationMeta);
      if (safePage !== pagination.page) {
        setPagination((current) => ({ ...current, page: safePage }));
      }
      setAllPlans(await get<ExamPlan[]>('/exam-plans', { page: 1, pageSize: SUMMARY_PAGE_SIZE }));
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '获取计划列表失败'));
    } finally {
      setIsLoading(false);
    }
  }, [get, getWithMeta, pagination, statusFilter, searchQuery]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const displayedPlans = statusFilter === 'ALL'
    ? [...plans].sort((a, b) => getPlanStatusRank(a.status) - getPlanStatusRank(b.status) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : plans;
  const planSummary = useMemo(() => getPlanStageSummary(allPlans), [allPlans]);
  const cancelledCount = useMemo(() => allPlans.filter((plan) => plan.status === 'CANCELLED').length, [allPlans]);

  const openCreateDialog = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setShowCreate(true);
  };

  const openEditDialog = (plan: ExamPlan) => {
    setEditingPlan(plan);
    setForm({
      title: plan.title,
      occupation: plan.occupation,
      examDate: toDateInputValue(plan.examDate),
      registrationDeadline: toDateInputValue(plan.registrationDeadline),
      profession: plan.profession,
      level: normalizeLevelLabel(plan.level),
      location: plan.location,
      maxCandidates: plan.maxCandidates,
      notes: plan.notes || '',
    });
    setShowCreate(true);
  };

  const closePlanDialog = () => {
    setShowCreate(false);
    setEditingPlan(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.title || !form.occupation || !form.profession || !form.examDate || !form.registrationDeadline || !form.location) return;
    setCreating(true);
    try {
      const payload = {
        ...form,
        examDate: new Date(form.examDate).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline).toISOString(),
      };
      if (editingPlan) {
        await patch<ExamPlan>(`/exam-plans/${editingPlan.id}`, payload);
      } else {
        await post<ExamPlan>('/exam-plans', payload);
      }
      closePlanDialog();
      fetchPlans();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, editingPlan ? '保存失败' : '创建失败'));
    } finally {
      setCreating(false);
    }
  };

  const canManagePlans = user?.role === 'SYS_ADMIN' || user?.role === 'BRANCH_ADMIN';

  const resetToFirstPage = () => {
    setPagination((current) => current.page === 1 ? current : { ...current, page: 1 });
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    resetToFirstPage();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    resetToFirstPage();
  };

  const handlePageChange = (page: number) => {
    setPagination((current) => ({ ...current, page }));
  };

  const handlePublish = async (plan: ExamPlan) => {
    const ok = await confirm({
      title: '发布考评计划',
      description: `确认发布「${plan.title}」？发布后会生成考评节点并开放报名资料整理；如需回退，正式考生会转回意向考生。`,
      confirmText: '确认发布',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      await patch(`/exam-plans/${plan.id}/publish`);
      fetchPlans();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '发布失败'));
    }
  };

  const handleCancel = async (planId: string) => {
    const reason = await prompt({
      title: '取消考评计划',
      description: '请输入取消备注。只有草稿计划且无考生时才可取消。',
      inputLabel: '取消备注',
      inputPlaceholder: '请说明取消原因',
      confirmText: '确认取消',
      tone: 'danger',
    }) || '';
    if (!reason) {
      setError('取消计划必须填写备注');
      return;
    }
    try {
      await patch(`/exam-plans/${planId}/cancel`, { reason });
      fetchPlans();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '取消失败'));
    }
  };

  const handleRollback = async (planId: string) => {
    const ok = await confirm({
      title: '回退为草稿',
      description: '回退后，该计划下所有正式考生会转回意向考生“跟进中”，正式考生记录会被移除。确定回退到草稿吗？',
      confirmText: '确认回退',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await patch(`/exam-plans/${planId}/rollback`, { reason: '页面操作回退至草稿' });
      fetchPlans();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, '回退失败'));
    }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm';
  const workTypeOptions = getWorkTypesForOccupation(form.occupation, form.level);
  const updateOccupation = (occupation: string) => {
    const workTypes = getWorkTypesForOccupation(occupation, form.level);
    setForm({ ...form, occupation, profession: workTypes[0] || '' });
  };
  const updateLevel = (level: string) => {
    const workTypes = getWorkTypesForOccupation(form.occupation, level);
    setForm({ ...form, level, profession: workTypes.includes(form.profession) ? form.profession : workTypes[0] || '' });
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            考评计划
          </h1>
          <p className="text-slate-500 mt-1">管理职业、工种、报名截止和考试安排</p>
        </div>
        {canManagePlans && (
          <button
            onClick={openCreateDialog}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建草稿
          </button>
        )}
      </div>

      {error && <PageAlert tone="error">{error}</PageAlert>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <PlanMetric icon={<CheckCircle2 className="h-4 w-4" />} label="已发布" value={planSummary.totalPublished} tone="green" />
        <PlanMetric icon={<CalendarDays className="h-4 w-4" />} label="报名开放" value={planSummary.registrationOpen} tone="blue" />
        <PlanMetric icon={<AlertTriangle className="h-4 w-4" />} label="7天内截止" value={planSummary.registrationClosingSoon} tone="amber" />
        <PlanMetric icon={<XCircle className="h-4 w-4" />} label="已取消" value={cancelledCount} tone="slate" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索计划名称、职业、工种..."
            value={searchQuery}
            onChange={(e) => handleSearchQueryChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          {['PUBLISHED', 'DRAFT', 'ALL', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => handleStatusFilterChange(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s === 'ALL' ? '全部' : PLAN_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-slate-500">加载中...</span>
          </div>
        ) : (
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">计划名称</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">工种/等级</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">考试日期</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">已报/上限</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedPlans.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{plan.title}</div>
                    <div className="text-sm text-slate-500">{plan.location}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {plan.occupation} · {plan.profession} · {normalizeLevelLabel(plan.level)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>{formatDate(plan.examDate)}</div>
                    <div className="text-xs text-slate-500">报名截止：{formatDate(plan.registrationDeadline)}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {plan._count?.candidates ?? 0}/{plan.maxCandidates}人
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[plan.status] || 'bg-gray-100 text-gray-700'}`}>
                      {PLAN_STATUS_LABELS[plan.status] || plan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {canManagePlans && plan.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => openEditDialog(plan)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-50 text-slate-700 rounded hover:bg-slate-100 transition-colors"
                            title="编辑草稿"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          <button
                            onClick={() => handlePublish(plan)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                            title="发布计划"
                          >
                            <Send className="w-3.5 h-3.5" />
                            发布
                          </button>
                          <button
                            onClick={() => handleCancel(plan.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                            title="取消空草稿计划"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            取消
                          </button>
                        </>
                      )}
                      {canManagePlans && plan.status === 'PUBLISHED' && (
                        <button
                          onClick={() => handleRollback(plan.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors"
                          title="回退为草稿"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          回退
                        </button>
                      )}
                      {(!canManagePlans || plan.status === 'CANCELLED') && (
                        <span className="text-xs text-slate-400">无操作</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && displayedPlans.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>暂无考评计划</p>
          </div>
        )}
        <PaginationBar
          pagination={pagination}
          meta={paginationMeta}
          visibleCount={displayedPlans.length}
          isLoading={isLoading}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Create/Edit Plan Dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closePlanDialog}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-4">{editingPlan ? '编辑草稿计划' : '新建草稿计划'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">计划标题</label>
                <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：2026年贵金属首饰检验员三级认定" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">考试日期</label>
                  <input type="date" className={inputClass} value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">报名截止日期</label>
                  <input type="date" className={inputClass} value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">职业</label>
                  <select className={inputClass} value={form.occupation} onChange={(e) => updateOccupation(e.target.value)}>
                    {OCCUPATION_OPTIONS.map((item) => <option key={item.occupation} value={item.occupation}>{item.occupation}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">职业工种名称</label>
                  <select className={inputClass} value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })}>
                    {workTypeOptions.map((workType) => <option key={workType} value={workType}>{workType}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">等级</label>
                  <select className={inputClass} value={form.level} onChange={(e) => updateLevel(e.target.value)}>
                    {LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">人数上限</label>
                  <input type="number" className={inputClass} value={form.maxCandidates} onChange={(e) => setForm({ ...form, maxCandidates: parseInt(e.target.value) || 50 })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">考试地点</label>
                <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="如：乌鲁木齐考点" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                <textarea className={inputClass + ' resize-none'} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closePlanDialog} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
              <button
                onClick={handleSave}
                disabled={creating || !form.title || !form.occupation || !form.profession || !form.examDate || !form.registrationDeadline || !form.location}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? '保存中...' : editingPlan ? '保存修改' : '保存草稿'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanMetric(props: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'green' | 'blue' | 'amber' | 'slate';
}) {
  const styles = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-white text-slate-700',
  }[props.tone];
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${styles}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {props.icon}
        {props.label}
      </div>
      <div className="mt-2 text-2xl font-bold">{props.value}</div>
    </div>
  );
}

function getPlanStatusRank(status: string): number {
  const rank: Record<string, number> = {
    PUBLISHED: 0,
    DRAFT: 1,
    CANCELLED: 2,
  };
  return rank[status] ?? 3;
}

function toDateInputValue(value: string): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}
