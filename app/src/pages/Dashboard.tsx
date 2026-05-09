import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExamStore } from '@/stores/examStore';
import { useAuthStore } from '@/stores/authStore';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { NodeCard } from '@/components/exam/NodeCard';
import { useApi } from '@/hooks/useApi';
import type { DashboardStats, ExamNode, ActivityItem } from '@/shared';
import { formatDate } from '@/lib/dateUtils';
import {
  ClipboardList, Users, AlertTriangle,
  Building2, CalendarDays, TrendingUp, Bell, BarChart3
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
  const { get, post } = useApi();
  const { user } = useAuthStore();
  const { dashboardStats, setDashboardStats, setNodes } = useExamStore();
  const [recentNodes, setRecentNodes] = useState<ExamNode[]>([]);
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
      setRecentNodes(nodesData.filter((n) => n.isOverdue || n.status === 'IN_PROGRESS').slice(0, 6));
      if (user?.role === 'SYS_ADMIN' || user?.role === 'HQ_ADMIN' || user?.role === 'HQ_STAFF') {
        setHqProgress(await get<HqRegistrationProgressRow[]>('/hq/reports/registration-progress'));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, [get, setDashboardStats, setNodes, user?.role]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleCompleteNode = async (node: ExamNode) => {
    const notes = window.prompt('请输入节点完成备注');
    if (!notes?.trim()) return;

    try {
      await post(`/exam-nodes/${node.id}/complete`, { notes: notes.trim() });
      fetchDashboard();
    } catch (err) {
      console.error('Complete node error:', err);
    }
  };

  const handleViewNode = (_node: ExamNode) => {
    navigate('/nodes');
  };
  const canCompleteNodes = user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">仪表盘</h1>
          <p className="text-slate-500 mt-1">欢迎回来，{user?.realName}。以下是系统概览。</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Bell className="w-4 h-4" />
          <span>最后更新: {new Date().toLocaleTimeString('zh-CN')}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
              查看全部 →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentNodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                onComplete={canCompleteNodes ? handleCompleteNode : undefined}
                onViewDetail={handleViewNode}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Activities */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
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
          <div className="bg-white rounded-xl border border-slate-200 p-6">
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
      <div className="bg-white rounded-xl border border-slate-200 p-6">
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
        <div className="bg-white rounded-xl border border-slate-200 p-6">
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

function FileProgressIcon() {
  return <BarChart3 className="w-5 h-5 text-blue-600" />;
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
