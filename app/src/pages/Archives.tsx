import { useCallback, useEffect, useState } from 'react';
import { Archive as ArchiveIcon, FileText, Loader2, Lock, Unlock } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { normalizeLevelLabel, type Archive, type ExamPlan } from '@/shared';
import { formatDateTime } from '@/lib/dateUtils';

type ArchiveRecord = Omit<Archive, 'plan'> & {
  plan?: Pick<ExamPlan, 'id' | 'title' | 'examDate' | 'profession' | 'level'>;
};

const statusLabels: Record<string, string> = {
  SEALED: '已封存',
  OPENED: '已调阅',
};

export default function Archives() {
  const { get, post, patch } = useApi();
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [archiveData, planData] = await Promise.all([
        get<ArchiveRecord[]>('/archives'),
        get<ExamPlan[]>('/exam-plans'),
      ]);
      setArchives(archiveData);
      setPlans(planData);
    } catch (err: any) {
      setError(err?.message || '获取档案数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sealArchive = async () => {
    if (!planId) return;
    setIsCreating(true);
    setError('');
    try {
      await post<ArchiveRecord>('/archives', { planId });
      setPlanId('');
      fetchData();
    } catch (err: any) {
      setError(err?.message || '封存档案失败');
    } finally {
      setIsCreating(false);
    }
  };

  const updateStatus = async (id: string, status: 'SEALED' | 'OPENED') => {
    try {
      await patch<ArchiveRecord>(`/archives/${id}/status`, { status });
      fetchData();
    } catch (err: any) {
      setError(err?.message || '更新档案状态失败');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          档案管理
        </h1>
        <p className="text-slate-500 mt-1">档案归档、封存、检索和调阅</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-600" />
          封存考评档案
        </h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="min-w-[320px] px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="">选择考评计划</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title} · {plan.profession} · {normalizeLevelLabel(plan.level)}
              </option>
            ))}
          </select>
          <button
            onClick={sealArchive}
            disabled={isCreating || !planId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium inline-flex items-center gap-2"
          >
            {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
            生成封存档案
          </button>
        </div>
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
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">计划</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">文件路径</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">大小</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">封存哈希</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">状态</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {archives.map((archive) => (
                <tr key={archive.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{archive.plan?.title || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{archive.filePath}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{formatBytes(archive.fileSize)}</td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">{archive.sealHash.slice(0, 16)}...</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      archive.status === 'SEALED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {archive.status === 'SEALED' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {statusLabels[archive.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {archive.status === 'SEALED' ? (
                      <button onClick={() => updateStatus(archive.id, 'OPENED')} className="text-sm text-amber-600 hover:text-amber-700 font-medium">调阅</button>
                    ) : (
                      <button onClick={() => updateStatus(archive.id, 'SEALED')} className="text-sm text-green-600 hover:text-green-700 font-medium">重新封存</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && archives.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <ArchiveIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>暂无档案</p>
            <p className="text-xs mt-1">完成认定后可封存计划档案</p>
          </div>
        )}
      </div>

      {!isLoading && archives.length > 0 && (
        <p className="text-xs text-slate-400">最后刷新：{formatDateTime(new Date().toISOString())}</p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
