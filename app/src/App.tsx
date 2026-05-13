import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { apiClient } from '@/hooks/useApi';
import type { ApiResponse, Tenant, User } from '@/shared';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ProspectiveCandidates from '@/pages/ProspectiveCandidates';
import ExamPlans from '@/pages/ExamPlans';
import ExamNodes from '@/pages/ExamNodes';
import Candidates from '@/pages/Candidates';
import Scores from '@/pages/Scores';
import Certificates from '@/pages/Certificates';
import Archives from '@/pages/Archives';
import AiOps from '@/pages/AiOps';
import Settings from '@/pages/Settings';

// 路由守卫组件
function ProtectedRoute({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: string[] }) {
  const { isAuthenticated, isLoading, user, hasRole } = useAuthStore();
  const location = useLocation();

  if (isLoading || (isAuthenticated && !user)) {
    return <div className="p-8 text-slate-500">登录状态恢复中...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    return <Navigate to="/" replace />;
  }

  return <ErrorBoundary resetKey={`${location.pathname}${location.search}`}>{children}</ErrorBoundary>;
}

// 角色路由配置
const routeConfig = [
  { path: '/', element: <Dashboard />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/prospective-candidates', element: <ProspectiveCandidates />, roles: ['BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/plans', element: <ExamPlans />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/nodes', element: <ExamNodes />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/candidates', element: <Candidates />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/scores', element: <Scores />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/certificates', element: <Certificates />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/archives', element: <Archives />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/ai-ops', element: <AiOps />, roles: ['SYS_ADMIN'] },
  { path: '/settings', element: <Settings />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
];

function App() {
  const { token, user, setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!token || user) return;

      setLoading(true);
      try {
        const response = await apiClient.get<ApiResponse<{ user: User; tenant: Tenant }>>('/auth/me');
        if (!cancelled && response.data.success && response.data.data) {
          setAuth(response.data.data.user, response.data.data.tenant, token);
        }
      } catch {
        if (!cancelled) clearAuth();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [clearAuth, setAuth, setLoading, token, user]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 登录页（公开） */}
        <Route path="/login" element={<Login />} />

        {/* 受保护的路由 */}
        <Route element={<Layout />}>
          {routeConfig.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <ProtectedRoute requiredRoles={route.roles}>
                  {route.element}
                </ProtectedRoute>
              }
            />
          ))}
        </Route>

        {/* 默认重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
