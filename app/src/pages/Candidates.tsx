import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Download, FileCheck2, Loader2, Pencil, Plus, Search, Upload, Users, XCircle } from 'lucide-react';
import { apiClient, useApi } from '@/hooks/useApi';
import {
  ALL_MATERIALS,
  DEFAULT_MATERIALS,
  CANDIDATE_SOURCE_OPTIONS,
  EDUCATION_OPTIONS,
  ETHNICITY_OPTIONS,
  EXAM_TYPE_OPTIONS,
  LEVEL_OPTIONS,
  PROVINCE_OPTIONS,
  RECOGNITION_CATEGORY_OPTIONS,
  REGISTRATION_ORGANIZATION_OPTIONS,
  getApplicationConditionsForLevel,
  type Candidate,
  type CandidateRegistrationProfile,
  type ExamPlan,
  type LocalUploadBatch,
  type PaymentStatus,
} from '@/shared';
import { formatDate } from '@/lib/dateUtils';
import { getCandidateManagementPlanOptions, shouldLoadCandidatesForPlan } from '@/lib/candidateManagementRules';
import { useAuthStore } from '@/stores/authStore';

const templateHeaders = [
  '序号',
  '职业工种名称',
  '认定等级',
  '申报条件',
  '证件类型',
  '证件号码',
  '姓名',
  '性别',
  '出生日期',
  '手机号码',
  '是否有职业资格证书',
  '证书等级',
  '证书编号',
  '文化程度',
  '所在省（市）区',
  '考生来源',
  '所在单位',
  '报名单位',
  '认定分类',
  '专业',
  '考试类型',
  '民族',
  '参加工作时间',
  '电子邮箱',
  '专业年限',
  '户籍所在地',
  '政治面貌',
  '学历证书编号',
  '简要经历',
  '通讯地址',
  '证书领取方式',
  '邮政编码',
  '邮寄地址',
];

const statusLabels: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  EXAMINED: '已考试',
  PASSED: '已通过',
  FAILED: '未通过',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXAMINED: 'bg-blue-100 text-blue-700',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

interface ProfileForm {
  planId: string;
  registrationFields: Record<string, string>;
  materials: Record<string, boolean>;
  paymentStatus: PaymentStatus;
}

function createEmptyFields(): Record<string, string> {
  return Object.fromEntries(templateHeaders.map((header) => [header, '']));
}

function createEmptyMaterials(): Record<string, boolean> {
  return Object.fromEntries(ALL_MATERIALS.map((item) => [item.key, false]));
}

const emptyForm: ProfileForm = {
  planId: '',
  registrationFields: createEmptyFields(),
  materials: createEmptyMaterials(),
  paymentStatus: 'UNPAID',
};

export default function Candidates() {
  const { get, post } = useApi();
  const { user } = useAuthStore();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [uploadBatches, setUploadBatches] = useState<LocalUploadBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadSaving, setUploadSaving] = useState(false);

  const canCreate = user?.role === 'SYS_ADMIN' || user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';
  const canEditProfiles = user?.role === 'SYS_ADMIN' || user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';
  const canApprove = user?.role === 'BRANCH_ADMIN';
  const canBackfillUpload = user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';
  const canUsePayment = user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';
  const canViewPayment = canUsePayment || candidates.some((candidate) => candidate.registrationProfile?.paymentStatus);

  const planOptions = useMemo(() => getCandidateManagementPlanOptions(plans), [plans]);
  const selectedPlan = useMemo(
    () => planOptions.find((plan) => plan.id === selectedPlanId),
    [planOptions, selectedPlanId],
  );
  const registrationClosed = Boolean(selectedPlan?.registrationClosed);
  const applicationConditions = useMemo(
    () => getApplicationConditionsForLevel(form.registrationFields.认定等级),
    [form.registrationFields.认定等级],
  );
  const selectedApplicationCondition = useMemo(
    () => applicationConditions.find((condition) => condition.label === form.registrationFields.申报条件),
    [applicationConditions, form.registrationFields.申报条件],
  );

  useEffect(() => {
    if (selectedPlanId && plans.length > 0 && !planOptions.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId('');
    }
  }, [plans.length, planOptions, selectedPlanId]);

  const emptyStateText = useMemo(
    () => shouldLoadCandidatesForPlan(selectedPlanId) ? '当前计划暂无考生' : '请先选择一个已发布考评计划',
    [plans, selectedPlanId],
  );

  const fetchCandidates = useCallback(async () => {
    if (!shouldLoadCandidatesForPlan(selectedPlanId)) {
      setCandidates([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      params.planId = selectedPlanId;
      const data = await get<Candidate[]>('/candidates', params);
      setCandidates(data);
    } catch (err) {
      setError(getErrorMessage(err, '获取考生列表失败'));
    } finally {
      setIsLoading(false);
    }
  }, [get, searchQuery, selectedPlanId]);

  const fetchPlans = useCallback(async () => {
    try {
      setPlans(await get<ExamPlan[]>('/exam-plans', { status: 'PUBLISHED' }));
    } catch {
      setPlans([]);
    }
  }, [get]);

  const fetchUploadBatches = useCallback(async () => {
    if (!selectedPlanId) {
      setUploadBatches([]);
      return;
    }
    try {
      setUploadBatches(await get<LocalUploadBatch[]>(`/exam-plans/${selectedPlanId}/local-upload-batches`));
    } catch {
      setUploadBatches([]);
    }
  }, [get, selectedPlanId]);

  useEffect(() => {
    fetchCandidates();
    fetchPlans();
  }, [fetchCandidates, fetchPlans]);

  useEffect(() => {
    fetchUploadBatches();
  }, [fetchUploadBatches]);

  const openCreate = () => {
    if (!shouldLoadCandidatesForPlan(selectedPlanId)) {
      setError('请先选择一个已发布考评计划');
      return;
    }
    if (registrationClosed) {
      setError('该计划考试报名阶段已结束，不能继续新增考生');
      return;
    }

    const nextFields = applyPlanDefaults(selectedPlan, createEmptyFields());
    setEditingCandidate(null);
    setForm({
      planId: selectedPlanId,
      registrationFields: nextFields,
      materials: createEmptyMaterials(),
      paymentStatus: 'UNPAID',
    });
    setShowProfile(true);
  };

  const openEdit = async (candidate: Candidate) => {
    setError('');
    try {
      const profile = await get<CandidateRegistrationProfile>(`/candidates/${candidate.id}/registration-profile`);
      setEditingCandidate(candidate);
      setForm({
        planId: candidate.planId,
        registrationFields: profile.registrationFields,
        materials: { ...createEmptyMaterials(), ...profile.materials },
        paymentStatus: profile.paymentStatus || 'UNPAID',
      });
      setShowProfile(true);
    } catch (err) {
      setError(getErrorMessage(err, '获取报名资料失败'));
    }
  };

  const updatePlan = (planId: string) => {
    const plan = plans.find((item) => item.id === planId);
    setForm((current) => ({
      ...current,
      planId,
      registrationFields: applyPlanDefaults(plan, current.registrationFields),
    }));
  };

  const updateField = (field: string, value: string) => {
    setForm((current) => ({
      ...current,
      registrationFields: updateRegistrationField(current.registrationFields, field, value),
    }));
  };

  const toggleMaterial = (key: string) => {
    setForm((current) => ({
      ...current,
      materials: {
        ...current.materials,
        [key]: !current.materials[key],
      },
    }));
  };

  const handleSaveProfile = async () => {
    if (
      editingCandidate?.status === 'APPROVED'
      && !window.confirm('该考生资料已审核通过。保存前请确认本地业务系统中的信息已同步保持一致，是否继续保存？')
    ) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingCandidate) {
        await apiClient.put(`/candidates/${editingCandidate.id}/registration-profile`, {
          registrationFields: form.registrationFields,
          materials: form.materials,
          paymentStatus: form.paymentStatus,
        });
      } else {
        await post('/candidates', buildCreatePayload(form));
      }
      setShowProfile(false);
      setEditingCandidate(null);
      await fetchCandidates();
    } catch (err) {
      setError(getErrorMessage(err, '保存报名资料失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setError('');
    try {
      await post(`/candidates/${id}/approve`, { status });
      await fetchCandidates();
    } catch (err) {
      setError(getErrorMessage(err, '审核失败'));
    }
  };

  const handleExport = async () => {
    if (!selectedPlanId) {
      setError('请先选择一个考评计划再导出');
      return;
    }

    setExporting(true);
    setError('');
    try {
      const response = await apiClient.get('/candidates/export', {
        params: { planId: selectedPlanId },
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${selectedPlan?.title || '考生信息模板'}-考生信息模板.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(await getBlobErrorMessage(err, '导出失败'));
    } finally {
      setExporting(false);
    }
  };

  const handleUploadBackfill = async () => {
    if (!selectedPlanId) {
      setError('请先选择一个考评计划再回填上传状态');
      return;
    }
    setUploadNotes('');
    setShowUploadDialog(true);
  };

  const submitUploadBackfill = async (completeRegistrationNode: boolean) => {
    const defaultNotes = completeRegistrationNode
      ? '已上传当地上级部门业务系统，并结束考试报名阶段'
      : '已上传当地上级部门业务系统，报名暂不截止';
    setError('');
    setUploadSaving(true);
    try {
      await post(`/exam-plans/${selectedPlanId}/local-upload-batches`, {
        status: 'UPLOADED',
        uploadedAt: new Date().toISOString(),
        notes: uploadNotes.trim() || defaultNotes,
        completeRegistrationNode,
      });
      setShowUploadDialog(false);
      setUploadNotes('');
      await fetchUploadBatches();
      await fetchPlans();
      await fetchCandidates();
    } catch (err) {
      setError(getErrorMessage(err, '保存上传回填失败'));
    } finally {
      setUploadSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm';
  const fieldGroups = chunk(templateHeaders.filter((header) => header !== '序号'), 3);
  const latestUpload = uploadBatches[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            报名资料工作台
          </h1>
          <p className="text-slate-500 mt-1">按新疆中和鉴-乌鲁木齐考点模板整理 33 项考生资料</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting || !selectedPlanId}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-lg font-medium transition-colors"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            导出 .xls
          </button>
          {canBackfillUpload && (
            <button
              onClick={handleUploadBackfill}
              disabled={!selectedPlanId}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-lg font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              上传回填
            </button>
          )}
          {canCreate && (
            <button
              onClick={openCreate}
              disabled={!shouldLoadCandidatesForPlan(selectedPlanId) || registrationClosed}
              title={registrationClosed ? '考试报名阶段已结束' : undefined}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增考生
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedPlanId}
            onChange={(event) => setSelectedPlanId(event.target.value)}
            className="min-w-72 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="">请选择已发布考评计划</option>
            {planOptions.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title}{plan.registrationClosed ? '（报名已结束）' : ''}
              </option>
            ))}
          </select>
          <div className="relative max-w-sm flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索姓名..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          {latestUpload ? (
            <span>最近上传：{formatDate(latestUpload.uploadedAt)} {latestUpload.notes || ''}</span>
          ) : registrationClosed ? (
            <span>考试报名阶段已结束</span>
          ) : (
            <span>尚未回填地方系统上传状态</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-slate-500">加载中...</span>
          </div>
        ) : (
          <table className="w-full min-w-[1040px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">姓名</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">计划</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">证件号码</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">模板资料</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">材料</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">审核</th>
                {canViewPayment && <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">缴费</th>}
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((candidate) => {
                const profile = candidate.registrationProfile;
                const completeness = profile?.completeness;
                return (
                  <tr key={candidate.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{candidate.name}</div>
                      <div className="text-xs text-slate-500">{candidate.phone || '-'}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{candidate.plan?.title || '-'}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 font-mono">{candidate.idCard}</td>
                    <td className="px-5 py-4">
                      <CompletenessBadge complete={Boolean(completeness?.templateComplete)} emptyText={`${completeness?.missingFields.length || 0}项待补`} />
                    </td>
                    <td className="px-5 py-4">
                      <CompletenessBadge complete={Boolean(completeness?.materialComplete)} emptyText={`${completeness?.missingMaterials.length || 0}项待补`} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[candidate.status] || 'bg-gray-100 text-gray-700'}`}>
                          {statusLabels[candidate.status] || candidate.status}
                        </span>
                        {canApprove && candidate.status === 'PENDING' && (
                          <>
                            <button onClick={() => handleApprove(candidate.id, 'APPROVED')} className="text-xs text-green-600 hover:text-green-700 font-medium">通过</button>
                            <button onClick={() => handleApprove(candidate.id, 'REJECTED')} className="text-xs text-red-600 hover:text-red-700 font-medium">驳回</button>
                          </>
                        )}
                      </div>
                    </td>
                    {canViewPayment && (
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {profile?.paymentStatus === 'PAID' ? '已缴' : '未缴'}
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openEdit(candidate)}
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Pencil className="w-4 h-4" />
                        资料
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!isLoading && candidates.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>{emptyStateText}</p>
          </div>
        )}
      </div>

      {showProfile && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowProfile(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editingCandidate ? '编辑报名资料' : '新增考生报名资料'}</h2>
                <p className="text-sm text-slate-500 mt-1">字段顺序与 /模版/考生信息模板.xls 保持一致</p>
              </div>
              <button onClick={() => setShowProfile(false)} className="text-slate-500 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!editingCandidate && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">考评计划</label>
                  <select className={inputClass} value={form.planId} onChange={(event) => updatePlan(event.target.value)}>
                    <option value="">请选择计划</option>
                    {planOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-4">
                {fieldGroups.map((group) => (
                  <div key={group.join('-')} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {group.map((header) => (
                      <TemplateField
                        key={header}
                        label={header}
                        value={form.registrationFields[header] || ''}
                        registrationFields={form.registrationFields}
                        inputClass={inputClass}
                        onChange={(value) => updateField(header, value)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-blue-600" />
                    通用材料
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {DEFAULT_MATERIALS.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(form.materials[item.key])}
                          onChange={() => toggleMaterial(item.key)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mt-5 mb-3">申报条件材料</h3>
                  {!form.registrationFields.申报条件 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">请先选择申报条件</div>
                  ) : selectedApplicationCondition?.materials.length === 0 ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">无需额外条件材料</div>
                  ) : selectedApplicationCondition ? (
                    <div className="grid grid-cols-1 gap-3">
                      {selectedApplicationCondition.materials.map((item) => (
                        <label key={item.key} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(form.materials[item.key])}
                            onChange={() => toggleMaterial(item.key)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">当前申报条件不属于所选认定等级，请重新选择</div>
                  )}
                </div>
                {canUsePayment && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">缴费状态</h3>
                    <select
                      className={inputClass}
                      value={form.paymentStatus}
                      disabled={!canEditProfiles}
                      onChange={(event) => setForm((current) => ({ ...current, paymentStatus: event.target.value as PaymentStatus }))}
                    >
                      <option value="UNPAID">未缴</option>
                      <option value="PAID">已缴</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowProfile(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
              <button
                onClick={handleSaveProfile}
                disabled={saving || (Boolean(editingCandidate) && !canEditProfiles) || !form.planId || !form.registrationFields.姓名 || !form.registrationFields.证件号码}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? '保存中' : '保存资料'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !uploadSaving && setShowUploadDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">地方系统上传回填</h2>
              <p className="text-sm text-slate-500 mt-1">选择本次上传后是否同步结束考试报名阶段</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  value={uploadNotes}
                  onChange={(event) => setUploadNotes(event.target.value)}
                  placeholder="可填写地方系统批次号、上传结果或说明"
                />
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => submitUploadBackfill(true)}
                  disabled={uploadSaving}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-left text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  报名截止，结束考试报名阶段
                </button>
                <button
                  onClick={() => submitUploadBackfill(false)}
                  disabled={uploadSaving}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                >
                  还要添加考生，暂不截止报名
                </button>
                <button
                  onClick={() => setShowUploadDialog(false)}
                  disabled={uploadSaving}
                  className="w-full rounded-lg px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:text-slate-400 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateField(props: {
  label: string;
  value: string;
  registrationFields: Record<string, string>;
  inputClass: string;
  onChange: (value: string) => void;
}) {
  const { label, value, registrationFields, inputClass, onChange } = props;
  if (label === '性别') {
    return (
      <FieldFrame label={label}>
        <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">请选择</option>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
      </FieldFrame>
    );
  }
  if (label === '是否有职业资格证书') {
    return (
      <FieldFrame label={label}>
        <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="否">否</option>
          <option value="是">是</option>
        </select>
      </FieldFrame>
    );
  }
  if (label === '认定等级') {
    return (
      <FieldFrame label={label}>
        <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">请选择</option>
          {LEVEL_OPTIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </FieldFrame>
    );
  }
  if (label === '申报条件') {
    const conditions = getApplicationConditionsForLevel(registrationFields.认定等级);
    const hasLegacyValue = Boolean(value) && !conditions.some((condition) => condition.label === value);
    return (
      <FieldFrame label={label}>
        <select className={inputClass} value={value} disabled={!registrationFields.认定等级} onChange={(event) => onChange(event.target.value)}>
          <option value="">请选择</option>
          {hasLegacyValue && <option value={value}>当前无效：{value}</option>}
          {conditions.map((condition) => (
            <option key={condition.id} value={condition.label}>{condition.label}</option>
          ))}
        </select>
      </FieldFrame>
    );
  }
  if (label === '证书等级') {
    return (
      <FieldFrame label={label}>
        <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">请选择</option>
          {LEVEL_OPTIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </FieldFrame>
    );
  }
  if (label === '文化程度') {
    return <SelectField label={label} value={value} inputClass={inputClass} options={EDUCATION_OPTIONS} onChange={onChange} />;
  }
  if (label === '所在省（市）区') {
    return <SelectField label={label} value={value} inputClass={inputClass} options={PROVINCE_OPTIONS} onChange={onChange} />;
  }
  if (label === '考生来源') {
    return <SelectField label={label} value={value} inputClass={inputClass} options={CANDIDATE_SOURCE_OPTIONS} onChange={onChange} />;
  }
  if (label === '报名单位') {
    return <SelectField label={label} value={value} inputClass={inputClass} options={REGISTRATION_ORGANIZATION_OPTIONS} onChange={onChange} />;
  }
  if (label === '认定分类') {
    return <SelectField label={label} value={value} inputClass={inputClass} options={RECOGNITION_CATEGORY_OPTIONS} onChange={onChange} />;
  }
  if (label === '考试类型') {
    return <SelectField label={label} value={value} inputClass={inputClass} options={EXAM_TYPE_OPTIONS} onChange={onChange} />;
  }
  if (label === '民族') {
    return <SelectField label={label} value={value} inputClass={inputClass} options={ETHNICITY_OPTIONS} onChange={onChange} />;
  }
  if (label === '出生日期') {
    return (
      <FieldFrame label={label}>
        <input type="date" className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
      </FieldFrame>
    );
  }
  if (label === '证件类型') {
    return (
      <FieldFrame label={label}>
        <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="居民身份证">居民身份证</option>
          <option value="护照">护照</option>
          <option value="港澳台居民居住证">港澳台居民居住证</option>
        </select>
      </FieldFrame>
    );
  }
  if (label === '证书领取方式') {
    return (
      <FieldFrame label={label}>
        <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="自取">自取</option>
          <option value="快递到付">快递到付</option>
        </select>
      </FieldFrame>
    );
  }
  return (
    <FieldFrame label={label}>
      <input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldFrame>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  inputClass: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <FieldFrame label={props.label}>
      <select className={props.inputClass} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">请选择</option>
        {props.options.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </FieldFrame>
  );
}

function FieldFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function CompletenessBadge({ complete, emptyText }: { complete: boolean; emptyText: string }) {
  return complete ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
      <CheckCircle2 className="w-3.5 h-3.5" />
      已齐全
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
      <XCircle className="w-3.5 h-3.5" />
      {emptyText}
    </span>
  );
}

function applyPlanDefaults(plan: ExamPlan | undefined, fields: Record<string, string>): Record<string, string> {
  if (!plan) return fields;
  return {
    ...fields,
    职业工种名称: fields.职业工种名称 || plan.profession,
    认定等级: fields.认定等级 || levelLabel(plan.level),
    专业: fields.专业 || plan.profession,
    报名单位: fields.报名单位 || (REGISTRATION_ORGANIZATION_OPTIONS as readonly string[]).find((item) => item === plan.tenant?.name) || '',
    证件类型: fields.证件类型 || '居民身份证',
    是否有职业资格证书: fields.是否有职业资格证书 || '否',
    认定分类: fields.认定分类 || '初次认定',
    考试类型: fields.考试类型 || '正考',
    证书领取方式: fields.证书领取方式 || '自取',
  };
}

function updateRegistrationField(fields: Record<string, string>, field: string, value: string): Record<string, string> {
  const nextFields = {
    ...fields,
    [field]: value,
  };

  if (field === '认定等级') {
    const conditionStillValid = getApplicationConditionsForLevel(value)
      .some((condition) => condition.label === fields.申报条件);
    if (!conditionStillValid) {
      nextFields.申报条件 = '';
    }
  }

  if (field === '证件号码') {
    const birthday = getBirthdayFromIdCard(value);
    if (birthday) {
      nextFields.出生日期 = birthday;
    }
  }

  return nextFields;
}

function getBirthdayFromIdCard(value: string): string {
  const clean = value.trim();
  const match18 = clean.match(/^\d{6}(\d{4})(\d{2})(\d{2})/);
  if (match18) return `${match18[1]}-${match18[2]}-${match18[3]}`;
  const match15 = clean.match(/^\d{6}(\d{2})(\d{2})(\d{2})/);
  if (match15) return `19${match15[1]}-${match15[2]}-${match15[3]}`;
  return '';
}

function buildCreatePayload(form: ProfileForm) {
  const fields = form.registrationFields;
  return {
    planId: form.planId,
    name: fields.姓名,
    idCard: fields.证件号码,
    phone: fields.手机号码,
    gender: fields.性别 === '女' ? 'F' : 'M',
    education: fields.文化程度 || undefined,
    workYears: fields.专业年限 ? Number.parseInt(fields.专业年限, 10) || undefined : undefined,
    applyLevel: levelValue(fields.认定等级),
    registrationFields: fields,
    materials: form.materials,
    paymentStatus: form.paymentStatus,
  };
}

function levelLabel(value: string): string {
  const clean = value.replace('级', '');
  const labels: Record<string, string> = {
    '1': '一级/高级技师',
    '2': '二级/技师',
    '3': '三级/高级工',
    '4': '四级/中级工',
    '5': '五级/初级工',
  };
  return labels[clean] || value;
}

function levelValue(value: string): string {
  return levelLabel(value || '三级/高级工');
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
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

async function getBlobErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: Blob } }).response;
    if (response?.data instanceof Blob) {
      const text = await response.data.text();
      try {
        const payload = JSON.parse(text);
        return payload?.error?.message || fallback;
      } catch {
        return text || fallback;
      }
    }
  }
  return getErrorMessage(err, fallback);
}
