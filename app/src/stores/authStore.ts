// ═══════════════════════════════════════════════════
// 认证状态管理 (Zustand)
// ═══════════════════════════════════════════════════

import { create } from 'zustand';
import type { User, Tenant } from '@/shared';

interface AuthState {
  // 状态
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // 操作
  setAuth: (user: User, tenant: Tenant, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  hasRole: (roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tenant: null,
  token: localStorage.getItem('exam_token'),
  isAuthenticated: !!localStorage.getItem('exam_token'),
  isLoading: false,

  setAuth: (user, tenant, token) => {
    localStorage.setItem('exam_token', token);
    set({ user, tenant, token, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('exam_token');
    set({ user: null, tenant: null, token: null, isAuthenticated: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  hasRole: (roles) => {
    const { user } = get();
    if (!user) return false;
    return roles.includes(user.role);
  },
}));
