import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Search, Filter, Loader2, Pencil, Send, RotateCcw, XCircle } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getWorkTypesForOccupation, LEVEL_OPTIONS, normalizeLevelLabel, OCCUPATION_OPTIONS, type ExamPlan } from '@/shared';
import { PLAN_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/dateUtils';
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
  const { get, post, patch } = useApi();
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<ExamPlan[]>([]);
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
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      const data = await get<ExamPlan[]>('/exam-plans', params);
      setPlans(data);
    } catch (err: any) {
      setError(err?.message || '获取计划列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [get, statusFilter, searchQuery]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const displayedPlans = statusFilter === 'ALL'
    ? [...plans].sort((a, b) => getPlanStatusRank(a.status) - getPlanStatusRank(b.status) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : plans;

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
      setError(err?.message || (editingPlan ? '保存失败' : '创建失败'));
    } finally {
      setCreating(false);
    }
  };

  const canManagePlans = user?.role === 'SYS_ADMIN' || user?.role === 'BRANCH_ADMIN';

  const handlePublish = async (planId: string) => {
    try {
      await patch(`/exam-plans/${planId}/publish`);
      fetchPlans();
    } catch (err: any) {
      setError(err?.message || '发布失败');
    }
  };

  const handleCancel = async (planId: string) => {
    const reason = window.prompt('请输入取消备注（草稿计划且无考生时才可取消）')?.trim() || '';
    if (!reason) {
      setError('取消计划必须填写备注');
      return;
    }
    try {
      await patch(`/exam-plans/${planId}/cancel`, { reason });
      fetchPlans();
    } catch (err: any) {
      setError(err?.message || '取消失败');
    }
  };

  const handleRollback = async (planId: string) => {
    const ok = window.confirm('回退后，该计划下所有正式考生会转回意向考生“跟进中”，正式考生记录会被移除。确定回退到草稿吗？');
    if (!ok) return;
    try {
      await patch(`/exam-plans/${planId}/rollback`, { reason: '页面操作回退至草稿' });
      fetchPlans();
    } catch (err: any) {
      setError(err?.message || '回退失败');
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

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索计划名称、职业、工种..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          {['PUBLISHED', 'DRAFT', 'ALL', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-slate-500">加载中...</span>
          </div>
        ) : (
          <table className="w-full">
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
                            onClick={() => handlePublish(plan.id)}
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
