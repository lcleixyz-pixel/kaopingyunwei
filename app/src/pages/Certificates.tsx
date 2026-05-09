import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { normalizeLevelLabel, type Candidate, type Certificate } from '@/shared';
import { formatDate, formatDateTime } from '@/lib/dateUtils';

interface CertificateRecord extends Certificate {
  candidate: Candidate & {
    plan?: { title: string; profession: string; level: string };
  };
}

const statusLabels: Record<string, string> = {
  PENDING: '待制证',
  PRINTED: '已打印',
  ISSUED: '已发放',
  REISSUE_REQUESTED: '申请补办',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PRINTED: 'bg-blue-100 text-blue-700',
  ISSUED: 'bg-green-100 text-green-700',
  REISSUE_REQUESTED: 'bg-purple-100 text-purple-700',
};

export default function Certificates() {
  const { get, post, patch } = useApi();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [passedCandidates, setPassedCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [certData, candidateData] = await Promise.all([
        get<CertificateRecord[]>('/certificates'),
        get<Candidate[]>('/candidates', { status: 'PASSED' }),
      ]);
      setCertificates(certData);
      setPassedCandidates(candidateData);
    } catch (err: any) {
      setError(err?.message || '获取证书数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createCertificate = async () => {
    if (!candidateId) return;
    setIsCreating(true);
    setError('');
    try {
      await post<CertificateRecord>('/certificates', { candidateId });
      setCandidateId('');
      fetchData();
    } catch (err: any) {
      setError(err?.message || '生成证书失败');
    } finally {
      setIsCreating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await patch<CertificateRecord>(`/certificates/${id}/status`, { status });
      fetchData();
    } catch (err: any) {
      setError(err?.message || '更新证书状态失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            证书管理
          </h1>
          <p className="text-slate-500 mt-1">证书赋码、制证、发放和补办</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 hover:bg-slate-50 rounded-lg font-medium transition-colors">
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-600" />
          生成证书
        </h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            className="min-w-[280px] px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="">选择已合格考生</option>
            {passedCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {normalizeLevelLabel(candidate.applyLevel)}
              </option>
            ))}
          </select>
          <button
            onClick={createCertificate}
            disabled={isCreating || !candidateId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium inline-flex items-center gap-2"
          >
            {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
            生成证书
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
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">证书编号</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">考生</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">计划</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">状态</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">发放日期</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {certificates.map((cert) => (
                <tr key={cert.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-sm text-slate-800">{cert.certNo}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{cert.candidate.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{cert.candidate.plan?.title || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[cert.status]}`}>
                      {statusLabels[cert.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{cert.issueDate ? formatDate(cert.issueDate) : '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 text-sm">
                      {cert.status === 'PENDING' && <button onClick={() => updateStatus(cert.id, 'PRINTED')} className="text-blue-600 hover:text-blue-700 font-medium">标记打印</button>}
                      {cert.status === 'PRINTED' && <button onClick={() => updateStatus(cert.id, 'ISSUED')} className="text-green-600 hover:text-green-700 font-medium">发放</button>}
                      {cert.status === 'ISSUED' && <button onClick={() => updateStatus(cert.id, 'REISSUE_REQUESTED')} className="text-purple-600 hover:text-purple-700 font-medium">补办</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && certificates.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>暂无证书</p>
            <p className="text-xs mt-1">录入合格成绩后可生成证书</p>
          </div>
        )}
      </div>

      {!isLoading && certificates.length > 0 && (
        <p className="text-xs text-slate-400">最后刷新：{formatDateTime(new Date().toISOString())}</p>
      )}
    </div>
  );
}
