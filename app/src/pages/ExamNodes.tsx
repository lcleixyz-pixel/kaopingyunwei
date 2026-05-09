import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Loader2, Search } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import type { ExamNode, ExamPlan } from '@/shared';
import { NodeCard } from '@/components/exam/NodeCard';
import { NODE_METADATA, NODE_ORDER } from '@/lib/constants';
import { getNodeTrackingPlans } from '@/lib/nodeTrackingRules';
import { formatDate } from '@/lib/dateUtils';
import { useAuthStore } from '@/stores/authStore';

export default function ExamNodes() {
  const { get, post } = useApi();
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [completeNode, setCompleteNode] = useState<ExamNode | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await get<ExamPlan[]>('/exam-plans', { status: 'PUBLISHED' });
      setPlans(data);
    } catch (err: any) {
      setError(err?.message || '获取节点追踪列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const trackingPlans = useMemo(() => getNodeTrackingPlans(plans), [plans]);
  const filteredPlans = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return trackingPlans;
    return trackingPlans.filter((plan) => {
      const currentNode = getCurrentNode(plan);
      const currentLabel = currentNode ? NODE_METADATA[currentNode.nodeType]?.label : '';
      return [
        plan.title,
        plan.occupation,
        plan.profession,
        plan.level,
        plan.location,
        currentLabel,
      ].some((value) => value?.includes(query));
    });
  }, [searchQuery, trackingPlans]);

  const summary = useMemo(() => {
    const activeNodeCount = trackingPlans.reduce((total, plan) => (
      total + getOrderedNodes(plan).filter((node) => node.status !== 'COMPLETED').length
    ), 0);
    const overduePlanCount = trackingPlans.filter((plan) => getOrderedNodes(plan).some((node) => node.isOverdue)).length;
    const registrationOpenCount = trackingPlans.filter((plan) => !plan.registrationClosed).length;
    return { activeNodeCount, overduePlanCount, registrationOpenCount };
  }, [trackingPlans]);

  const handleCompleteNode = async () => {
    if (!completeNode || !completeNotes.trim()) return;
    setCompleting(true);
    try {
      await post(`/exam-nodes/${completeNode.id}/complete`, { notes: completeNotes.trim() });
      setCompleteNode(null);
      setCompleteNotes('');
      fetchPlans();
    } catch (err: any) {
      setError(err?.message || '完成节点失败');
    } finally {
      setCompleting(false);
    }
  };

  const canCompleteNodes = user?.role === 'BRANCH_ADMIN' || user?.role === 'BRANCH_STAFF';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            考评节点追踪
          </h1>
          <p className="text-slate-500 mt-1">按考试计划追踪未完成认定的已发布计划</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryItem icon={<Clock className="w-4 h-4" />} label="进行中计划" value={trackingPlans.length} />
        <SummaryItem icon={<CheckCircle2 className="w-4 h-4" />} label="待完成节点" value={summary.activeNodeCount} />
        <SummaryItem icon={<AlertTriangle className="w-4 h-4" />} label="逾期计划" value={summary.overduePlanCount} tone="danger" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索计划、职业、工种、等级或当前节点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="text-sm text-slate-500">
            报名未结束：<span className="font-semibold text-slate-800">{summary.registrationOpenCount}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-slate-500">加载中...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPlans.map((plan) => {
            const nodes = getOrderedNodes(plan);
            const currentNode = getCurrentNode(plan);
            const completedCount = nodes.filter((node) => node.status === 'COMPLETED').length;
            return (
              <section key={plan.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{plan.title}</h2>
                    <div className="mt-1 text-sm text-slate-500">
                      {formatDate(plan.examDate)} · {plan.occupation} · {plan.profession} · {plan.level}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      当前：{currentNode ? NODE_METADATA[currentNode.nodeType]?.label : '待确认'}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                      {completedCount}/{nodes.length} 已完成
                    </span>
                    <span className={`rounded-full px-3 py-1 ${plan.registrationClosed ? 'bg-slate-100 text-slate-600' : 'bg-green-50 text-green-700'}`}>
                      {plan.registrationClosed ? '报名已结束' : '报名开放'}
                    </span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {nodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={{ ...node, plan }}
                      onComplete={canCompleteNodes ? (item) => {
                        setCompleteNode(item);
                        setCompleteNotes('');
                      } : undefined}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!isLoading && filteredPlans.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium">暂无需追踪的计划</p>
          <p className="text-sm mt-1">已发布且未完成认定的计划会在这里按考试日期显示</p>
        </div>
      )}

      {completeNode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setCompleteNode(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-2">完成节点</h2>
            <p className="text-sm text-slate-500 mb-4">
              {NODE_METADATA[completeNode.nodeType]?.label || completeNode.nodeType} · {completeNode.plan?.title}
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-1">完成备注</label>
            <textarea
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              className="w-full min-h-28 px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
              placeholder="请填写实际完成情况、材料位置或异常说明"
            />
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setCompleteNode(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
              <button
                onClick={handleCompleteNode}
                disabled={completing || !completeNotes.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {completing && <Loader2 className="w-4 h-4 animate-spin" />}
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getOrderedNodes(plan: ExamPlan): ExamNode[] {
  const now = Date.now();
  return (plan.nodes || [])
    .slice()
    .sort((a, b) => NODE_ORDER.indexOf(a.nodeType) - NODE_ORDER.indexOf(b.nodeType))
    .map((node) => ({
      ...node,
      isOverdue: node.status !== 'COMPLETED' && new Date(node.deadline).getTime() < now,
    }));
}

function getCurrentNode(plan: ExamPlan): ExamNode | undefined {
  const nodes = getOrderedNodes(plan);
  return nodes.find((node) => node.status === 'IN_PROGRESS')
    || nodes.find((node) => node.status !== 'COMPLETED');
}

function SummaryItem(props: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className={props.tone === 'danger' ? 'text-red-600' : 'text-blue-600'}>{props.icon}</span>
        {props.label}
      </div>
      <div className={`text-xl font-bold ${props.tone === 'danger' ? 'text-red-600' : 'text-slate-900'}`}>{props.value}</div>
    </div>
  );
}
