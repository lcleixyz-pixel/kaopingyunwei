import { CheckCircle2, Clock, AlertTriangle, XCircle, PlayCircle } from 'lucide-react';
import type { ExamNode } from '@/shared';
import { NODE_METADATA, NODE_STATUS_LABELS, NODE_STATUS_COLORS } from '@/lib/constants';
import { formatDate, getCountdownStatus } from '@/lib/dateUtils';

interface NodeCardProps {
  node: ExamNode;
  onComplete?: (node: ExamNode) => void;
  actionLabel?: string;
  onPrimaryAction?: (node: ExamNode) => void;
  onViewDetail?: (node: ExamNode) => void;
}

const statusIcons = {
  PENDING: Clock,
  IN_PROGRESS: PlayCircle,
  COMPLETED: CheckCircle2,
  OVERDUE: AlertTriangle,
  SKIPPED: XCircle,
};

export function NodeCard({ node, onComplete, actionLabel, onPrimaryAction, onViewDetail }: NodeCardProps) {
  const meta = NODE_METADATA[node.nodeType];
  const displayStatus = node.isOverdue && node.status !== 'COMPLETED' ? 'OVERDUE' : node.status;
  const StatusIcon = statusIcons[displayStatus];
  const countdown = getCountdownStatus(node.deadline);

  return (
    <div
      className={`relative rounded-xl border-2 p-5 transition-all hover:shadow-md cursor-pointer ${NODE_STATUS_COLORS[displayStatus]}`}
      onClick={() => onViewDetail?.(node)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-5 h-5" />
          <span className="font-bold text-base">{meta?.label || node.nodeType}</span>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-white/80">
          {NODE_STATUS_LABELS[displayStatus]}
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

      {node.status === 'IN_PROGRESS' && onComplete ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete?.(node);
          }}
          className="mt-4 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {node.isOverdue ? '逾期补录完成' : '标记完成'}
        </button>
      ) : onPrimaryAction && actionLabel ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrimaryAction(node);
          }}
          className="mt-4 w-full py-2 px-4 bg-white/80 hover:bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium transition-colors"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
