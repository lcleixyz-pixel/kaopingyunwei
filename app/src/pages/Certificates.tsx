import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  Upload,
  XCircle,
} from 'lucide-react';
import { apiClient, useApi } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/authStore';
import type { ApiResponse, Candidate, Certificate, Tenant } from '@/shared';
import { normalizeLevelLabel } from '@/shared';
import { formatDate, formatDateTime } from '@/lib/dateUtils';

type ItemType = 'BLANK_CERT' | 'CERT_SHELL';
type SupplyStatus = 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'RECEIVED' | 'REJECTED';
type ReissueStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ISSUED';
type DestroyStatus = 'DRAFT' | 'CLOSED';
type StocktakeType = 'QUARTERLY' | 'HALF_YEAR' | 'ANNUAL' | 'MANUAL';
type ActiveSection = 'workbench' | 'stock' | 'print' | 'void' | 'reissue' | 'stocktake';

interface CertNodeSummary {
  id: string;
  status: string;
  completedAt?: string;
}

interface CertificatePlan {
  id: string;
  title: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  examDate: string;
  occupation: string;
  profession: string;
  level: string;
  status: string;
  certNode?: CertNodeSummary | null;
  summary: {
    passedCount: number;
    certNoCount: number;
    printedCount: number;
    issuedCount: number;
    voidCount: number;
    reissueCount: number;
  };
}

interface CertificateRecordRow {
  candidate: Candidate & {
    score?: { isPass: boolean; theoryScore?: number; practiceScore?: number } | null;
  };
  certificate?: Certificate | null;
}

interface ImportPreviewRow {
  rowNumber: number;
  name: string;
  idCard: string;
  certNo: string;
  certDisplayIssueDate: string;
  candidateId?: string;
  matched: boolean;
  valid: boolean;
  errors: string[];
}

interface ImportPreview {
  rows: ImportPreviewRow[];
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
}

interface SupplyRequest {
  id: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  itemType: ItemType;
  quantity: number;
  blankCertQuantity: number;
  shellQuantity: number;
  responsiblePerson?: string;
  contactName?: string;
  contactPhone?: string;
  mailingAddress?: string;
  status: SupplyStatus;
  notes?: string;
  rejectReason?: string;
  requestedAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
}

interface StockBalance {
  tenant: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  BLANK_CERT: { balance: number; pendingDestroy: number; reminder: string | null };
  CERT_SHELL: { balance: number; pendingDestroy: number; reminder: string | null };
}

interface StockLedger {
  id: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  itemType: ItemType;
  movementType: string;
  quantity: number;
  balanceAfter: number;
  availableBalanceAfter: number;
  pendingDestroyBalanceAfter: number;
  responsiblePerson: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

interface PrintRecord {
  id: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  plan?: { id: string; title: string } | null;
  passedCount: number;
  blankCertUsed: number;
  shellUsed: number;
  blankCertReturned: number;
  shellReturned: number;
  blankCertVoided: number;
  shellVoided: number;
  actualPrintedCount: number;
  responsiblePerson: string;
  createdAt: string;
}

interface VoidRecord {
  id: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  plan?: { id: string; title: string } | null;
  certificate?: Certificate | null;
  itemType: ItemType;
  quantity: number;
  reason: string;
  status: 'PENDING_DESTROY' | 'DESTROYED';
  createdAt: string;
}

interface DestroyBatch {
  id: string;
  title: string;
  status: DestroyStatus;
  notes?: string;
  createdAt: string;
  closedAt?: string;
  voidRecords: VoidRecord[];
}

interface ReissueRequest {
  id: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  plan?: { id: string; title: string } | null;
  candidate?: { id: string; name: string } | null;
  applicantName: string;
  applicantPhone?: string;
  certNo?: string;
  reason: string;
  mailingAddress?: string;
  status: ReissueStatus;
  reviewDueAt: string;
  remakeDueAt?: string;
  createdAt: string;
}

interface StocktakeRecord {
  id: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  itemType: ItemType;
  stocktakeType: StocktakeType;
  bookBalance: number;
  actualQuantity: number;
  variance: number;
  responsiblePerson: string;
  notes?: string;
  createdAt: string;
}

interface PrintFormState {
  blankCertUsed: number;
  shellUsed: number;
  blankCertReturned: number;
  shellReturned: number;
  blankCertVoided: number;
  shellVoided: number;
  actualPrintedCount: number;
  responsiblePerson: string;
  overrideReason: string;
  notes: string;
}

interface CertificatePrintCalibrationState {
  offsetXMm: number;
  offsetYMm: number;
  fontScale: number;
}

interface ReissueFormState {
  applicantName: string;
  applicantPhone: string;
  applicantIdCard: string;
  certNo: string;
  reason: string;
  mailingAddress: string;
  responsiblePerson: string;
  feeCents: number;
  mailingFeeCents: number;
}

const sectionLabels: Record<ActiveSection, string> = {
  workbench: '计划工作台',
  stock: '申领与库存',
  print: '打印与发放',
  void: '作废与销毁',
  reissue: '遗失补办',
  stocktake: '盘点提醒',
};

const itemTypeLabels: Record<ItemType, string> = {
  BLANK_CERT: '空白证书',
  CERT_SHELL: '证书壳',
};

const supplyStatusLabels: Record<SupplyStatus, string> = {
  PENDING: '待总部审批',
  APPROVED: '已审批',
  DISPATCHED: '已发出',
  RECEIVED: '已入库',
  REJECTED: '已驳回',
};

const reissueStatusLabels: Record<ReissueStatus, string> = {
  SUBMITTED: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  ISSUED: '已发放',
};

const stocktakeTypeLabels: Record<StocktakeType, string> = {
  QUARTERLY: '季度盘点',
  HALF_YEAR: '半年抽查',
  ANNUAL: '年度盘点',
  MANUAL: '临时盘点',
};

export default function Certificates() {
  const { get, post, patch } = useApi();
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<CertificatePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [records, setRecords] = useState<CertificateRecordRow[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
  const [ledgers, setLedgers] = useState<StockLedger[]>([]);
  const [printRecords, setPrintRecords] = useState<PrintRecord[]>([]);
  const [voidRecords, setVoidRecords] = useState<VoidRecord[]>([]);
  const [destroyBatches, setDestroyBatches] = useState<DestroyBatch[]>([]);
  const [reissueRequests, setReissueRequests] = useState<ReissueRequest[]>([]);
  const [stocktakes, setStocktakes] = useState<StocktakeRecord[]>([]);
  const [certInputs, setCertInputs] = useState<Record<string, string>>({});
  const [certDateInputs, setCertDateInputs] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<ActiveSection>('workbench');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [destroySelection, setDestroySelection] = useState<Record<string, boolean>>({});
  const [selectedPrintCertificateIds, setSelectedPrintCertificateIds] = useState<string[]>([]);
  const [lastPrintRecordId, setLastPrintRecordId] = useState('');
  const [certificatePrintCalibration, setCertificatePrintCalibration] = useState<CertificatePrintCalibrationState>(() => {
    const raw = localStorage.getItem('certificate_print_calibration');
    if (!raw) return { offsetXMm: 0, offsetYMm: 0, fontScale: 1 };
    try {
      const parsed = JSON.parse(raw) as Partial<CertificatePrintCalibrationState>;
      return {
        offsetXMm: Number(parsed.offsetXMm) || 0,
        offsetYMm: Number(parsed.offsetYMm) || 0,
        fontScale: Number(parsed.fontScale) || 1,
      };
    } catch {
      return { offsetXMm: 0, offsetYMm: 0, fontScale: 1 };
    }
  });

  const [supplyForm, setSupplyForm] = useState({
    blankCertQuantity: 0,
    shellQuantity: 0,
    responsiblePerson: '',
    contactName: '',
    contactPhone: '',
    mailingAddress: '',
    notes: '',
  });
  const [supplyStampedFile, setSupplyStampedFile] = useState<File | null>(null);
  const [printForm, setPrintForm] = useState({
    blankCertUsed: 0,
    shellUsed: 0,
    blankCertReturned: 0,
    shellReturned: 0,
    blankCertVoided: 0,
    shellVoided: 0,
    actualPrintedCount: 0,
    responsiblePerson: '',
    overrideReason: '',
    notes: '',
  });
  const [voidForm, setVoidForm] = useState({ itemType: 'BLANK_CERT' as ItemType, quantity: 1, responsiblePerson: '', reason: '' });
  const [destroyForm, setDestroyForm] = useState({ title: `证书销毁批次-${new Date().getFullYear()}`, responsiblePerson: '', notes: '' });
  const [reissueForm, setReissueForm] = useState({
    applicantName: '',
    applicantPhone: '',
    applicantIdCard: '',
    certNo: '',
    reason: '遗失补办',
    mailingAddress: '',
    responsiblePerson: '',
    feeCents: 20000,
    mailingFeeCents: 0,
  });
  const [stocktakeForm, setStocktakeForm] = useState({ itemType: 'BLANK_CERT' as ItemType, stocktakeType: 'QUARTERLY' as StocktakeType, actualQuantity: 0, responsiblePerson: '', notes: '' });

  const isBranchOperator = user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';
  const isHeadquartersOperator = user?.role === 'HQ_ADMIN' || user?.role === 'SYS_ADMIN';
  const isReadOnly = user?.role === 'HQ_STAFF';
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId],
  );

  const fetchOperationalLists = useCallback(async () => {
    const [balanceData, supplyData, ledgerData, printData, voidData, destroyData, reissueData, stocktakeData] = await Promise.all([
      get<StockBalance[]>('/certificates/stock/balances'),
      get<SupplyRequest[]>('/certificates/supply-requests'),
      get<StockLedger[]>('/certificates/stock/ledger'),
      get<PrintRecord[]>('/certificates/print-records'),
      get<VoidRecord[]>('/certificates/void-records'),
      get<DestroyBatch[]>('/certificates/destroy-batches'),
      get<ReissueRequest[]>('/certificates/reissue-requests'),
      get<StocktakeRecord[]>('/certificates/stocktakes'),
    ]);
    setBalances(balanceData);
    setSupplyRequests(supplyData);
    setLedgers(ledgerData);
    setPrintRecords(printData);
    setVoidRecords(voidData);
    setDestroyBatches(destroyData);
    setReissueRequests(reissueData);
    setStocktakes(stocktakeData);
  }, [get]);

  const fetchPlans = useCallback(async () => {
    const planData = await get<CertificatePlan[]>('/certificates/plans');
    setPlans(planData);
    setSelectedPlanId((current) => current && planData.some((plan) => plan.id === current) ? current : planData[0]?.id || '');
  }, [get]);

  const fetchRecords = useCallback(async (planId: string) => {
    if (!planId) {
      setRecords([]);
      return;
    }
    const recordData = await get<CertificateRecordRow[]>('/certificates/records', { planId });
    setRecords(recordData);
    setCertInputs(Object.fromEntries(recordData.map((row) => [row.candidate.id, row.certificate?.certNo || ''])));
    setCertDateInputs(Object.fromEntries(recordData.map((row) => [row.candidate.id, row.certificate?.certDisplayIssueDate?.slice(0, 10) || ''])));
  }, [get]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      await Promise.all([fetchPlans(), fetchOperationalLists()]);
    } catch (err: any) {
      setError(err?.message || '获取证书数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [fetchOperationalLists, fetchPlans]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    fetchRecords(selectedPlanId).catch((err: any) => setError(err?.message || '获取证书记录失败'));
    setSelectedPrintCertificateIds([]);
    setLastPrintRecordId('');
  }, [fetchRecords, selectedPlanId]);

  useEffect(() => {
    localStorage.setItem('certificate_print_calibration', JSON.stringify(certificatePrintCalibration));
  }, [certificatePrintCalibration]);

  const withSubmit = async (task: () => Promise<void>, successMessage: string) => {
    setIsSubmitting(true);
    setError('');
    setNotice('');
    try {
      await task();
      setNotice(successMessage);
      await refreshAll();
      if (selectedPlanId) await fetchRecords(selectedPlanId);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || '操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveCertificateNo = async (row: CertificateRecordRow) => {
    const certNo = certInputs[row.candidate.id]?.trim();
    const certDisplayIssueDate = certDateInputs[row.candidate.id]?.trim();
    if (!certNo) {
      setError('证书编号不能为空');
      return;
    }
    if (!certDisplayIssueDate) {
      setError('证书版面发证日期不能为空');
      return;
    }
    await withSubmit(async () => {
      await post('/certificates/records', {
        candidateId: row.candidate.id,
        certNo,
        certDisplayIssueDate,
        certNoSource: 'MANUAL',
      });
    }, '证书编号已保存');
  };

  const updateCertificateStatus = async (certificateId: string, status: Certificate['status']) => {
    await withSubmit(async () => {
      await patch(`/certificates/records/${certificateId}`, { status });
    }, '证书状态已更新');
  };

  const previewImport = async () => {
    if (!selectedPlanId || !importFile) {
      setError('请选择计划和导入文件');
      return;
    }
    setIsSubmitting(true);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.append('planId', selectedPlanId);
      formData.append('file', importFile);
      const response = await apiClient.post<ApiResponse<ImportPreview>>('/certificates/records/import-preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!response.data.success || !response.data.data) throw new Error(response.data.error?.message || '导入预览失败');
      setImportPreview(response.data.data);
      setNotice('导入预览已生成');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || '导入预览失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const commitImport = async () => {
    if (!selectedPlanId || !importPreview) return;
    await withSubmit(async () => {
      await post('/certificates/records/import-commit', {
        planId: selectedPlanId,
        rows: importPreview.rows.map(({ rowNumber, name, idCard, certNo, certDisplayIssueDate }) => ({ rowNumber, name, idCard, certNo, certDisplayIssueDate })),
      });
      setImportPreview(null);
      setImportFile(null);
    }, '证书编号已批量回填');
  };

  const submitSupplyRequest = async () => {
    if (!supplyStampedFile) {
      setError('请上传盖章后的申领单 PDF 或图片');
      return;
    }
    await withSubmit(async () => {
      const formData = new FormData();
      Object.entries(supplyForm).forEach(([key, value]) => formData.append(key, String(value)));
      formData.append('stampedFile', supplyStampedFile);
      await apiClient.post<ApiResponse<SupplyRequest>>('/certificates/supply-requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSupplyForm({ blankCertQuantity: 0, shellQuantity: 0, responsiblePerson: '', contactName: '', contactPhone: '', mailingAddress: '', notes: '' });
      setSupplyStampedFile(null);
    }, '申领单已提交');
  };

  const supplyAction = async (id: string, action: 'approve' | 'dispatch' | 'receive' | 'reject') => {
    await withSubmit(async () => {
      await post(`/certificates/supply-requests/${id}/${action}`, {});
    }, '申领单状态已更新');
  };

  const submitPrintRecord = async () => {
    if (!selectedPlanId) return;
    if (selectedPrintCertificateIds.length === 0) {
      setError('请选择本批次打印的证书记录');
      return;
    }
    await withSubmit(async () => {
      const created = await post<PrintRecord>('/certificates/print-records', {
        planId: selectedPlanId,
        certificateIds: selectedPrintCertificateIds,
        ...printForm,
        actualPrintedCount: selectedPrintCertificateIds.length,
        blankCertUsed: printForm.blankCertUsed || selectedPrintCertificateIds.length,
        verificationItems: {
          candidateInfo: true,
          certNo: true,
          scores: true,
          printQuality: true,
        },
      });
      setLastPrintRecordId(created.id);
      setSelectedPrintCertificateIds([]);
      setPrintForm({
        blankCertUsed: 0,
        shellUsed: 0,
        blankCertReturned: 0,
        shellReturned: 0,
        blankCertVoided: 0,
        shellVoided: 0,
        actualPrintedCount: 0,
        responsiblePerson: '',
        overrideReason: '',
        notes: '',
      });
    }, '打印发放记录已保存');
  };

  const submitVoidRecord = async () => {
    if (!selectedPlanId) return;
    await withSubmit(async () => {
      await post('/certificates/void-records', {
        planId: selectedPlanId,
        ...voidForm,
      });
      setVoidForm({ itemType: 'BLANK_CERT', quantity: 1, responsiblePerson: '', reason: '' });
    }, '作废记录已登记');
  };

  const createDestroyBatch = async () => {
    const voidRecordIds = Object.entries(destroySelection).filter(([, checked]) => checked).map(([id]) => id);
    await withSubmit(async () => {
      await post('/certificates/destroy-batches', { ...destroyForm, voidRecordIds });
      setDestroySelection({});
    }, '销毁批次已创建');
  };

  const confirmDestroyBatch = async (id: string) => {
    if (!window.confirm('确认该批次证书已实际销毁并入账？确认后不可重复确认。')) return;
    await withSubmit(async () => {
      await post(`/certificates/destroy-batches/${id}/confirm-destroy`, {});
    }, '销毁批次已确认销毁');
  };

  const submitReissue = async () => {
    await withSubmit(async () => {
      await post('/certificates/reissue-requests', {
        planId: selectedPlanId || undefined,
        ...reissueForm,
      });
      setReissueForm({
        applicantName: '',
        applicantPhone: '',
        applicantIdCard: '',
        certNo: '',
        reason: '遗失补办',
        mailingAddress: '',
        responsiblePerson: '',
        feeCents: 20000,
        mailingFeeCents: 0,
      });
    }, '补办申请已提交');
  };

  const reviewReissue = async (id: string, approved: boolean) => {
    await withSubmit(async () => {
      await post(`/certificates/reissue-requests/${id}/review`, { approved });
    }, '补办申请已审核');
  };

  const issueReissue = async (id: string) => {
    await withSubmit(async () => {
      await post(`/certificates/reissue-requests/${id}/issue`, {});
    }, '补办证书已发放');
  };

  const submitStocktake = async () => {
    await withSubmit(async () => {
      await post('/certificates/stocktakes', stocktakeForm);
      setStocktakeForm({ itemType: 'BLANK_CERT', stocktakeType: 'QUARTERLY', actualQuantity: 0, responsiblePerson: '', notes: '' });
    }, '盘点记录已保存');
  };

  const completeCertNode = async () => {
    if (!selectedPlanId) return;
    await withSubmit(async () => {
      await post(`/certificates/plans/${selectedPlanId}/complete-node`, { notes: '证书编号、打印发放和制度台账已确认' });
    }, '证书管理节点已完成');
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
    } catch (err: any) {
      setError(err?.message || '导出失败');
    }
  };

  const downloadCertificatePrintPdf = (id: string) => {
    const params = new URLSearchParams({
      offsetXMm: String(certificatePrintCalibration.offsetXMm),
      offsetYMm: String(certificatePrintCalibration.offsetYMm),
      fontScale: String(certificatePrintCalibration.fontScale),
    });
    downloadFile(`/certificates/exports/print-record/${id}/certificates.pdf?${params.toString()}`, `证书套打-${id}.pdf`);
  };

  const downloadCertificatePrintTrialPdf = (certificateId?: string) => {
    if (!selectedPlanId) {
      setError('请选择考评计划');
      return;
    }
    const params = new URLSearchParams({
      planId: selectedPlanId,
      offsetXMm: String(certificatePrintCalibration.offsetXMm),
      offsetYMm: String(certificatePrintCalibration.offsetYMm),
      fontScale: String(certificatePrintCalibration.fontScale),
    });
    if (certificateId) params.set('certificateId', certificateId);
    downloadFile(`/certificates/exports/certificate-print-trial.pdf?${params.toString()}`, '证书套打试打.pdf');
  };

  const pendingVoidRecords = voidRecords.filter((record) => record.status === 'PENDING_DESTROY');
  const sectionKeys = Object.keys(sectionLabels) as ActiveSection[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            证书管理
          </h1>
          <p className="text-slate-500 mt-1">总部制度协同、地方编号回填、证书库存与发放台账</p>
        </div>
        <button onClick={refreshAll} className="icon-button border-slate-300 text-slate-700 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {error && <Message tone="error" text={error} />}
      {notice && <Message tone="success" text={notice} />}

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-5">
        <aside className="bg-white border border-slate-200 rounded-lg p-4 space-y-4 h-fit">
          <div>
            <label className="text-sm font-medium text-slate-700">考评计划</label>
            <select
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title} · {normalizeLevelLabel(plan.level)}
                </option>
              ))}
            </select>
          </div>

          {selectedPlan && (
            <div className="space-y-2 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">{selectedPlan.profession}</div>
              <div>{formatDate(selectedPlan.examDate)} · {normalizeLevelLabel(selectedPlan.level)}</div>
              <div>{selectedPlan.tenant?.name || '当前机构'}</div>
              <StatusBadge label={selectedPlan.certNode?.status || '未创建节点'} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {selectedPlan && [
              ['合格', selectedPlan.summary.passedCount],
              ['编号', selectedPlan.summary.certNoCount],
              ['打印', selectedPlan.summary.printedCount],
              ['发放', selectedPlan.summary.issuedCount],
              ['作废', selectedPlan.summary.voidCount],
              ['补办', selectedPlan.summary.reissueCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-lg font-bold text-slate-900">{value}</div>
              </div>
            ))}
          </div>

          <nav className="space-y-1">
            {sectionKeys.map((key) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === key ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {sectionLabels[key]}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-lg py-20 flex items-center justify-center text-slate-500">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin mr-3" />
              加载中...
            </div>
          ) : (
            <>
              {activeSection === 'workbench' && (
                <WorkbenchSection
                  records={records}
                  certInputs={certInputs}
                  setCertInputs={setCertInputs}
                  certDateInputs={certDateInputs}
                  setCertDateInputs={setCertDateInputs}
                  importFile={importFile}
                  setImportFile={setImportFile}
                  importPreview={importPreview}
                  isBranchOperator={isBranchOperator}
                  isReadOnly={isReadOnly}
                  isSubmitting={isSubmitting}
                  selectedPlan={selectedPlan}
                  onPreviewImport={previewImport}
                  onCommitImport={commitImport}
                  onDownloadTemplate={() => downloadFile('/certificates/exports/certificate-import-template.xlsx', '证书编号导入模板.xlsx')}
                  onSaveCertificateNo={saveCertificateNo}
                  onUpdateStatus={updateCertificateStatus}
                  onCompleteNode={completeCertNode}
                />
              )}
              {activeSection === 'stock' && (
                <StockSection
                  balances={balances}
                  ledgers={ledgers}
                  supplyRequests={supplyRequests}
                  supplyForm={supplyForm}
                  setSupplyForm={setSupplyForm}
                  supplyStampedFile={supplyStampedFile}
                  setSupplyStampedFile={setSupplyStampedFile}
                  isBranchOperator={isBranchOperator}
                  isHeadquartersOperator={isHeadquartersOperator}
                  isSubmitting={isSubmitting}
                  onSubmitSupply={submitSupplyRequest}
                  onSupplyAction={supplyAction}
                  onExportLedger={() => downloadFile('/certificates/exports/ledger.xlsx', '证书库存台账.xlsx')}
                  onExportSupplyPdf={() => downloadFile(`/certificates/exports/supply-request-template.pdf?${new URLSearchParams(Object.entries(supplyForm).map(([key, value]) => [key, String(value)]))}`, '空白证书证书壳申请表.pdf')}
                  onExportSupply={(id) => downloadFile(`/certificates/exports/supply-request/${id}.pdf`, `证书申领单-${id}.pdf`)}
                />
              )}
              {activeSection === 'print' && (
                <PrintSection
                  selectedPlan={selectedPlan}
                  printRecords={printRecords}
                  records={records}
                  printForm={printForm}
                  setPrintForm={setPrintForm}
                  selectedPrintCertificateIds={selectedPrintCertificateIds}
                  setSelectedPrintCertificateIds={setSelectedPrintCertificateIds}
                  certificatePrintCalibration={certificatePrintCalibration}
                  setCertificatePrintCalibration={setCertificatePrintCalibration}
                  lastPrintRecordId={lastPrintRecordId}
                  isBranchOperator={isBranchOperator}
                  isSubmitting={isSubmitting}
                  onSubmitPrint={submitPrintRecord}
                  onExportCertificatePdf={downloadCertificatePrintPdf}
                  onExportTrialPdf={downloadCertificatePrintTrialPdf}
                  onExportSignature={(id) => downloadFile(`/certificates/exports/print-record/${id}/signature.pdf`, `证书领取签字表-${id}.pdf`)}
                  onExportDelivery={() => downloadFile(`/certificates/exports/delivery.xlsx${selectedPlanId ? `?planId=${selectedPlanId}` : ''}`, '证书发放清单.xlsx')}
                />
              )}
              {activeSection === 'void' && (
                <VoidDestroySection
                  voidRecords={voidRecords}
                  destroyBatches={destroyBatches}
                  voidForm={voidForm}
                  setVoidForm={setVoidForm}
                  destroyForm={destroyForm}
                  setDestroyForm={setDestroyForm}
                  destroySelection={destroySelection}
                  setDestroySelection={setDestroySelection}
                  pendingVoidRecords={pendingVoidRecords}
                  isBranchOperator={isBranchOperator}
                  isHeadquartersOperator={isHeadquartersOperator}
                  isSubmitting={isSubmitting}
                  onSubmitVoid={submitVoidRecord}
                  onCreateDestroy={createDestroyBatch}
                  onConfirmDestroy={confirmDestroyBatch}
                  onExportDestroy={(id) => downloadFile(`/certificates/exports/destroy-batch/${id}.pdf`, `证书销毁登记表-${id}.pdf`)}
                />
              )}
              {activeSection === 'reissue' && (
                <ReissueSection
                  reissueRequests={reissueRequests}
                  reissueForm={reissueForm}
                  setReissueForm={setReissueForm}
                  isBranchOperator={isBranchOperator}
                  isSubmitting={isSubmitting}
                  onSubmitReissue={submitReissue}
                  onReviewReissue={reviewReissue}
                  onIssueReissue={issueReissue}
                  onExportReissue={(id) => downloadFile(`/certificates/exports/reissue-request/${id}.doc`, `补办申请-${id}.doc`)}
                />
              )}
              {activeSection === 'stocktake' && (
                <StocktakeSection
                  stocktakes={stocktakes}
                  balances={balances}
                  stocktakeForm={stocktakeForm}
                  setStocktakeForm={setStocktakeForm}
                  isBranchOperator={isBranchOperator}
                  isSubmitting={isSubmitting}
                  onSubmitStocktake={submitStocktake}
                  onExportStocktakes={() => downloadFile('/certificates/exports/stocktakes.xlsx', '证书盘点记录.xlsx')}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function WorkbenchSection(props: {
  records: CertificateRecordRow[];
  certInputs: Record<string, string>;
  setCertInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  certDateInputs: Record<string, string>;
  setCertDateInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  importPreview: ImportPreview | null;
  isBranchOperator: boolean;
  isReadOnly: boolean;
  isSubmitting: boolean;
  selectedPlan: CertificatePlan | null;
  onPreviewImport: () => void;
  onCommitImport: () => void;
  onDownloadTemplate: () => void;
  onSaveCertificateNo: (row: CertificateRecordRow) => void;
  onUpdateStatus: (certificateId: string, status: Certificate['status']) => void;
  onCompleteNode: () => void;
}) {
  const canCommitImport = props.importPreview && props.importPreview.summary.invalid === 0 && props.importPreview.summary.valid > 0;

  return (
    <div className="space-y-5">
      <Panel title="证书编号回填" icon={<FileSpreadsheet className="w-5 h-5 text-blue-600" />}>
        {props.isBranchOperator && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => props.setImportFile(event.target.files?.[0] || null)}
              className="text-sm text-slate-600"
            />
            <button disabled={!props.importFile || props.isSubmitting} onClick={props.onPreviewImport} className="icon-button bg-slate-900 text-white disabled:bg-slate-400">
              <Upload className="w-4 h-4" />
              预览导入
            </button>
            <button onClick={props.onDownloadTemplate} className="icon-button border-slate-300 text-slate-700 hover:bg-slate-50">
              <Download className="w-4 h-4" />
              下载模板
            </button>
            <button disabled={!canCommitImport || props.isSubmitting} onClick={props.onCommitImport} className="icon-button bg-blue-600 text-white disabled:bg-blue-300">
              <CheckCircle2 className="w-4 h-4" />
              提交回填
            </button>
          </div>
        )}

        {props.importPreview && (
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-900">
              共 {props.importPreview.summary.total} 行，匹配 {props.importPreview.summary.matched} 行，可提交 {props.importPreview.summary.valid} 行，错误 {props.importPreview.summary.invalid} 行
            </div>
            <div className="mt-2 max-h-40 overflow-auto">
              {props.importPreview.rows.map((row) => (
                <div key={row.rowNumber} className={row.valid ? 'text-slate-600' : 'text-red-600'}>
                  第 {row.rowNumber} 行 · {row.name || '-'} · {row.certNo || '-'} · {row.certDisplayIssueDate || '-'} {row.errors.length > 0 ? `· ${row.errors.join('；')}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-3 py-3">考生</th>
                <th className="text-left px-3 py-3">证件号码</th>
                <th className="text-left px-3 py-3">成绩</th>
                <th className="text-left px-3 py-3">证书编号</th>
                <th className="text-left px-3 py-3">版面发证日期</th>
                <th className="text-left px-3 py-3">状态</th>
                <th className="text-left px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {props.records.map((row) => (
                <tr key={row.candidate.id}>
                  <td className="px-3 py-3 font-medium text-slate-900">{row.candidate.name}</td>
                  <td className="px-3 py-3 text-slate-600 font-mono">{row.candidate.idCard}</td>
                  <td className="px-3 py-3 text-slate-600">
                    理论 {scoreValue(row.candidate.score?.theoryScore)} / 实操 {scoreValue(row.candidate.score?.practiceScore)}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      value={props.certInputs[row.candidate.id] || ''}
                      onChange={(event) => props.setCertInputs((prev) => ({ ...prev, [row.candidate.id]: event.target.value }))}
                      disabled={!props.isBranchOperator}
                      className="w-48 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm disabled:bg-slate-100"
                      placeholder="地方系统证书编号"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="date"
                      value={props.certDateInputs[row.candidate.id] || ''}
                      onChange={(event) => props.setCertDateInputs((prev) => ({ ...prev, [row.candidate.id]: event.target.value }))}
                      disabled={!props.isBranchOperator}
                      className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                    />
                  </td>
                  <td className="px-3 py-3"><StatusBadge label={certificateStatusLabel(row.certificate?.status)} /></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {props.isBranchOperator && (
                        <button disabled={props.isSubmitting} onClick={() => props.onSaveCertificateNo(row)} className="text-blue-600 hover:text-blue-700 font-medium">
                          保存
                        </button>
                      )}
                      {props.isBranchOperator && row.certificate?.status === 'PRINTED' && (
                        <button onClick={() => props.onUpdateStatus(row.certificate!.id, 'ISSUED')} className="text-green-600 hover:text-green-700 font-medium">
                          发放
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {props.records.length === 0 && <EmptyState text="当前计划暂无合格考生" />}
        </div>
      </Panel>

      <Panel title="节点完成" icon={<ClipboardCheck className="w-5 h-5 text-blue-600" />}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-600">
            当前节点：<StatusBadge label={props.selectedPlan?.certNode?.status || '未创建节点'} />
          </div>
          {props.isBranchOperator && !props.isReadOnly && (
            <button
              disabled={props.isSubmitting || props.selectedPlan?.certNode?.status !== 'IN_PROGRESS'}
              onClick={props.onCompleteNode}
              className="icon-button bg-green-600 text-white disabled:bg-green-300"
            >
              <CheckCircle2 className="w-4 h-4" />
              完成证书管理节点
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function StockSection(props: {
  balances: StockBalance[];
  ledgers: StockLedger[];
  supplyRequests: SupplyRequest[];
  supplyForm: { blankCertQuantity: number; shellQuantity: number; responsiblePerson: string; contactName: string; contactPhone: string; mailingAddress: string; notes: string };
  setSupplyForm: React.Dispatch<React.SetStateAction<{ blankCertQuantity: number; shellQuantity: number; responsiblePerson: string; contactName: string; contactPhone: string; mailingAddress: string; notes: string }>>;
  supplyStampedFile: File | null;
  setSupplyStampedFile: (file: File | null) => void;
  isBranchOperator: boolean;
  isHeadquartersOperator: boolean;
  isSubmitting: boolean;
  onSubmitSupply: () => void;
  onSupplyAction: (id: string, action: 'approve' | 'dispatch' | 'receive' | 'reject') => void;
  onExportLedger: () => void;
  onExportSupplyPdf: () => void;
  onExportSupply: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Panel title="库存余额" icon={<PackageCheck className="w-5 h-5 text-blue-600" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {props.balances.map((balance) => (
            <div key={balance.tenant.id} className="rounded-md border border-slate-200 p-4">
              <div className="font-semibold text-slate-900">{balance.tenant.name}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {(['BLANK_CERT', 'CERT_SHELL'] as ItemType[]).map((itemType) => (
                  <div key={itemType}>
                    <div className="text-slate-500">{itemTypeLabels[itemType]}</div>
                    <div className="text-xl font-bold text-slate-900">{balance[itemType].balance}</div>
                    <div className="text-xs text-slate-500 mt-1">待销毁 {balance[itemType].pendingDestroy}</div>
                    {balance[itemType].reminder && <div className="text-xs text-amber-600 mt-1">{balance[itemType].reminder}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="证书申领" icon={<PackagePlus className="w-5 h-5 text-blue-600" />}>
        {props.isBranchOperator && (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
            <input type="number" min={0} value={props.supplyForm.blankCertQuantity} onChange={(event) => props.setSupplyForm((prev) => ({ ...prev, blankCertQuantity: Number(event.target.value) }))} className="form-control" placeholder="空白证书数量" />
            <input type="number" min={0} value={props.supplyForm.shellQuantity} onChange={(event) => props.setSupplyForm((prev) => ({ ...prev, shellQuantity: Number(event.target.value) }))} className="form-control" placeholder="证书壳数量" />
            <input value={props.supplyForm.responsiblePerson} onChange={(event) => props.setSupplyForm((prev) => ({ ...prev, responsiblePerson: event.target.value }))} className="form-control" placeholder="责任人" />
            <input value={props.supplyForm.contactName} onChange={(event) => props.setSupplyForm((prev) => ({ ...prev, contactName: event.target.value }))} className="form-control" placeholder="联系人" />
            <input value={props.supplyForm.contactPhone} onChange={(event) => props.setSupplyForm((prev) => ({ ...prev, contactPhone: event.target.value }))} className="form-control" placeholder="联系电话" />
            <input value={props.supplyForm.mailingAddress} onChange={(event) => props.setSupplyForm((prev) => ({ ...prev, mailingAddress: event.target.value }))} className="form-control" placeholder="邮寄地址" />
            <input value={props.supplyForm.notes} onChange={(event) => props.setSupplyForm((prev) => ({ ...prev, notes: event.target.value }))} className="form-control" placeholder="备注" />
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => props.setSupplyStampedFile(event.target.files?.[0] || null)} className="text-sm text-slate-600 self-center" />
            <button disabled={props.isSubmitting} onClick={props.onExportSupplyPdf} className="icon-button border-slate-300 text-slate-700 hover:bg-slate-50">
              <Download className="w-4 h-4" />
              生成PDF
            </button>
            <button disabled={props.isSubmitting} onClick={props.onSubmitSupply} className="icon-button bg-blue-600 text-white disabled:bg-blue-300">
              <PackagePlus className="w-4 h-4" />
              上传提交
            </button>
            <div className="text-xs text-slate-500 self-center md:col-span-2">{props.supplyStampedFile ? `已选择：${props.supplyStampedFile.name}` : '打印盖章后上传 PDF 或图片才会正式提交'}</div>
          </div>
        )}

        <DataTable
          headers={['机构', '空白证书', '证书壳', '责任人', '状态', '申请时间', '操作']}
          rows={props.supplyRequests.map((request) => [
            request.tenant?.name || '-',
            request.blankCertQuantity || (request.itemType === 'BLANK_CERT' ? request.quantity : 0),
            request.shellQuantity || (request.itemType === 'CERT_SHELL' ? request.quantity : 0),
            request.responsiblePerson || '-',
            supplyStatusLabels[request.status],
            formatDateTime(request.requestedAt),
            <div key={request.id} className="flex flex-wrap gap-2">
              {props.isHeadquartersOperator && request.status === 'PENDING' && <ActionLink onClick={() => props.onSupplyAction(request.id, 'approve')}>审批</ActionLink>}
              {props.isHeadquartersOperator && request.status === 'PENDING' && <ActionLink tone="danger" onClick={() => props.onSupplyAction(request.id, 'reject')}>驳回</ActionLink>}
              {props.isHeadquartersOperator && request.status === 'APPROVED' && <ActionLink onClick={() => props.onSupplyAction(request.id, 'dispatch')}>发出</ActionLink>}
              {props.isBranchOperator && request.status === 'DISPATCHED' && <ActionLink onClick={() => props.onSupplyAction(request.id, 'receive')}>入库</ActionLink>}
              <ActionLink onClick={() => props.onExportSupply(request.id)}>PDF</ActionLink>
            </div>,
          ])}
        />
      </Panel>

      <Panel title="库存台账" icon={<FileSpreadsheet className="w-5 h-5 text-blue-600" />}>
        <button onClick={props.onExportLedger} className="icon-button border-slate-300 text-slate-700 hover:bg-slate-50 mb-3">
          <Download className="w-4 h-4" />
          导出台账
        </button>
        <DataTable
          headers={['机构', '物品', '类型', '数量', '可用结余', '待销毁', '责任人', '时间']}
          rows={props.ledgers.slice(0, 20).map((ledger) => [
            ledger.tenant?.name || '-',
            itemTypeLabels[ledger.itemType],
            ledger.movementType,
            ledger.quantity,
            ledger.availableBalanceAfter ?? ledger.balanceAfter,
            ledger.pendingDestroyBalanceAfter ?? 0,
            ledger.responsiblePerson,
            formatDateTime(ledger.createdAt),
          ])}
        />
      </Panel>
    </div>
  );
}

function PrintSection(props: {
  selectedPlan: CertificatePlan | null;
  printRecords: PrintRecord[];
  records: CertificateRecordRow[];
  printForm: PrintFormState;
  setPrintForm: React.Dispatch<React.SetStateAction<PrintFormState>>;
  selectedPrintCertificateIds: string[];
  setSelectedPrintCertificateIds: React.Dispatch<React.SetStateAction<string[]>>;
  certificatePrintCalibration: CertificatePrintCalibrationState;
  setCertificatePrintCalibration: React.Dispatch<React.SetStateAction<CertificatePrintCalibrationState>>;
  lastPrintRecordId: string;
  isBranchOperator: boolean;
  isSubmitting: boolean;
  onSubmitPrint: () => void;
  onExportCertificatePdf: (id: string) => void;
  onExportTrialPdf: (certificateId?: string) => void;
  onExportSignature: (id: string) => void;
  onExportDelivery: () => void;
}) {
  const update = (field: keyof typeof props.printForm, value: string | number) => {
    props.setPrintForm((prev: typeof props.printForm) => ({ ...prev, [field]: value }));
  };
  const printableRows = props.records.filter((row) => row.certificate?.certNo && row.certificate.certDisplayIssueDate);
  const selectedCount = props.selectedPrintCertificateIds.length;
  const toggleCertificate = (certificateId: string, checked: boolean) => {
    props.setSelectedPrintCertificateIds((prev) => {
      const next = checked ? Array.from(new Set([...prev, certificateId])) : prev.filter((id) => id !== certificateId);
      props.setPrintForm((form) => ({
        ...form,
        actualPrintedCount: next.length,
        blankCertUsed: form.blankCertUsed === 0 || form.blankCertUsed === prev.length ? next.length : form.blankCertUsed,
      }));
      return next;
    });
  };
  const updateCalibration = (field: keyof CertificatePrintCalibrationState, value: number) => {
    props.setCertificatePrintCalibration((prev) => ({ ...prev, [field]: value }));
  };
  const trialCertificateId = props.selectedPrintCertificateIds[0] || printableRows[0]?.certificate?.id;

  return (
    <Panel title="打印与发放记录" icon={<Award className="w-5 h-5 text-blue-600" />}>
      <div className="mb-4 text-sm text-slate-600">
        合格人数：<span className="font-semibold text-slate-900">{props.selectedPlan?.summary.passedCount || 0}</span>，110% 参考上限：<span className="font-semibold text-slate-900">{Math.floor((props.selectedPlan?.summary.passedCount || 0) * 1.1)}</span>
      </div>
      <div className="mb-5 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        证书套打 PDF 仅输出字段，请使用总部空白证书纸，A4 横向，打印比例选择 100% 或实际尺寸。
      </div>
      <details className="mb-5 rounded-md border border-slate-200">
        <summary className="cursor-pointer list-none px-4 py-3">
          <div>
            <div className="font-semibold text-slate-900">套打校准</div>
            <div className="mt-1 text-xs text-slate-500">日常默认收起；需要校准时展开，调整后可下载试打 PDF，不影响正常打印记录。</div>
          </div>
        </summary>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="text-xs text-slate-500">先用 0mm 试打一张。整体偏左就增加 X，偏右就减少 X；偏上就增加 Y，偏下就减少 Y。</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!trialCertificateId}
                onClick={() => props.onExportTrialPdf(trialCertificateId)}
                className="icon-button border-blue-300 text-blue-700 hover:bg-blue-50 disabled:text-slate-400 disabled:border-slate-200"
              >
                <Download className="w-4 h-4" />
                下载试打PDF
              </button>
              <button
                type="button"
                onClick={() => props.setCertificatePrintCalibration({ offsetXMm: 0, offsetYMm: 0, fontScale: 1 })}
                className="icon-button border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">水平偏移 X / mm</span>
              <input type="number" step={0.5} value={props.certificatePrintCalibration.offsetXMm} onChange={(event) => updateCalibration('offsetXMm', Number(event.target.value))} className="form-control w-full" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">垂直偏移 Y / mm</span>
              <input type="number" step={0.5} value={props.certificatePrintCalibration.offsetYMm} onChange={(event) => updateCalibration('offsetYMm', Number(event.target.value))} className="form-control w-full" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">字号比例</span>
              <input type="number" min={0.8} max={1.2} step={0.02} value={props.certificatePrintCalibration.fontScale} onChange={(event) => updateCalibration('fontScale', Number(event.target.value))} className="form-control w-full" />
            </label>
          </div>
          {!trialCertificateId && <div className="mt-3 text-xs text-amber-600">当前计划暂无已完整回填证书编号和版面发证日期的记录，暂不能生成试打 PDF。</div>}
        </div>
      </details>
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="font-semibold text-slate-900">选择本批次打印考生</div>
          <div className="text-sm text-slate-500">已选 {selectedCount} 人</div>
        </div>
        <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-3 py-3">选择</th>
                <th className="text-left px-3 py-3">考生</th>
                <th className="text-left px-3 py-3">证件号码</th>
                <th className="text-left px-3 py-3">职业/工种/等级</th>
                <th className="text-left px-3 py-3">证书编号</th>
                <th className="text-left px-3 py-3">版面发证日期</th>
                <th className="text-left px-3 py-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {printableRows.map((row) => {
                const certificate = row.certificate!;
                const disabled = certificate.status !== 'PENDING';
                return (
                  <tr key={certificate.id} className={disabled ? 'bg-slate-50 text-slate-400' : ''}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={props.selectedPrintCertificateIds.includes(certificate.id)}
                        disabled={disabled || !props.isBranchOperator}
                        onChange={(event) => toggleCertificate(certificate.id, event.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.candidate.name}</td>
                    <td className="px-3 py-3 font-mono">{row.candidate.idCard}</td>
                    <td className="px-3 py-3">{props.selectedPlan ? `${props.selectedPlan.occupation} / ${props.selectedPlan.profession} / ${props.selectedPlan.level}` : '-'}</td>
                    <td className="px-3 py-3 font-mono">{certificate.certNo}</td>
                    <td className="px-3 py-3">{formatDate(certificate.certDisplayIssueDate)}</td>
                    <td className="px-3 py-3"><StatusBadge label={certificateStatusLabel(certificate.status)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {printableRows.length === 0 && <EmptyState text="暂无已完整回填编号和版面发证日期的考生" />}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <NumberField label="空白证书领用" value={props.printForm.blankCertUsed} onChange={(value) => update('blankCertUsed', value)} />
        <NumberField label="证书壳领用" value={props.printForm.shellUsed} onChange={(value) => update('shellUsed', value)} />
        <NumberField label="空白证书退回" value={props.printForm.blankCertReturned} onChange={(value) => update('blankCertReturned', value)} />
        <NumberField label="证书壳退回" value={props.printForm.shellReturned} onChange={(value) => update('shellReturned', value)} />
        <NumberField label="空白证书作废" value={props.printForm.blankCertVoided} onChange={(value) => update('blankCertVoided', value)} />
        <NumberField label="证书壳作废" value={props.printForm.shellVoided} onChange={(value) => update('shellVoided', value)} />
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">实际打印数量</span>
          <input value={selectedCount} readOnly className="form-control w-full bg-slate-100" />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <input value={props.printForm.responsiblePerson} onChange={(event) => update('responsiblePerson', event.target.value)} className="form-control" placeholder="打印/领用责任人" />
        <input value={props.printForm.overrideReason} onChange={(event) => update('overrideReason', event.target.value)} className="form-control" placeholder="超量领用原因" />
        <input value={props.printForm.notes} onChange={(event) => update('notes', event.target.value)} className="form-control" placeholder="备注" />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        {['姓名/性别/证件号码', '证书编号', '理论/实操成绩', '打印质量'].map((item) => (
          <span key={item} className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-600" />{item}</span>
        ))}
      </div>
      {props.isBranchOperator && (
        <button disabled={props.isSubmitting || selectedCount === 0} onClick={props.onSubmitPrint} className="icon-button bg-blue-600 text-white disabled:bg-blue-300 mt-4">
          <ClipboardCheck className="w-4 h-4" />
          保存打印记录
        </button>
      )}
      {props.lastPrintRecordId && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm">
          <span className="font-medium text-green-800">本批次打印记录已生成</span>
          <button onClick={() => props.onExportCertificatePdf(props.lastPrintRecordId)} className="icon-button border-green-300 text-green-700 hover:bg-green-100">
            <Download className="w-4 h-4" />
            下载证书套打 PDF
          </button>
          <button onClick={() => props.onExportSignature(props.lastPrintRecordId)} className="icon-button border-green-300 text-green-700 hover:bg-green-100">
            <Download className="w-4 h-4" />
            下载领取签字表
          </button>
        </div>
      )}
      <div className="mt-5 flex justify-between items-center gap-3">
        <div className="font-semibold text-slate-900">打印领用记录</div>
        <button onClick={props.onExportDelivery} className="icon-button border-slate-300 text-slate-700 hover:bg-slate-50">
          <Download className="w-4 h-4" />
          导出发放清单
        </button>
      </div>
      <DataTable
        headers={['计划', '领用', '退回', '作废', '实际打印', '责任人', '时间', '操作']}
        rows={props.printRecords
          .filter((record) => !props.selectedPlan || record.plan?.id === props.selectedPlan.id)
          .map((record) => [
            record.plan?.title || '-',
            `证书${record.blankCertUsed}/壳${record.shellUsed}`,
            `证书${record.blankCertReturned}/壳${record.shellReturned}`,
            `证书${record.blankCertVoided}/壳${record.shellVoided}`,
            record.actualPrintedCount,
            record.responsiblePerson,
            formatDateTime(record.createdAt),
            <div key={record.id} className="flex flex-wrap gap-2">
              <ActionLink onClick={() => props.onExportCertificatePdf(record.id)}>证书PDF</ActionLink>
              <ActionLink onClick={() => props.onExportSignature(record.id)}>签字表</ActionLink>
            </div>,
          ])}
      />
    </Panel>
  );
}

function VoidDestroySection(props: {
  voidRecords: VoidRecord[];
  destroyBatches: DestroyBatch[];
  voidForm: { itemType: ItemType; quantity: number; responsiblePerson: string; reason: string };
  setVoidForm: React.Dispatch<React.SetStateAction<{ itemType: ItemType; quantity: number; responsiblePerson: string; reason: string }>>;
  destroyForm: { title: string; responsiblePerson: string; notes: string };
  setDestroyForm: React.Dispatch<React.SetStateAction<{ title: string; responsiblePerson: string; notes: string }>>;
  destroySelection: Record<string, boolean>;
  setDestroySelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  pendingVoidRecords: VoidRecord[];
  isBranchOperator: boolean;
  isHeadquartersOperator: boolean;
  isSubmitting: boolean;
  onSubmitVoid: () => void;
  onCreateDestroy: () => void;
  onConfirmDestroy: (id: string) => void;
  onExportDestroy: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Panel title="作废登记" icon={<XCircle className="w-5 h-5 text-red-600" />}>
        {props.isBranchOperator && (
          <div className="grid grid-cols-1 md:grid-cols-[160px_120px_160px_1fr_auto] gap-3 mb-4">
            <select value={props.voidForm.itemType} onChange={(event) => props.setVoidForm((prev) => ({ ...prev, itemType: event.target.value as ItemType }))} className="form-control">
              <option value="BLANK_CERT">空白证书</option>
              <option value="CERT_SHELL">证书壳</option>
            </select>
            <input type="number" min={1} value={props.voidForm.quantity} onChange={(event) => props.setVoidForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))} className="form-control" />
            <input value={props.voidForm.responsiblePerson} onChange={(event) => props.setVoidForm((prev) => ({ ...prev, responsiblePerson: event.target.value }))} className="form-control" placeholder="责任人" />
            <input value={props.voidForm.reason} onChange={(event) => props.setVoidForm((prev) => ({ ...prev, reason: event.target.value }))} className="form-control" placeholder="作废原因" />
            <button disabled={props.isSubmitting} onClick={props.onSubmitVoid} className="icon-button bg-red-600 text-white disabled:bg-red-300">
              <XCircle className="w-4 h-4" />
              登记
            </button>
          </div>
        )}
        <DataTable
          headers={['机构', '计划', '物品', '数量', '状态', '原因']}
          rows={props.voidRecords.map((record) => [
            record.tenant?.name || '-',
            record.plan?.title || '-',
            itemTypeLabels[record.itemType],
            record.quantity,
            record.status === 'DESTROYED' ? '已销毁' : '待销毁',
            record.reason,
          ])}
        />
      </Panel>

      <Panel title="总部销毁批次" icon={<RotateCcw className="w-5 h-5 text-blue-600" />}>
        {props.isHeadquartersOperator && (
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_1fr_auto] gap-3">
              <input value={props.destroyForm.title} onChange={(event) => props.setDestroyForm((prev) => ({ ...prev, title: event.target.value }))} className="form-control" />
              <input value={props.destroyForm.responsiblePerson} onChange={(event) => props.setDestroyForm((prev) => ({ ...prev, responsiblePerson: event.target.value }))} className="form-control" placeholder="销毁责任人" />
              <input value={props.destroyForm.notes} onChange={(event) => props.setDestroyForm((prev) => ({ ...prev, notes: event.target.value }))} className="form-control" placeholder="备注" />
              <button disabled={props.isSubmitting || Object.values(props.destroySelection).every((checked) => !checked)} onClick={props.onCreateDestroy} className="icon-button bg-blue-600 text-white disabled:bg-blue-300">
                <RotateCcw className="w-4 h-4" />
                创建批次
              </button>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {props.pendingVoidRecords.map((record) => (
                <label key={record.id} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <input type="checkbox" checked={Boolean(props.destroySelection[record.id])} onChange={(event) => props.setDestroySelection((prev) => ({ ...prev, [record.id]: event.target.checked }))} />
                  {record.tenant?.name || '-'} · {itemTypeLabels[record.itemType]} x {record.quantity}
                </label>
              ))}
            </div>
          </div>
        )}
        <DataTable
          headers={['批次', '状态', '记录数', '创建时间', '操作']}
          rows={props.destroyBatches.map((batch) => [
            batch.title,
            batch.status === 'CLOSED' ? '已确认销毁' : '草稿',
            batch.voidRecords?.length || 0,
            formatDateTime(batch.createdAt),
            <div key={batch.id} className="flex flex-wrap gap-2">
              {props.isHeadquartersOperator && batch.status === 'DRAFT' && <ActionLink onClick={() => props.onConfirmDestroy(batch.id)}>确认销毁</ActionLink>}
              <ActionLink onClick={() => props.onExportDestroy(batch.id)}>打印表</ActionLink>
            </div>,
          ])}
        />
      </Panel>
    </div>
  );
}

function ReissueSection(props: {
  reissueRequests: ReissueRequest[];
  reissueForm: ReissueFormState;
  setReissueForm: React.Dispatch<React.SetStateAction<ReissueFormState>>;
  isBranchOperator: boolean;
  isSubmitting: boolean;
  onSubmitReissue: () => void;
  onReviewReissue: (id: string, approved: boolean) => void;
  onIssueReissue: (id: string) => void;
  onExportReissue: (id: string) => void;
}) {
  const update = (field: keyof typeof props.reissueForm, value: string | number) => {
    props.setReissueForm((prev: typeof props.reissueForm) => ({ ...prev, [field]: value }));
  };

  return (
    <Panel title="遗失补办" icon={<FileText className="w-5 h-5 text-blue-600" />}>
      {props.isBranchOperator && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <input value={props.reissueForm.applicantName} onChange={(event) => update('applicantName', event.target.value)} className="form-control" placeholder="申请人" />
          <input value={props.reissueForm.applicantPhone} onChange={(event) => update('applicantPhone', event.target.value)} className="form-control" placeholder="联系电话" />
          <input value={props.reissueForm.applicantIdCard} onChange={(event) => update('applicantIdCard', event.target.value)} className="form-control" placeholder="证件号码" />
          <input value={props.reissueForm.certNo} onChange={(event) => update('certNo', event.target.value)} className="form-control" placeholder="原证书编号" />
          <input value={props.reissueForm.reason} onChange={(event) => update('reason', event.target.value)} className="form-control" placeholder="补办原因" />
          <input value={props.reissueForm.mailingAddress} onChange={(event) => update('mailingAddress', event.target.value)} className="form-control" placeholder="邮寄地址" />
          <input value={props.reissueForm.responsiblePerson} onChange={(event) => update('responsiblePerson', event.target.value)} className="form-control" placeholder="责任人" />
          <NumberField label="补办费/分" value={props.reissueForm.feeCents} onChange={(value) => update('feeCents', value)} />
          <NumberField label="邮寄费/分" value={props.reissueForm.mailingFeeCents} onChange={(value) => update('mailingFeeCents', value)} />
          <button disabled={props.isSubmitting} onClick={props.onSubmitReissue} className="icon-button bg-blue-600 text-white disabled:bg-blue-300 self-end">
            <FileText className="w-4 h-4" />
            提交补办
          </button>
        </div>
      )}
      <DataTable
        headers={['申请人', '证书编号', '状态', '审核期限', '补办期限', '操作']}
        rows={props.reissueRequests.map((request) => [
          request.applicantName,
          request.certNo || '-',
          reissueStatusLabels[request.status],
          formatDate(request.reviewDueAt),
          request.remakeDueAt ? formatDate(request.remakeDueAt) : '-',
          <div key={request.id} className="flex flex-wrap gap-2">
            {props.isBranchOperator && request.status === 'SUBMITTED' && <ActionLink onClick={() => props.onReviewReissue(request.id, true)}>通过</ActionLink>}
            {props.isBranchOperator && request.status === 'SUBMITTED' && <ActionLink tone="danger" onClick={() => props.onReviewReissue(request.id, false)}>驳回</ActionLink>}
            {props.isBranchOperator && request.status === 'APPROVED' && <ActionLink onClick={() => props.onIssueReissue(request.id)}>发放</ActionLink>}
            <ActionLink onClick={() => props.onExportReissue(request.id)}>申请书模板</ActionLink>
          </div>,
        ])}
      />
    </Panel>
  );
}

function StocktakeSection(props: {
  stocktakes: StocktakeRecord[];
  balances: StockBalance[];
  stocktakeForm: { itemType: ItemType; stocktakeType: StocktakeType; actualQuantity: number; responsiblePerson: string; notes: string };
  setStocktakeForm: React.Dispatch<React.SetStateAction<{ itemType: ItemType; stocktakeType: StocktakeType; actualQuantity: number; responsiblePerson: string; notes: string }>>;
  isBranchOperator: boolean;
  isSubmitting: boolean;
  onSubmitStocktake: () => void;
  onExportStocktakes: () => void;
}) {
  return (
    <div className="space-y-5">
      <Panel title="提醒" icon={<PackageCheck className="w-5 h-5 text-amber-600" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {props.balances.flatMap((balance) => (['BLANK_CERT', 'CERT_SHELL'] as ItemType[]).map((itemType) => (
            <div key={`${balance.tenant.id}-${itemType}`} className="rounded-md border border-slate-200 p-3">
              <div className="font-medium text-slate-900">{balance.tenant.name} · {itemTypeLabels[itemType]}</div>
              <div className="text-sm text-slate-600 mt-1">可用 {balance[itemType].balance} · 待销毁 {balance[itemType].pendingDestroy}</div>
              <div className={balance[itemType].reminder ? 'text-sm text-amber-600 mt-1' : 'text-sm text-green-600 mt-1'}>
                {balance[itemType].reminder || '库存正常'}
              </div>
            </div>
          )))}
        </div>
      </Panel>

      <Panel title="盘点记录" icon={<ClipboardCheck className="w-5 h-5 text-blue-600" />}>
        {props.isBranchOperator && (
          <div className="grid grid-cols-1 md:grid-cols-[160px_160px_140px_160px_1fr_auto] gap-3 mb-4">
            <select value={props.stocktakeForm.itemType} onChange={(event) => props.setStocktakeForm((prev) => ({ ...prev, itemType: event.target.value as ItemType }))} className="form-control">
              <option value="BLANK_CERT">空白证书</option>
              <option value="CERT_SHELL">证书壳</option>
            </select>
            <select value={props.stocktakeForm.stocktakeType} onChange={(event) => props.setStocktakeForm((prev) => ({ ...prev, stocktakeType: event.target.value as StocktakeType }))} className="form-control">
              <option value="QUARTERLY">季度盘点</option>
              <option value="HALF_YEAR">半年抽查</option>
              <option value="ANNUAL">年度盘点</option>
              <option value="MANUAL">临时盘点</option>
            </select>
            <input type="number" min={0} value={props.stocktakeForm.actualQuantity} onChange={(event) => props.setStocktakeForm((prev) => ({ ...prev, actualQuantity: Number(event.target.value) }))} className="form-control" />
            <input value={props.stocktakeForm.responsiblePerson} onChange={(event) => props.setStocktakeForm((prev) => ({ ...prev, responsiblePerson: event.target.value }))} className="form-control" placeholder="责任人" />
            <input value={props.stocktakeForm.notes} onChange={(event) => props.setStocktakeForm((prev) => ({ ...prev, notes: event.target.value }))} className="form-control" placeholder="备注" />
            <button disabled={props.isSubmitting} onClick={props.onSubmitStocktake} className="icon-button bg-blue-600 text-white disabled:bg-blue-300">
              <ClipboardCheck className="w-4 h-4" />
              保存
            </button>
          </div>
        )}
        <button onClick={props.onExportStocktakes} className="icon-button border-slate-300 text-slate-700 hover:bg-slate-50 mb-3">
          <Download className="w-4 h-4" />
          导出盘点记录
        </button>
        <DataTable
          headers={['机构', '物品', '类型', '账面', '实盘', '差异', '责任人', '时间']}
          rows={props.stocktakes.map((record) => [
            record.tenant?.name || '-',
            itemTypeLabels[record.itemType],
            stocktakeTypeLabels[record.stocktakeType],
            record.bookBalance,
            record.actualQuantity,
            record.variance,
            record.responsiblePerson,
            formatDateTime(record.createdAt),
          ])}
        />
      </Panel>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
        {icon}
        <h2 className="font-bold text-slate-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="text-left px-3 py-3">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3 text-slate-700">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState text="暂无记录" />}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-sm">
      <span className="block text-slate-600 mb-1">{label}</span>
      <input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className="form-control w-full" />
    </label>
  );
}

function ActionLink({ children, onClick, tone = 'default' }: { children: React.ReactNode; onClick: () => void; tone?: 'default' | 'danger' }) {
  return (
    <button onClick={onClick} className={tone === 'danger' ? 'text-red-600 hover:text-red-700 font-medium' : 'text-blue-600 hover:text-blue-700 font-medium'}>
      {children}
    </button>
  );
}

function Message({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tone === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
      {text}
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-10 text-sm text-slate-400">{text}</div>;
}

function scoreValue(value?: number | null): string {
  return value === null || value === undefined ? '-' : String(value);
}

function certificateStatusLabel(status?: Certificate['status']): string {
  if (!status) return '未回填';
  const labels: Record<Certificate['status'], string> = {
    PENDING: '待打印',
    PRINTED: '已打印',
    ISSUED: '已发放',
    REISSUE_REQUESTED: '申请补办',
  };
  return labels[status];
}
