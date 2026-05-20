import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Archive as ArchiveIcon,
  CheckCircle2,
  Download,
  Edit3,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  Upload,
  XCircle,
} from 'lucide-react';
import { apiClient, useApi } from '@/hooks/useApi';
import { PageAlert } from '@/components/common/PageAlert';
import { useAuthStore } from '@/stores/authStore';
import {
  formatTenantOfficialName,
  normalizeLevelLabel,
  type ApiResponse,
  type Archive,
  type ArchiveReportBatch,
  type ArchiveReportBatchStatus,
  type ArchiveReportPlan,
  type ExamPlan,
} from '@/shared';
import { formatDate, formatDateTime } from '@/lib/dateUtils';
import { getFriendlyBlobErrorMessage, getFriendlyErrorMessage } from '@/lib/apiError';

type ArchiveRecord = Omit<Archive, 'plan'> & {
  plan?: Pick<ExamPlan, 'id' | 'title' | 'examDate' | 'profession' | 'level'>;
};

const reportStatusLabels: Record<ArchiveReportBatchStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交总部',
  APPROVED: '总部已通过',
  REJECTED: '总部已驳回',
};

const reportStatusClass: Record<ArchiveReportBatchStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const archiveStatusLabels: Record<string, string> = {
  SEALED: '已封存',
  OPENED: '已调阅',
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);
const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm';

export default function Archives() {
  const { get, post, patch } = useApi();
  const { user, tenant } = useAuthStore();
  const [reportablePlans, setReportablePlans] = useState<ArchiveReportPlan[]>([]);
  const [batches, setBatches] = useState<ArchiveReportBatch[]>([]);
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [legacyPlans, setLegacyPlans] = useState<ExamPlan[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [form, setForm] = useState({
    batchNo: '',
    title: '',
    uploadDate: todayInputValue(),
    unitLeader: '',
    informationManager: user?.realName || '',
  });
  const [legacyPlanId, setLegacyPlanId] = useState('');
  const [submitFiles, setSubmitFiles] = useState<Record<string, File | undefined>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const canManageReport = user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';
  const canReviewReport = user?.role === 'SYS_ADMIN' || user?.role === 'HQ_ADMIN';
  const canUseLegacyArchive = user?.role === 'SYS_ADMIN' || user?.role === 'HQ_ADMIN' || user?.role === 'BRANCH_ADMIN';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [planData, batchData, archiveData, planOptions] = await Promise.all([
        get<ArchiveReportPlan[]>('/archives/reportable-plans'),
        get<ArchiveReportBatch[]>('/archives/batches'),
        get<ArchiveRecord[]>('/archives'),
        get<ExamPlan[]>('/exam-plans'),
      ]);
      setReportablePlans(planData);
      setBatches(batchData);
      setArchives(archiveData);
      setLegacyPlans(planOptions);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '获取档案数据失败'));
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!form.informationManager && user?.realName) {
      setForm((current) => ({ ...current, informationManager: user.realName }));
    }
  }, [form.informationManager, user?.realName]);

  const selectedPlans = useMemo(
    () => reportablePlans.filter((plan) => selectedPlanIds.includes(plan.id)),
    [reportablePlans, selectedPlanIds],
  );

  const selectedCompleteCount = selectedPlans.reduce((sum, plan) => sum + plan.completeRecordCount, 0);
  const suggestedTitle = useMemo(() => {
    const tenantName = formatTenantOfficialName(selectedPlans[0]?.tenant || tenant);
    return form.batchNo && tenantName ? `${tenantName}（新增${selectedCompleteCount}条，${form.batchNo}）` : '';
  }, [form.batchNo, selectedCompleteCount, selectedPlans, tenant]);

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((current) => (
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId]
    ));
  };

  const resetForm = () => {
    setEditingBatchId(null);
    setSelectedPlanIds([]);
    setForm({
      batchNo: '',
      title: '',
      uploadDate: todayInputValue(),
      unitLeader: '',
      informationManager: user?.realName || '',
    });
  };

  const startEdit = (batch: ArchiveReportBatch) => {
    setEditingBatchId(batch.id);
    setSelectedPlanIds(batch.planIds || []);
    setForm({
      batchNo: batch.batchNo,
      title: batch.title,
      uploadDate: String(batch.uploadDate || '').slice(0, 10) || todayInputValue(),
      unitLeader: batch.unitLeader,
      informationManager: batch.informationManager,
    });
  };

  const saveBatch = async () => {
    if (!canManageReport) return;
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        planIds: selectedPlanIds,
        batchNo: form.batchNo,
        title: form.title || suggestedTitle,
        uploadDate: form.uploadDate,
        unitLeader: form.unitLeader,
        informationManager: form.informationManager,
      };
      if (editingBatchId) {
        await patch<ArchiveReportBatch>(`/archives/batches/${editingBatchId}`, payload);
      } else {
        await post<ArchiveReportBatch>('/archives/batches', payload);
      }
      resetForm();
      fetchData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '保存证书上报批次失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const submitBatch = async (batchId: string) => {
    const file = submitFiles[batchId];
    if (!file) {
      setError('请先选择签字盖章后的表5文件');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const data = new FormData();
      data.append('signedFile', file);
      await apiClient.post<ApiResponse<ArchiveReportBatch>>(`/archives/batches/${batchId}/submit`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitFiles((current) => ({ ...current, [batchId]: undefined }));
      fetchData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '提交总部失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const reviewBatch = async (batchId: string, approved: boolean) => {
    setIsSaving(true);
    setError('');
    try {
      await post<ArchiveReportBatch>(`/archives/batches/${batchId}/review`, {
        approved,
        reviewNotes: reviewNotes[batchId] || '',
      });
      setReviewNotes((current) => ({ ...current, [batchId]: '' }));
      fetchData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '总部审批失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const sealArchive = async () => {
    if (!legacyPlanId) return;
    setIsSaving(true);
    setError('');
    try {
      await post<ArchiveRecord>('/archives', { planId: legacyPlanId });
      setLegacyPlanId('');
      fetchData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '封存档案失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const updateArchiveStatus = async (id: string, status: 'SEALED' | 'OPENED') => {
    try {
      await patch<ArchiveRecord>(`/archives/${id}/status`, { status });
      fetchData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, '更新档案状态失败'));
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await apiClient.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(await getFriendlyBlobErrorMessage(err, '下载失败'));
    }
  };

  const readyPlanCount = reportablePlans.filter((plan) => plan.completeRecordCount > 0 && !plan.activeBatch).length;
  const submittedCount = batches.filter((batch) => batch.status === 'SUBMITTED').length;
  const approvedCount = batches.filter((batch) => batch.status === 'APPROVED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            档案管理
          </h1>
          <p className="text-slate-500 mt-1">证书数据上报批次、表5打印盖章、总部审核与历史封存</p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {error && <PageAlert tone="error">{error}</PageAlert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="待报备计划" value={readyPlanCount} tone="blue" />
        <MetricCard label="总部待审" value={submittedCount} tone="amber" />
        <MetricCard label="已通过批次" value={approvedCount} tone="green" />
      </div>

      {canManageReport && (
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <FileCheck2 className="w-5 h-5 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">先线下报备获取批次号</p>
              <p className="mt-1">选择已进入证书管理节点且证书编号、证书版面发证日期完整的计划，填写批次号后生成表5和总部数据表。</p>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-slate-900 mb-3">待上报计划</h2>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left">选择</th>
                    <th className="px-3 py-2 text-left">计划</th>
                    <th className="px-3 py-2 text-left">职业/工种/等级</th>
                    <th className="px-3 py-2 text-left">完整记录</th>
                    <th className="px-3 py-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportablePlans.map((plan) => {
                    const disabled = plan.completeRecordCount === 0 || Boolean(plan.activeBatch && plan.activeBatch.id !== editingBatchId);
                    return (
                      <tr key={plan.id} className={disabled ? 'bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedPlanIds.includes(plan.id)}
                            disabled={disabled}
                            onChange={() => togglePlan(plan.id)}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-900">{plan.title}</p>
                          <p className="text-xs text-slate-500">{formatDate(plan.examDate)}</p>
                        </td>
                        <td className="px-3 py-3">{plan.occupation} / {plan.profession} / {normalizeLevelLabel(plan.level)}</td>
                        <td className="px-3 py-3 font-semibold">{plan.completeRecordCount}</td>
                        <td className="px-3 py-3">
                          {plan.activeBatch ? (
                            <span className="text-xs text-slate-600">已在批次：{plan.activeBatch.title}</span>
                          ) : plan.reminder ? (
                            <span className="text-xs text-amber-700">{plan.reminder}</span>
                          ) : (
                            <span className="text-xs text-slate-400">暂无完整证书记录</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <Field label="批次号">
              <input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} className={inputClass} placeholder="如 251120S..." />
            </Field>
            <Field label="上传日期">
              <input type="date" value={form.uploadDate} onChange={(e) => setForm({ ...form, uploadDate: e.target.value })} className={inputClass} />
            </Field>
            <Field label="单位负责人">
              <input value={form.unitLeader} onChange={(e) => setForm({ ...form, unitLeader: e.target.value })} className={inputClass} />
            </Field>
            <Field label="信息管理员">
              <input value={form.informationManager} onChange={(e) => setForm({ ...form, informationManager: e.target.value })} className={inputClass} />
            </Field>
            <div className="flex items-end gap-2">
              <button onClick={saveBatch} disabled={isSaving || selectedPlanIds.length === 0 || !form.batchNo || !form.unitLeader || !form.informationManager} className="h-10 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium inline-flex items-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                {editingBatchId ? '保存批次' : '创建批次'}
              </button>
              {editingBatchId && (
                <button onClick={resetForm} className="h-10 px-3 border border-slate-300 rounded-lg text-slate-600">取消</button>
              )}
            </div>
          </div>
          <Field label="标题名称">
            <div className="flex flex-col md:flex-row gap-2">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${inputClass} flex-1`} placeholder={suggestedTitle || '创建时可留空，系统按机构、人数、批次号生成'} />
              <button onClick={() => setForm({ ...form, title: suggestedTitle })} disabled={!suggestedTitle} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 disabled:text-slate-300">
                使用建议标题
              </button>
            </div>
          </Field>
        </section>
      )}

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            证书上报批次
          </h2>
        </div>
        {isLoading ? (
          <LoadingBlock />
        ) : batches.length === 0 ? (
          <EmptyBlock icon={<ArchiveIcon className="w-10 h-10 text-slate-300" />} title="暂无证书上报批次" subtitle="分支创建批次后，可下载表5和总部数据表" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">批次</th>
                  <th className="px-4 py-3 text-left">机构</th>
                  <th className="px-4 py-3 text-left">计划/人数</th>
                  <th className="px-4 py-3 text-left">盖章件</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left min-w-[360px]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((batch) => (
                  <tr key={batch.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{batch.title}</p>
                      <p className="text-xs text-slate-500 mt-1">批次号：{batch.batchNo}</p>
                      <p className="text-xs text-slate-500">上传日期：{formatDate(batch.uploadDate)}</p>
                    </td>
                    <td className="px-4 py-4">{batch.tenant?.name || '-'}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{batch.recordCount} 条</p>
                      <p className="text-xs text-slate-500 mt-1">{batch.plans?.map((plan) => plan.title).join('、') || '-'}</p>
                      {batch.summaryRows && batch.summaryRows.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">{batch.summaryRows.map((row) => `${row.profession}${row.level}${row.quantity}人`).join('；')}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {batch.signedFile ? (
                        <button onClick={() => downloadFile(`/archives/batches/${batch.id}/signed-file`, batch.signedFile?.originalName || '表5盖章件')} className="text-blue-600 hover:text-blue-700 font-medium">
                          {batch.signedFile.originalName || '下载盖章件'}
                        </button>
                      ) : (
                        <span className="text-slate-400">未上传</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${reportStatusClass[batch.status]}`}>
                        {reportStatusLabels[batch.status]}
                      </span>
                      {batch.reviewNotes && <p className="text-xs text-slate-500 mt-2">意见：{batch.reviewNotes}</p>}
                    </td>
                    <td className="px-4 py-4 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <SmallButton icon={<Download className="w-3.5 h-3.5" />} onClick={() => downloadFile(`/archives/batches/${batch.id}/table5.pdf`, `表5-职业技能等级证书数据审核确认表-${batch.batchNo}.pdf`)}>表5 PDF</SmallButton>
                        <SmallButton icon={<FileSpreadsheet className="w-3.5 h-3.5" />} onClick={() => downloadFile(`/archives/batches/${batch.id}/data.xlsx`, `${batch.title}.xlsx`)}>数据表</SmallButton>
                        {canManageReport && ['DRAFT', 'REJECTED'].includes(batch.status) && (
                          <SmallButton icon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => startEdit(batch)}>编辑</SmallButton>
                        )}
                      </div>
                      {canManageReport && ['DRAFT', 'REJECTED'].includes(batch.status) && (
                        <div className="flex flex-col md:flex-row gap-2">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            onChange={(e) => setSubmitFiles((current) => ({ ...current, [batch.id]: e.target.files?.[0] }))}
                            className="text-xs"
                          />
                          <button onClick={() => submitBatch(batch.id)} disabled={isSaving || !submitFiles[batch.id]} className="px-3 py-1.5 bg-blue-600 disabled:bg-blue-300 text-white rounded-lg inline-flex items-center gap-1 text-xs font-medium">
                            <Upload className="w-3.5 h-3.5" />
                            上传盖章件并提交
                          </button>
                        </div>
                      )}
                      {canReviewReport && batch.status === 'SUBMITTED' && (
                        <div className="space-y-2">
                          <input value={reviewNotes[batch.id] || ''} onChange={(e) => setReviewNotes({ ...reviewNotes, [batch.id]: e.target.value })} className={`${inputClass} text-xs`} placeholder="审批意见，可选" />
                          <div className="flex gap-2">
                            <button onClick={() => reviewBatch(batch.id, true)} disabled={isSaving} className="px-3 py-1.5 bg-green-600 text-white rounded-lg inline-flex items-center gap-1 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              通过
                            </button>
                            <button onClick={() => reviewBatch(batch.id, false)} disabled={isSaving} className="px-3 py-1.5 bg-red-600 text-white rounded-lg inline-flex items-center gap-1 text-xs font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              驳回
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canUseLegacyArchive && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-slate-600" />
              历史封存档案
            </h2>
            <p className="text-sm text-slate-500 mt-1">保留原有计划档案封存与调阅能力</p>
          </div>
          <div className="p-5 flex flex-wrap gap-3">
            <select value={legacyPlanId} onChange={(e) => setLegacyPlanId(e.target.value)} className="min-w-[320px] px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm">
              <option value="">选择考评计划</option>
              {legacyPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.title} · {plan.profession} · {normalizeLevelLabel(plan.level)}</option>
              ))}
            </select>
            <button onClick={sealArchive} disabled={isSaving || !legacyPlanId} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg font-medium inline-flex items-center gap-2">
              <Send className="w-4 h-4" />
              生成封存档案
            </button>
          </div>
          {archives.length > 0 && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-3">计划</th>
                    <th className="text-left px-5 py-3">文件路径</th>
                    <th className="text-left px-5 py-3">大小</th>
                    <th className="text-left px-5 py-3">状态</th>
                    <th className="text-left px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {archives.map((archive) => (
                    <tr key={archive.id}>
                      <td className="px-5 py-3 font-medium">{archive.plan?.title || '-'}</td>
                      <td className="px-5 py-3 text-slate-500">{archive.filePath}</td>
                      <td className="px-5 py-3 text-slate-500">{formatBytes(archive.fileSize)}</td>
                      <td className="px-5 py-3">{archiveStatusLabels[archive.status]}</td>
                      <td className="px-5 py-3">
                        {archive.status === 'SEALED' ? (
                          <button onClick={() => updateArchiveStatus(archive.id, 'OPENED')} className="text-amber-600 font-medium">调阅</button>
                        ) : (
                          <button onClick={() => updateArchiveStatus(archive.id, 'SEALED')} className="text-green-600 font-medium">重新封存</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <p className="text-xs text-slate-400">最后刷新：{formatDateTime(new Date().toISOString())}</p>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'amber' | 'green' }) {
  const toneClass = {
    blue: 'text-blue-700 bg-blue-50 border-blue-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
    green: 'text-green-700 bg-green-50 border-green-100',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function SmallButton({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 text-xs font-medium">
      {icon}
      {children}
    </button>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      <span className="ml-3 text-slate-500">加载中...</span>
    </div>
  );
}

function EmptyBlock({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <div className="flex justify-center mb-2">{icon}</div>
      <p>{title}</p>
      <p className="text-xs mt-1">{subtitle}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
