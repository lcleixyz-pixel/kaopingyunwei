// ═══════════════════════════════════════════════════
// 统一API请求Hook
// ═══════════════════════════════════════════════════

import { useCallback } from 'react';
import axios from 'axios';
import type { ApiResponse } from '@/shared';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动添加token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('exam_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一错误处理
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function useApi() {
  const get = useCallback(async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
    const response = await apiClient.get<ApiResponse<T>>(url, { params });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '请求失败');
    }
    return response.data.data as T;
  }, []);

  const post = useCallback(async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await apiClient.post<ApiResponse<T>>(url, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '请求失败');
    }
    return response.data.data as T;
  }, []);

  const patch = useCallback(async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await apiClient.patch<ApiResponse<T>>(url, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '请求失败');
    }
    return response.data.data as T;
  }, []);

  const put = useCallback(async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await apiClient.put<ApiResponse<T>>(url, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '请求失败');
    }
    return response.data.data as T;
  }, []);

  const del = useCallback(async <T>(url: string): Promise<T> => {
    const response = await apiClient.delete<ApiResponse<T>>(url);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '请求失败');
    }
    return response.data.data as T;
  }, []);

  return { get, post, patch, put, del };
}

export { apiClient };
