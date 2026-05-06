import { CheckCircle2, Clock, AlertTriangle, XCircle, PlayCircle } from 'lucide-react';
import type { ExamNode } from '@/shared';
import { NODE_METADATA, NODE_STATUS_LABELS, NODE_STATUS_COLORS } from '@/lib/constants';
import { formatDate, getCountdownStatus } from '@/lib/dateUtils';

interface NodeCardProps {
  node: ExamNode;
  onComplete?: (nodeId: string) => void;
  onViewDetail?: (node: ExamNode) => void;
}

const statusIcons = {
  PENDING: Clock,
  IN_PROGRESS: PlayCircle,
  COMPLETED: CheckCircle2,
  OVERDUE: AlertTriangle,
  SKIPPED: XCircle,
};

export function NodeCard({ node, onComplete, onViewDetail }: NodeCardProps) {
  const meta = NODE_METADATA[node.nodeType];
  const StatusIcon = statusIcons[node.status];
  const countdown = getCountdownStatus(node.deadline);

  return (
    <div
      className={`relative rounded-xl border-2 p-5 transition-all hover:shadow-md cursor-pointer ${NODE_STATUS_COLORS[node.status]}`}
      onClick={() => onViewDetail?.(node)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-5 h-5" />
          <span className="font-bold text-base">{meta?.label || node.nodeType}</span>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-white/80">
          {NODE_STATUS_LABELS[node.status]}
        </span>
      </div>

      <p className="text-sm mb-3 opacity-80">{meta?.description}</p>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="opacity-60">截止时间</span>
          <span className="font-medium">{formatDate(node.deadline)}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">剩余时间</span>
          <span className={`font-medium ${
            countdown.variant === 'overdue' ? 'text-red-600' :
            countdown.variant === 'danger' ? 'text-red-500' :
            countdown.variant === 'warning' ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {countdown.text}
          </span>
        </div>
        {node.completedAt && (
          <div className="flex justify-between">
            <span className="opacity-60">完成时间</span>
            <span className="font-medium">{formatDate(node.completedAt)}</span>
          </div>
        )}
      </div>

      {node.status === 'PENDING' || node.status === 'IN_PROGRESS' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete?.(node.id);
          }}
          className="mt-4 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          标记完成
        </button>
      ) : node.status === 'OVERDUE' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete?.(node.id);
          }}
          className="mt-4 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          补录完成
        </button>
      ) : null}
    </div>
  );
}
