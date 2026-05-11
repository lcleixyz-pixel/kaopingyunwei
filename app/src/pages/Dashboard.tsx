import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExamStore } from '@/stores/examStore';
import { useAuthStore } from '@/stores/authStore';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { NodeCard } from '@/components/exam/NodeCard';
import { useApi } from '@/hooks/useApi';
import type { DashboardStats, ExamNode, ActivityItem, ExamPlan } from '@/shared';
import { formatDate } from '@/lib/dateUtils';
import { deriveBranchWorkbenchTasks, getPlanStageSummary, isBranchRole, type WorkbenchTask, type WorkbenchTaskTone } from '@/lib/workbenchRules';
import {
  ClipboardList, Users, AlertTriangle,
  Building2, CalendarDays, TrendingUp, Bell, BarChart3, ArrowRight, FileCheck2, TimerReset
} from 'lucide-react';

interface ReportRow {
  label: string;
  planCount: number;
  candidateCount: number;
  passCount: number;
  overdueNodes: number;
}

interface DashboardReports {
  byProfession: ReportRow[];
  byQuarter: ReportRow[];
}

interface HqRegistrationProgressRow {
  planId: string;
  planTitle: string;
  tenant: { code: string; name: string };
  status: string;
  profession: string;
  level: string;
  nodes: { total: number; completed: number; overdue: number };
  candidates: {
    totalCandidates: number;
    approvedCandidates: number;
    materialCompleteCandidates: number;
    exportEligibleCandidates: number;
  };
  localUpload: { status: string; uploadedAt: string; notes?: string } | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { get } = useApi();
  const { user } = useAuthStore();
  const userRole = user?.role;
  const { dashboardStats, setDashboardStats, setNodes } = useExamStore();
  const [recentNodes, setRecentNodes] = useState<ExamNode[]>([]);
  const [allNodes, setAllNodes] = useState<ExamNode[]>([]);
  const [publishedPlans, setPublishedPlans] = useState<ExamPlan[]>([]);
  const [reports, setReports] = useState<DashboardReports | null>(null);
  const [hqProgress, setHqProgress] = useState<HqRegistrationProgressRow[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const stats = await get<DashboardStats>('/dashboard');
      setDashboardStats(stats);
      const reportData = await get<DashboardReports>('/dashboard/reports');
      setReports(reportData);
      
      // 同时获取节点列表
      const nodesData = await get<ExamNode[]>('/exam-nodes');
      setNodes(nodesData);
      setAllNodes(nodesData);
      setRecentNodes(nodesData.filter((n) => n.isOverdue || n.status === 'IN_PROGRESS').slice(0, 6));
      setPublishedPlans(await get<ExamPlan[]>('/exam-plans', { status: 'PUBLISHED' }));
      if (userRole === 'SYS_ADMIN' || userRole === 'HQ_ADMIN' || userRole === 'HQ_STAFF') {
        setHqProgress(await get<HqRegistrationProgressRow[]>('/hq/reports/registration-progress'));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, [get, setDashboardStats, setNodes, userRole]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleViewNode = (_node: ExamNode) => {
    navigate('/nodes');
  };
  const branchMode = isBranchRole(userRole);
  const branchTasks = deriveBranchWorkbenchTasks({
    stats: dashboardStats,
    plans: publishedPlans,
    nodes: allNodes,
  });
  const planSummary = getPlanStageSummary(publishedPlans);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{branchMode ? '今日工作台' : '运维总览'}</h1>
          <p className="text-slate-500 mt-1">
            欢迎回来，{user?.realName}。{branchMode ? '先处理待办、风险和进行中计划。' : '以下是系统概览与分支进度。'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
          <Bell className="w-4 h-4" />
          <span>最后更新: {new Date().toLocaleTimeString('zh-CN')}</span>
        </div>
      </div>

      {branchMode && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">优先待办</h2>
                <p className="mt-1 text-sm text-slate-500">按截止风险和业务闸门排序，点“继续处理”进入对应工作区。</p>
              </div>
              <button
                onClick={fetchDashboard}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                刷新
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {branchTasks.slice(0, 4).map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => navigate(task.href)} />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">计划阶段</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StageMetric label="报名开放" value={planSummary.registrationOpen} tone="green" />
              <StageMetric label="即将截止" value={planSummary.registrationClosingSoon} tone="amber" />
              <StageMetric label="已发布" value={planSummary.totalPublished} tone="blue" />
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <TimerReset className="h-4 w-4 text-blue-600" />
                下一场考试
              </div>
              {planSummary.nextExamPlan ? (
                <div className="mt-2 text-slate-600">
                  <div className="font-medium text-slate-900">{planSummary.nextExamPlan.title}</div>
                  <div>{formatDate(planSummary.nextExamPlan.examDate)} · 报名截止 {formatDate(planSummary.nextExamPlan.registrationDeadline)}</div>
                </div>
              ) : (
                <p className="mt-2 text-slate-500">暂无未来已发布计划</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="进行中计划"
          value={dashboardStats?.activePlans || 0}
          subtitle={`共 ${dashboardStats?.totalPlans || 0} 个计划`}
          icon={ClipboardList}
          variant="default"
        />
        <StatsCard
          title="考生总数"
          value={dashboardStats?.totalCandidates || 0}
          subtitle="本季度"
          icon={Users}
          variant="success"
        />
        <StatsCard
          title="待处理节点"
          value={dashboardStats?.pendingNodes || 0}
          subtitle={`${dashboardStats?.pendingReminders || 0} 条提醒`}
          icon={TrendingUp}
          variant="warning"
        />
        <StatsCard
          title="逾期节点"
          value={dashboardStats?.overdueNodes || 0}
          subtitle="需立即处理"
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Node Tracking */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              节点追踪
            </h2>
            <button
              onClick={() => navigate('/nodes')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              查看全部
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {recentNodes.length > 0 ? (
              recentNodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  onViewDetail={handleViewNode}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 md:col-span-2">
                当前没有逾期或进行中的节点。
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Activities */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              最近动态
            </h3>
            <div className="space-y-4">
              {dashboardStats?.recentActivities.map((activity: ActivityItem) =>(
                <div key={activity.id} className="flex gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    activity.type === 'NODE_OVERDUE' ? 'bg-red-500' :
                    activity.type === 'NODE_COMPLETE' ? 'bg-green-500' :
                    activity.type === 'PLAN_CREATE' ? 'bg-blue-500' :
                    'bg-amber-500'
                  }`} />
                  <div>
                    <p className="font-medium text-slate-800">{activity.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{activity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              机构信息
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">机构名称</span>
                <span className="font-medium">{user?.tenant?.name || '总部'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">分支机构</span>
                <span className="font-medium">{dashboardStats?.totalBranches || 0} 个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">已完成计划</span>
                <span className="font-medium text-green-600">{dashboardStats?.completedPlans || 0} 个</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reports */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          报表统计
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ReportTable title="按工种/等级" rows={reports?.byProfession || []} />
          <ReportTable title="按季度" rows={reports?.byQuarter || []} />
        </div>
      </div>

      {hqProgress.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <FileProgressIcon />
            总部报名资料进度
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500">机构</th>
                  <th className="text-left px-3 py-2 text-slate-500">计划</th>
                  <th className="text-right px-3 py-2 text-slate-500">节点</th>
                  <th className="text-right px-3 py-2 text-slate-500">考生</th>
                  <th className="text-right px-3 py-2 text-slate-500">材料齐全</th>
                  <th className="text-right px-3 py-2 text-slate-500">审核通过</th>
                  <th className="text-right px-3 py-2 text-slate-500">可导出</th>
                  <th className="text-left px-3 py-2 text-slate-500">上传状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hqProgress.slice(0, 8).map((row) => (
                  <tr key={row.planId}>
                    <td className="px-3 py-2 font-medium text-slate-800">{row.tenant.name}</td>
                    <td className="px-3 py-2 text-slate-700">{row.planTitle}</td>
                    <td className="px-3 py-2 text-right">{row.nodes.completed}/{row.nodes.total}</td>
                    <td className="px-3 py-2 text-right">{row.candidates.totalCandidates}</td>
                    <td className="px-3 py-2 text-right">{row.candidates.materialCompleteCandidates}</td>
                    <td className="px-3 py-2 text-right">{row.candidates.approvedCandidates}</td>
                    <td className="px-3 py-2 text-right">{row.candidates.exportEligibleCandidates}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.localUpload ? `已上传 ${formatDate(row.localUpload.uploadedAt)}` : '未回填'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const taskToneStyles: Record<WorkbenchTaskTone, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  primary: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

function TaskCard({ task, onClick }: { task: WorkbenchTask; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex min-h-32 flex-col justify-between rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${taskToneStyles[task.tone]}`}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold text-slate-950">{task.title}</span>
          {typeof task.count === 'number' && (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">{task.count}</span>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
        {task.actionLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function StageMetric({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' | 'blue' }) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  }[tone];
  return (
    <div className={`rounded-lg px-3 py-3 text-center ${styles}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-medium">{label}</p>
    </div>
  );
}

function FileProgressIcon() {
  return <FileCheck2 className="w-5 h-5 text-blue-600" />;
}

function ReportTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <div>
      <h3 className="font-medium text-slate-800 mb-3">{title}</h3>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 text-slate-500">维度</th>
              <th className="text-right px-3 py-2 text-slate-500">计划</th>
              <th className="text-right px-3 py-2 text-slate-500">考生</th>
              <th className="text-right px-3 py-2 text-slate-500">合格</th>
              <th className="text-right px-3 py-2 text-slate-500">逾期</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">暂无数据</td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.label}>
                <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                <td className="px-3 py-2 text-right">{row.planCount}</td>
                <td className="px-3 py-2 text-right">{row.candidateCount}</td>
                <td className="px-3 py-2 text-right text-green-700">{row.passCount}</td>
                <td className="px-3 py-2 text-right text-red-700">{row.overdueNodes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
