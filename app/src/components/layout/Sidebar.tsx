import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard, ClipboardList, Users, Award,
  FileText, Settings, Bot, LogOut, Building2,
  CalendarDays, Bell
} from 'lucide-react';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/plans', label: '考评计划', icon: CalendarDays, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/nodes', label: '节点追踪', icon: ClipboardList, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/candidates', label: '考生管理', icon: Users, roles: ['SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/scores', label: '成绩管理', icon: Award, roles: ['SYS_ADMIN', 'EXAMINER', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/certificates', label: '证书管理', icon: FileText, roles: ['SYS_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/archives', label: '档案管理', icon: FileText, roles: ['SYS_ADMIN', 'HQ_ADMIN'] },
  { path: '/ai-ops', label: 'AI运维', icon: Bot, roles: ['SYS_ADMIN'] },
  { path: '/settings', label: '系统设置', icon: Settings, roles: ['SYS_ADMIN', 'HQ_ADMIN'] },
];

export function Sidebar() {
  const { user, tenant, clearAuth } = useAuthStore();

  const filteredNav = navItems.filter((item) => {
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-400" />
          <div>
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
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
            {user?.realName?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.realName}</p>
            <p className="text-xs text-slate-400 truncate">{tenant?.name}</p>
          </div>
          <div className="relative">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
              2
            </span>
          </div>
        </div>
        <button
          onClick={clearAuth}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
