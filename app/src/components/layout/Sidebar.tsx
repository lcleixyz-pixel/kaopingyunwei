import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useApi } from '@/hooks/useApi';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ClipboardList,
  Award,
  UserPlus,
  FileText,
  Settings,
  Bot,
  LogOut,
  Building2,
  CalendarDays,
  Bell,
  Archive,
  FileSpreadsheet,
} from 'lucide-react';

const navGroups = [
  {
    title: '工作台',
    items: [
      { path: '/', label: '今日工作台', icon: LayoutDashboard, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
    ],
  },
  {
    title: '考前准备',
    items: [
      { path: '/prospective-candidates', label: '意向考生', icon: UserPlus, roles: ['BRANCH_ADMIN', 'BRANCH_STAFF'] },
      { path: '/plans', label: '考评计划', icon: CalendarDays, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
      { path: '/candidates', label: '报名资料', icon: FileSpreadsheet, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
    ],
  },
  {
    title: '过程追踪',
    items: [
      { path: '/nodes', label: '节点追踪', icon: ClipboardList, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'], badge: 'reminders' },
      { path: '/scores', label: '成绩管理', icon: Award, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
    ],
  },
  {
    title: '结果管理',
    items: [
      { path: '/certificates', label: '证书管理', icon: FileText, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
      { path: '/archives', label: '档案管理', icon: Archive, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
    ],
  },
  {
    title: '系统能力',
    items: [
      { path: '/ai-ops', label: 'AI运维', icon: Bot, roles: ['SYS_ADMIN'] },
      { path: '/settings', label: '系统设置', icon: Settings, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
    ],
  },
];

export function Sidebar() {
  const { user, tenant, clearAuth } = useAuthStore();
  const { get } = useApi();
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchReminderCount() {
      try {
        const data = await get<{ count: number }>('/reminders/count');
        if (!cancelled) setReminderCount(data.count);
      } catch {
        if (!cancelled) setReminderCount(0);
      }
    }

    if (user) fetchReminderCount();
    return () => {
      cancelled = true;
    };
  }, [get, user]);

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => user && item.roles.includes(user.role)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="sticky top-0 flex h-screen w-[76px] shrink-0 flex-col border-r border-slate-200 bg-white text-slate-900 shadow-sm md:w-72">
      {/* Logo */}
      <div className="border-b border-slate-200 p-4 md:p-5">
        <div className="flex items-center justify-center md:justify-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="hidden md:block">
            <h1 className="font-bold text-lg leading-tight">考评运维台</h1>
            <p className="text-xs text-slate-500">职业技能等级认定</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 overflow-y-auto p-3 md:p-4">
        {filteredGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 md:block">
              {group.title}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  'group relative flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:justify-start',
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_#2563eb]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                )}
                title={item.label}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="hidden md:inline">{item.label}</span>
                {item.badge === 'reminders' && reminderCount > 0 && (
                  <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white md:right-3 md:top-1/2 md:-translate-y-1/2">
                    {reminderCount > 99 ? '99+' : reminderCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User Info */}
      <div className="border-t border-slate-200 p-3 md:p-4">
        <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
            {user?.realName?.[0] || '?'}
          </div>
          <div className="hidden md:block flex-1 min-w-0">
            <p className="truncate text-sm font-semibold">{user?.realName}</p>
            <p className="truncate text-xs text-slate-500">{tenant?.name || ROLE_LABELS[user?.role || '']}</p>
          </div>
          <div className="hidden md:block relative">
            <Bell className="w-5 h-5 text-slate-400" />
            {reminderCount > 0 && (
              <span className="absolute -top-1 -right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                {reminderCount > 99 ? '99+' : reminderCount}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={clearAuth}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 md:justify-start"
          title="退出登录"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">退出登录</span>
        </button>
      </div>
    </aside>
  );
}
