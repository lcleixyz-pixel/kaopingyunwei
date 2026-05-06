import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Search, Filter, Eye, Loader2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import type { ExamPlan } from '@/shared';
import { PLAN_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/dateUtils';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const examTypeLabels: Record<string, string> = {
  THEORY: '理论',
  PRACTICE: '实操',
  COMPREHENSIVE: '综合',
};

interface CreatePlanForm {
  title: string;
  examDate: string;
  profession: string;
  level: string;
  examType: string;
  location: string;
  maxCandidates: number;
  notes: string;
}

const emptyForm: CreatePlanForm = {
  title: '',
  examDate: '',
  profession: '',
  level: '3',
  examType: 'COMPREHENSIVE',
  location: '',
  maxCandidates: 50,
  notes: '',
};

export default function ExamPlans() {
  const { get, post, patch } = useApi();
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreate, setShowCreate] = useState(false);
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

  const handleCreate = async () => {
    if (!form.title || !form.examDate || !form.profession || !form.location) return;
    setCreating(true);
    try {
      await post<ExamPlan>('/exam-plans', {
        ...form,
        examDate: new Date(form.examDate).toISOString(),
      });
      setShowCreate(false);
      setForm(emptyForm);
      fetchPlans();
    } catch (err: any) {
      setError(err?.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (planId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await patch(`/exam-plans/${planId}/approve`, { status });
      fetchPlans();
    } catch (err: any) {
      setError(err?.message || '审批失败');
    }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            考评计划
          </h1>
          <p className="text-slate-500 mt-1">管理所有考评计划，创建和审批认定方案</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建计划
        </button>
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
            placeholder="搜索计划名称、工种..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          {['ALL', 'PENDING', 'APPROVED', 'PUBLISHED'].map((s) => (
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
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">人数</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{plan.title}</div>
                    <div className="text-sm text-slate-500">{plan.location}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {plan.profession} · {plan.level}级 · {examTypeLabels[plan.examType] || plan.examType}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {formatDate(plan.examDate)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {plan.maxCandidates}人
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[plan.status] || 'bg-gray-100 text-gray-700'}`}>
                      {PLAN_STATUS_LABELS[plan.status] || plan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors" title="查看">
                        <Eye className="w-4 h-4" />
                      </button>
                      {plan.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(plan.id, 'APPROVED')}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                          >
                            通过
                          </button>
                          <button
                            onClick={() => handleApprove(plan.id, 'REJECTED')}
                            className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                          >
                            驳回
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && plans.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>暂无考评计划</p>
          </div>
        )}
      </div>

      {/* Create Plan Dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-4">新建考评计划</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">计划标题</label>
                <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：2026年Q2电工等级认定" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">考试日期</label>
                  <input type="date" className={inputClass} value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">工种</label>
                  <input className={inputClass} value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} placeholder="如：电工" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">等级</label>
                  <select className={inputClass} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                    {['1', '2', '3', '4', '5'].map((l) => <option key={l} value={l}>{l}级</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">认定方式</label>
                  <select className={inputClass} value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })}>
                    <option value="THEORY">理论</option>
                    <option value="PRACTICE">实操</option>
                    <option value="COMPREHENSIVE">综合</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">人数上限</label>
                  <input type="number" className={inputClass} value={form.maxCandidates} onChange={(e) => setForm({ ...form, maxCandidates: parseInt(e.target.value) || 50 })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">考试地点</label>
                <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="如：总部考场A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                <textarea className={inputClass + ' resize-none'} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.title || !form.examDate || !form.profession || !form.location}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
