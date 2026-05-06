import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Layout } from '@/components/layout/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
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
  const { isAuthenticated, hasRole } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// 角色路由配置
const routeConfig = [
  { path: '/', element: <Dashboard />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/plans', element: <ExamPlans />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/nodes', element: <ExamNodes />, roles: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/candidates', element: <Candidates />, roles: ['SYS_ADMIN', 'BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/scores', element: <Scores />, roles: ['SYS_ADMIN', 'EXAMINER', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/certificates', element: <Certificates />, roles: ['SYS_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/archives', element: <Archives />, roles: ['SYS_ADMIN', 'HQ_ADMIN'] },
  { path: '/ai-ops', element: <AiOps />, roles: ['SYS_ADMIN'] },
  { path: '/settings', element: <Settings />, roles: ['SYS_ADMIN', 'HQ_ADMIN'] },
];

function App() {
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
