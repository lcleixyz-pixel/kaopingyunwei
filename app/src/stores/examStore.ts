// ═══════════════════════════════════════════════════
// 考评业务状态管理 (Zustand)
// ═══════════════════════════════════════════════════

import { create } from 'zustand';
import type { ExamPlan, ExamNode, DashboardStats } from '@/shared';

interface ExamState {
  // 数据
  plans: ExamPlan[];
  currentPlan: ExamPlan | null;
  nodes: ExamNode[];
  dashboardStats: DashboardStats | null;

  // UI状态
  isLoading: boolean;
  error: string | null;
  selectedPlanId: string | null;

  // 操作
  setPlans: (plans: ExamPlan[]) => void;
  setCurrentPlan: (plan: ExamPlan | null) => void;
  setNodes: (nodes: ExamNode[]) => void;
  setDashboardStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedPlanId: (id: string | null) => void;

  // 派生数据
  getOverdueNodes: () => ExamNode[];
  getPendingNodes: () => ExamNode[];
  getNodesByPlan: (planId: string) => ExamNode[];
  getPlanProgress: (planId: string) => number;
}

export const useExamStore = create<ExamState>((set, get) => ({
  plans: [],
  currentPlan: null,
  nodes: [],
  dashboardStats: null,
  isLoading: false,
  error: null,
  selectedPlanId: null,

  setPlans: (plans) => set({ plans }),
  setCurrentPlan: (plan) => set({ currentPlan: plan }),
  setNodes: (nodes) => set({ nodes }),
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setSelectedPlanId: (id) => set({ selectedPlanId: id }),

  getOverdueNodes: () => {
    return get().nodes.filter((n) => n.status === 'OVERDUE');
  },

  getPendingNodes: () => {
    return get().nodes.filter((n) => n.status === 'PENDING' || n.status === 'IN_PROGRESS');
  },

  getNodesByPlan: (planId) => {
    return get().nodes.filter((n) => n.planId === planId);
  },

  getPlanProgress: (planId) => {
    const planNodes = get().nodes.filter((n) => n.planId === planId);
    if (planNodes.length === 0) return 0;
    const completed = planNodes.filter((n) => n.status === 'COMPLETED').length;
    return Math.round((completed / planNodes.length) * 100);
  },
}));
