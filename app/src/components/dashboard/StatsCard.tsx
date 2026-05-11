import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

const variantStyles = {
  default: 'bg-white border-slate-200',
  warning: 'bg-white border-amber-200 shadow-[inset_0_3px_0_#f59e0b]',
  danger: 'bg-white border-red-200 shadow-[inset_0_3px_0_#ef4444]',
  success: 'bg-white border-emerald-200 shadow-[inset_0_3px_0_#10b981]',
};

const iconStyles = {
  default: 'text-slate-500 bg-slate-100',
  warning: 'text-amber-600 bg-amber-100',
  danger: 'text-red-600 bg-red-100',
  success: 'text-emerald-600 bg-emerald-100',
};

export function StatsCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatsCardProps) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${iconStyles[variant]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
