import { KeyRound, Loader2, Pencil, Plus, Search } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { ROLE_LABELS } from '@/lib/constants';
import type { CreateUserInput, Tenant, UpdateUserInput, User, UserManagementOptions, UserRole, UserStatus } from '@/shared';

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: '启用',
  INACTIVE: '停用',
  LOCKED: '锁定',
};

const initialForm: AccountForm = {
  tenantId: '',
  username: '',
  realName: '',
  role: 'BRANCH_STAFF',
  phone: '',
  email: '',
  password: '',
  status: 'ACTIVE',
};

interface AccountForm {
  tenantId: string;
  username: string;
  realName: string;
  role: UserRole;
  phone: string;
  email: string;
  password: string;
  status: UserStatus;
}

interface Filters {
  keyword: string;
  tenantId: string;
  role: string;
  status: string;
}

const initialFilters: Filters = { keyword: '', tenantId: '', role: '', status: '' };

export function UserManagementPanel() {
  const { get, post, patch } = useApi();
  const [users, setUsers] = useState<User[]>([]);
  const [options, setOptions] = useState<UserManagementOptions>({ tenants: [], roles: [] });
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [form, setForm] = useState<AccountForm>(initialForm);
  const [resetPassword, setResetPassword] = useState('');

  const loadUsers = useCallback(async (nextFilters: Filters) => {
    const params = Object.fromEntries(
      Object.entries(nextFilters).filter(([, value]) => value.trim() !== '')
    );
    const data = await get<User[]>('/users', params);
    setUsers(data);
  }, [get]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const data = await get<UserManagementOptions>('/users/options');
        if (cancelled) return;
        setOptions(data);
        const defaultRole = data.roles.includes('BRANCH_STAFF') ? 'BRANCH_STAFF' : data.roles[0] || 'HQ_STAFF';
        const defaultTenant = findFirstCompatibleTenant(data.tenants, defaultRole);
        setForm((current) => ({
          ...current,
          role: defaultRole,
          tenantId: defaultTenant?.id || '',
        }));
        await loadUsers(initialFilters);
      } catch (err: any) {
        if (!cancelled) setMessage(err?.message || '加载账号失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [get, loadUsers]);

  const compatibleTenants = useMemo(
    () => options.tenants.filter((tenant) => isTenantCompatibleWithRole(tenant, form.role)),
    [form.role, options.tenants]
  );

  const setFilter = (key: keyof Filters, value: string) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setIsLoading(true);
    loadUsers(nextFilters)
      .catch((err: any) => setMessage(err?.message || '筛选账号失败'))
      .finally(() => setIsLoading(false));
  };

  const openCreate = () => {
    const role = options.roles.includes('BRANCH_STAFF') ? 'BRANCH_STAFF' : options.roles[0] || 'HQ_STAFF';
    const tenant = findFirstCompatibleTenant(options.tenants, role);
    setEditingUser(null);
    setIsFormOpen(true);
    setForm({ ...initialForm, role, tenantId: tenant?.id || '' });
    setMessage('');
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setIsFormOpen(true);
    setForm({
      tenantId: user.tenantId || '',
      username: user.username,
      realName: user.realName,
      role: user.role,
      phone: user.phone || '',
      email: user.email || '',
      password: '',
      status: user.status,
    });
    setMessage('');
  };

  const closeForm = () => {
    setEditingUser(null);
    setIsFormOpen(false);
    setForm(initialForm);
  };

  const updateForm = (key: keyof AccountForm, value: string) => {
    if (key === 'role') {
      const role = value as UserRole;
      const tenant = findFirstCompatibleTenant(options.tenants, role);
      setForm((current) => ({
        ...current,
        role,
        tenantId: tenant?.id || '',
      }));
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveForm = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      if (editingUser) {
        const payload: UpdateUserInput = {
          realName: form.realName,
          role: form.role,
          phone: form.phone || null,
          email: form.email || null,
          status: form.status,
        };
        await patch<User>(`/users/${editingUser.id}`, payload);
        setMessage('账号已保存');
      } else {
        const payload: CreateUserInput = {
          tenantId: form.tenantId,
          username: form.username,
          realName: form.realName,
          role: form.role,
          phone: form.phone || null,
          email: form.email || null,
          password: form.password,
          status: form.status,
        };
        await post<User>('/users', payload);
        setMessage('账号已创建');
      }
      await loadUsers(filters);
      closeForm();
    } catch (err: any) {
      setMessage(err?.message || '保存账号失败');
    } finally {
      setIsSaving(false);
    }
  };

  const openResetPassword = (user: User) => {
    setResetUser(user);
    setResetPassword('');
    setMessage('');
  };

  const submitResetPassword = async () => {
    if (!resetUser) return;
    setIsSaving(true);
    setMessage('');
    try {
      await post<User>(`/users/${resetUser.id}/reset-password`, { password: resetPassword });
      setMessage('密码已重置');
      setResetUser(null);
      setResetPassword('');
      await loadUsers(filters);
    } catch (err: any) {
      setMessage(err?.message || '重置密码失败');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (user: User) => {
    const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setIsSaving(true);
    setMessage('');
    try {
      await patch<User>(`/users/${user.id}`, { status: nextStatus });
      setMessage(nextStatus === 'ACTIVE' ? '账号已启用' : '账号已停用');
      await loadUsers(filters);
    } catch (err: any) {
      setMessage(err?.message || '状态更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">账号管理</h3>
          <p className="text-sm text-slate-500">总部统一维护账号，不删除历史账号，离职或停用通过状态控制。</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          新建账号
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.keyword}
            onChange={(event) => setFilter('keyword', event.target.value)}
            placeholder="搜索姓名、用户名、电话"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <select className={selectClass} value={filters.tenantId} onChange={(event) => setFilter('tenantId', event.target.value)}>
          <option value="">全部机构</option>
          {options.tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
          ))}
        </select>
        <select className={selectClass} value={filters.role} onChange={(event) => setFilter('role', event.target.value)}>
          <option value="">全部角色</option>
          {options.roles.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
          ))}
        </select>
        <select className={selectClass} value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <option key={status} value={status}>{label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">账号</th>
              <th className="px-4 py-3">机构</th>
              <th className="px-4 py-3">角色</th>
              <th className="px-4 py-3">联系方式</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">最近登录</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  加载账号中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">暂无账号</td>
              </tr>
            ) : users.map((user) => (
              <tr key={user.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{user.realName}</div>
                  <div className="text-xs text-slate-500">{user.username}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{user.tenant?.name || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[user.role] || user.role}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div>{user.phone || '-'}</div>
                  <div className="text-xs text-slate-400">{user.email || ''}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(user.status)}`}>
                    {STATUS_LABELS[user.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(user.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" className={iconButtonClass} onClick={() => openEdit(user)} title="编辑账号">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className={iconButtonClass} onClick={() => openResetPassword(user)} title="重置密码">
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button type="button" className={textButtonClass} onClick={() => toggleStatus(user)} disabled={isSaving}>
                      {user.status === 'ACTIVE' ? '停用' : '启用'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <AccountDialog
          form={form}
          roles={options.roles}
          tenants={compatibleTenants}
          isEditing={Boolean(editingUser)}
          isSaving={isSaving}
          onChange={updateForm}
          onCancel={closeForm}
          onSave={saveForm}
        />
      )}

      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          password={resetPassword}
          isSaving={isSaving}
          onChange={setResetPassword}
          onCancel={() => setResetUser(null)}
          onSubmit={submitResetPassword}
        />
      )}
    </div>
  );
}

function AccountDialog({
  form,
  roles,
  tenants,
  isEditing,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: {
  form: AccountForm;
  roles: UserRole[];
  tenants: Pick<Tenant, 'id' | 'code' | 'name' | 'type' | 'status'>[];
  isEditing: boolean;
  isSaving: boolean;
  onChange: (key: keyof AccountForm, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
        <h4 className="text-lg font-bold text-slate-900">{isEditing ? '编辑账号' : '新建账号'}</h4>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="所属机构">
            <select className={selectClass} value={form.tenantId} onChange={(event) => onChange('tenantId', event.target.value)} disabled={isEditing}>
              <option value="">请选择机构</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </Field>
          <Field label="角色">
            <select className={selectClass} value={form.role} onChange={(event) => onChange('role', event.target.value)}>
              {roles.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
              ))}
            </select>
          </Field>
          <Field label="用户名">
            <input className={inputClass} value={form.username} onChange={(event) => onChange('username', event.target.value)} disabled={isEditing} />
          </Field>
          <Field label="姓名">
            <input className={inputClass} value={form.realName} onChange={(event) => onChange('realName', event.target.value)} />
          </Field>
          {!isEditing && (
            <Field label="临时密码">
              <input type="password" className={inputClass} value={form.password} onChange={(event) => onChange('password', event.target.value)} />
            </Field>
          )}
          <Field label="状态">
            <select className={selectClass} value={form.status} onChange={(event) => onChange('status', event.target.value)}>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="手机号">
            <input className={inputClass} value={form.phone} onChange={(event) => onChange('phone', event.target.value)} />
          </Field>
          <Field label="邮箱">
            <input className={inputClass} value={form.email} onChange={(event) => onChange('email', event.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={secondaryButtonClass} onClick={onCancel}>取消</button>
          <button type="button" className={primaryButtonClass} onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordDialog({
  user,
  password,
  isSaving,
  onChange,
  onCancel,
  onSubmit,
}: {
  user: User;
  password: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h4 className="text-lg font-bold text-slate-900">重置密码</h4>
        <p className="mt-1 text-sm text-slate-500">为 {user.realName} 设置临时密码，并线下告知本人。</p>
        <div className="mt-5">
          <Field label="新临时密码">
            <input type="password" className={inputClass} value={password} onChange={(event) => onChange(event.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={secondaryButtonClass} onClick={onCancel}>取消</button>
          <button type="button" className={primaryButtonClass} onClick={onSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            确认重置
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function findFirstCompatibleTenant<T extends Pick<Tenant, 'type'>>(tenants: T[], role: UserRole): T | undefined {
  return tenants.find((tenant) => isTenantCompatibleWithRole(tenant, role));
}

function isTenantCompatibleWithRole(tenant: Pick<Tenant, 'type'>, role: UserRole): boolean {
  if (role === 'BRANCH_ADMIN' || role === 'BRANCH_STAFF') return tenant.type === 'BRANCH';
  return tenant.type === 'HQ';
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: UserStatus): string {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'LOCKED') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500';
const selectClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500';
const iconButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900';
const textButtonClass = 'inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50';
const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400';
const secondaryButtonClass = 'inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50';
