import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useApi } from '@/hooks/useApi';
import {
  LayoutDashboard, ClipboardList, Users, Award, UserPlus,
  FileText, Settings, Bot, LogOut, Building2,
  CalendarDays, Bell
} from 'lucide-react';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/prospective-candidates', label: '意向考生', icon: UserPlus, roles: ['BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/plans', label: '考评计划', icon: CalendarDays, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/nodes', label: '节点追踪', icon: ClipboardList, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/candidates', label: '考生管理', icon: Users, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/scores', label: '成绩管理', icon: Award, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/certificates', label: '证书管理', icon: FileText, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/archives', label: '档案管理', icon: FileText, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/ai-ops', label: 'AI运维', icon: Bot, roles: ['SYS_ADMIN'] },
  { path: '/settings', label: '系统设置', icon: Settings, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
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

  const filteredNav = navItems.filter((item) => {
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <aside className="w-20 md:w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0 shrink-0">
      {/* Logo */}
      <div className="p-4 md:p-6 border-b border-slate-700">
        <div className="flex items-center justify-center md:justify-start gap-3">
          <Building2 className="w-8 h-8 text-blue-400" />
          <div className="hidden md:block">
            <h1 className="font-bold text-lg leading-tight">考评管理系统</h1>
            <p className="text-xs text-slate-400">职业技能等级认定</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-center md:justify-start gap-3 px-3 md:px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
            <span className="hidden md:inline text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-3 md:p-4 border-t border-slate-700">
        <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
            {user?.realName?.[0] || '?'}
          </div>
          <div className="hidden md:block flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.realName}</p>
            <p className="text-xs text-slate-400 truncate">{tenant?.name}</p>
          </div>
          <div className="hidden md:block relative">
            <Bell className="w-5 h-5 text-slate-400" />
            {reminderCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                {reminderCount > 99 ? '99+' : reminderCount}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={clearAuth}
          className="flex items-center justify-center md:justify-start gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full md:w-auto"
          title="退出登录"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">退出登录</span>
        </button>
      </div>
    </aside>
  );
}
