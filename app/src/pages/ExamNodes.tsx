import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, CalendarDays, Loader2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import type { ExamNode } from '@/shared';
import { NodeCard } from '@/components/exam/NodeCard';
import { NODE_STATUS_LABELS, NODE_METADATA, NODE_ORDER } from '@/lib/constants';

export default function ExamNodes() {
  const { get, post } = useApi();
  const [nodes, setNodes] = useState<ExamNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchNodes = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const data = await get<ExamNode[]>('/exam-nodes', params);
      setNodes(data);
    } catch (err: any) {
      setError(err?.message || '获取节点列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [get, statusFilter]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const handleCompleteNode = async (nodeId: string) => {
    try {
      await post(`/exam-nodes/${nodeId}/complete`, {});
      fetchNodes();
    } catch (err: any) {
      setError(err?.message || '完成节点失败');
    }
  };

  const handleViewNode = (node: ExamNode) => {
    console.log('查看节点:', node);
  };

  const filteredNodes = nodes.filter((node) => {
    const meta = NODE_METADATA[node.nodeType];
    const matchesSearch = !searchQuery || meta?.label?.includes(searchQuery) || node.plan?.title?.includes(searchQuery);
    const matchesStatus = statusFilter === 'ALL' || node.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    ALL: nodes.length,
    PENDING: nodes.filter((n) => n.status === 'PENDING').length,
    IN_PROGRESS: nodes.filter((n) => n.status === 'IN_PROGRESS').length,
    COMPLETED: nodes.filter((n) => n.status === 'COMPLETED').length,
    OVERDUE: nodes.filter((n) => n.status === 'OVERDUE').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            考评节点追踪
          </h1>
          <p className="text-slate-500 mt-1">管理所有考评流程节点，确保按时完成</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索节点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {Object.entries(statusCounts).map(([status, count]) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status === 'ALL' ? '全部' : NODE_STATUS_LABELS[status]} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <span className="font-medium">节点说明：</span>
        {NODE_ORDER.map((type) => {
          const meta = NODE_METADATA[type];
          return (
            <span key={type} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              {meta?.label}
              <span className="text-slate-400">(D{meta?.deadlineDays >= 0 ? '+' : ''}{meta?.deadlineDays})</span>
            </span>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-slate-500">加载中...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onComplete={handleCompleteNode}
              onViewDetail={handleViewNode}
            />
          ))}
        </div>
      )}

      {!isLoading && filteredNodes.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium">暂无节点</p>
          <p className="text-sm mt-1">请先创建考评计划</p>
        </div>
      )}
    </div>
  );
}
