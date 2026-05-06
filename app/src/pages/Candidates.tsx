import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Download, Loader2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import type { Candidate, ExamPlan } from '@/shared';
import { formatDate } from '@/lib/dateUtils';

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXAMINED: 'bg-blue-100 text-blue-700',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  EXAMINED: '已考试',
  PASSED: '已通过',
  FAILED: '未通过',
};

interface AddCandidateForm {
  planId: string;
  name: string;
  idCard: string;
  phone: string;
  gender: string;
  education: string;
  workYears: number;
  applyLevel: string;
}

const emptyForm: AddCandidateForm = {
  planId: '',
  name: '',
  idCard: '',
  phone: '',
  gender: 'M',
  education: '大专',
  workYears: 3,
  applyLevel: '3',
};

export default function Candidates() {
  const { get, post } = useApi();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddCandidateForm>(emptyForm);
  const [adding, setAdding] = useState(false);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      const data = await get<Candidate[]>('/candidates', params);
      setCandidates(data);
    } catch (err: any) {
      setError(err?.message || '获取考生列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [get, searchQuery]);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await get<ExamPlan[]>('/exam-plans');
      setPlans(data);
    } catch { /* ignore */ }
  }, [get]);

  useEffect(() => {
    fetchCandidates();
    fetchPlans();
  }, [fetchCandidates, fetchPlans]);

  const handleAdd = async () => {
    if (!form.planId || !form.name || !form.idCard || !form.applyLevel) return;
    setAdding(true);
    try {
      await post<Candidate>('/candidates', form);
      setShowAdd(false);
      setForm(emptyForm);
      fetchCandidates();
    } catch (err: any) {
      setError(err?.message || '添加考生失败');
    } finally {
      setAdding(false);
    }
  };

  const handleApprove = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await post(`/candidates/${id}/approve`, { status });
      fetchCandidates();
    } catch (err: any) {
      setError(err?.message || '审核失败');
    }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            考生管理
          </h1>
          <p className="text-slate-500 mt-1">管理考生报名、审核和考试安排</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors">
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加考生
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="搜索姓名、身份证号..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

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
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">姓名</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">身份证号</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">申报等级</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">学历/工龄</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">考场/座位</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">状态</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">报名时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{c.idCard}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{c.applyLevel}级</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{c.education || '-'} / {c.workYears ? `${c.workYears}年` : '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{c.examRoom || '-'} / {c.seatNo || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                      {c.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleApprove(c.id, 'APPROVED')} className="text-xs text-green-600 hover:text-green-700 font-medium">通过</button>
                          <button onClick={() => handleApprove(c.id, 'REJECTED')} className="text-xs text-red-600 hover:text-red-700 font-medium">驳回</button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && candidates.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>暂无考生</p>
          </div>
        )}
      </div>

      {/* Add Candidate Dialog */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-4">添加考生</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">考评计划</label>
                <select className={inputClass} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                  <option value="">请选择计划</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                  <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="考生姓名" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">性别</label>
                  <select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="M">男</option>
                    <option value="F">女</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">身份证号</label>
                  <input className={inputClass} value={form.idCard} onChange={(e) => setForm({ ...form, idCard: e.target.value })} placeholder="18位身份证号" maxLength={18} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">手机号</label>
                  <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="手机号" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">学历</label>
                  <select className={inputClass} value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })}>
                    {['初中', '高中', '中专', '大专', '本科', '硕士'].map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">工龄(年)</label>
                  <input type="number" className={inputClass} value={form.workYears} onChange={(e) => setForm({ ...form, workYears: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">申报等级</label>
                  <select className={inputClass} value={form.applyLevel} onChange={(e) => setForm({ ...form, applyLevel: e.target.value })}>
                    {['1', '2', '3', '4', '5'].map((l) => <option key={l} value={l}>{l}级</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
              <button
                onClick={handleAdd}
                disabled={adding || !form.planId || !form.name || !form.idCard}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                {adding ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
