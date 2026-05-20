import type { ReactNode } from 'react';

type AlertTone = 'error' | 'success' | 'warning' | 'info';

const toneClass: Record<AlertTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
};

export function PageAlert({
  tone = 'info',
  children,
  requestId,
}: {
  tone?: AlertTone;
  children: ReactNode;
  requestId?: string;
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${toneClass[tone]}`}>
      <div>{children}</div>
      {requestId && <div className="mt-1 text-xs opacity-75">请求编号：{requestId}</div>}
    </div>
  );
}
