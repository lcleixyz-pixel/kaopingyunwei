import { Settings as SettingsIcon, Shield, Bell, Database, Loader2, CalendarDays } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import type { WorkdayCalendar } from '@/shared';
import { useAuthStore } from '@/stores/authStore';

type TabId = 'general' | 'security' | 'notifications' | 'workdays' | 'backup';

interface SettingsForm {
  systemName: string;
  organizationName: string;
  dataRetentionYears: string;
  autoBackupTime: string;
  backupRetentionDays: string;
  autoBackupEnabled: string;
  reminderEnabled: string;
  emailEnabled: string;
}

const tabs = [
  { id: 'general' as TabId, label: '通用设置', icon: SettingsIcon },
  { id: 'security' as TabId, label: '安全设置', icon: Shield },
  { id: 'notifications' as TabId, label: '提醒设置', icon: Bell },
  { id: 'workdays' as TabId, label: '工作日历', icon: CalendarDays },
  { id: 'backup' as TabId, label: '备份设置', icon: Database },
];

const defaultSettings: SettingsForm = {
  systemName: '考评分支机构管理系统',
  organizationName: 'XX职业技能鉴定中心',
  dataRetentionYears: '8',
  autoBackupTime: '02:00',
  backupRetentionDays: '30',
  autoBackupEnabled: 'true',
  reminderEnabled: 'true',
  emailEnabled: 'false',
};

export default function Settings() {
  const { get, patch } = useApi();
  const { user } = useAuthStore();
  const isBranchAdmin = user?.role === 'BRANCH_ADMIN';
  const visibleTabs = isBranchAdmin ? tabs.filter((tab) => tab.id === 'workdays') : tabs;
  const [activeTab, setActiveTab] = useState<TabId>(isBranchAdmin ? 'workdays' : 'general');
  const [settings, setSettings] = useState<SettingsForm>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [calendar, setCalendar] = useState<WorkdayCalendar | null>(null);
  const [holidaysText, setHolidaysText] = useState('');
  const [workdaysText, setWorkdaysText] = useState('');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await get<SettingsForm>('/settings');
        setSettings({ ...defaultSettings, ...data });
        const calendars = await get<WorkdayCalendar[]>('/settings/workday-calendars');
        const currentCalendar = calendars[0] || null;
        setCalendar(currentCalendar);
        setHolidaysText((currentCalendar?.holidays || []).join('\n'));
        setWorkdaysText((currentCalendar?.workdays || []).join('\n'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [get]);

  const update = (key: keyof SettingsForm, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const data = await patch<SettingsForm>('/settings', settings);
      setSettings({ ...defaultSettings, ...data });
      setMessage('设置已保存');
    } catch (err: any) {
      setMessage(err?.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const saveCalendar = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const payload = {
        tenantId: calendar?.tenantId,
        holidays: parseDateLines(holidaysText),
        workdays: parseDateLines(workdaysText),
      };
      const data = await patch<WorkdayCalendar>('/settings/workday-calendars', payload);
      setCalendar(data);
      setHolidaysText(data.holidays.join('\n'));
      setWorkdaysText(data.workdays.join('\n'));
      setMessage('工作日历已保存');
    } catch (err: any) {
      setMessage(err?.message || '保存工作日历失败');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          系统设置
        </h1>
        <p className="text-slate-500 mt-1">配置系统参数、安全和备份策略</p>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
          {message}
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-56 space-y-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              加载设置中...
            </div>
          ) : (
            <>
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900">通用设置</h3>
                  <div className="space-y-4 max-w-lg">
                    <Field label="系统名称">
                      <input className={inputClass} value={settings.systemName} onChange={(e) => update('systemName', e.target.value)} />
                    </Field>
                    <Field label="机构名称">
                      <input className={inputClass} value={settings.organizationName} onChange={(e) => update('organizationName', e.target.value)} />
                    </Field>
                    <Field label="数据保留年限">
                      <select className={inputClass} value={settings.dataRetentionYears} onChange={(e) => update('dataRetentionYears', e.target.value)}>
                        <option value="5">5年</option>
                        <option value="8">8年</option>
                        <option value="10">10年</option>
                      </select>
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <Panel title="安全设置">
                  <InfoRow title="登录失败锁定" description="连续5次失败锁定30分钟" enabled />
                  <InfoRow title="会话超时" description="JWT 默认7天有效，后续可扩展为无操作超时" enabled />
                </Panel>
              )}

              {activeTab === 'notifications' && (
                <Panel title="提醒设置">
                  <ToggleRow title="系统内消息提醒" description="在系统内显示节点提醒" value={settings.reminderEnabled} onChange={(value) => update('reminderEnabled', value)} />
                  <ToggleRow title="邮件提醒" description="通过邮件发送节点提醒" value={settings.emailEnabled} onChange={(value) => update('emailEnabled', value)} />
                </Panel>
              )}

              {activeTab === 'workdays' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900">工作日历</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-3xl">
                    <Field label="节假日">
                      <textarea
                        className={inputClass + ' min-h-52 resize-none font-mono text-sm'}
                        value={holidaysText}
                        onChange={(e) => setHolidaysText(e.target.value)}
                        placeholder="2026-05-08"
                      />
                    </Field>
                    <Field label="调休工作日">
                      <textarea
                        className={inputClass + ' min-h-52 resize-none font-mono text-sm'}
                        value={workdaysText}
                        onChange={(e) => setWorkdaysText(e.target.value)}
                        placeholder="2026-05-09"
                      />
                    </Field>
                  </div>
                  <p className="text-sm text-slate-500">每行一个日期，格式为 YYYY-MM-DD。该日历会用于本分支新建或编辑草稿计划时计算 9 个节点截止日期。</p>
                </div>
              )}

              {activeTab === 'backup' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900">备份设置</h3>
                  <div className="space-y-4 max-w-lg">
                    <Field label="自动备份时间">
                      <input type="time" className={inputClass} value={settings.autoBackupTime} onChange={(e) => update('autoBackupTime', e.target.value)} />
                    </Field>
                    <Field label="备份保留天数">
                      <select className={inputClass} value={settings.backupRetentionDays} onChange={(e) => update('backupRetentionDays', e.target.value)}>
                        <option value="7">7天</option>
                        <option value="30">30天</option>
                        <option value="90">90天</option>
                      </select>
                    </Field>
                    <ToggleRow title="启用自动备份" description="每天凌晨自动备份数据" value={settings.autoBackupEnabled} onChange={(value) => update('autoBackupEnabled', value)} />
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-slate-100">
                <button
                  onClick={activeTab === 'workdays' ? saveCalendar : save}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? '保存中...' : activeTab === 'workdays' ? '保存工作日历' : '保存设置'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function parseDateLines(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
  ));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="space-y-4 max-w-lg">{children}</div>
    </div>
  );
}

function InfoRow({ title, description, enabled }: { title: string; description: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100">
      <div>
        <p className="font-medium text-slate-800">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full ${enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
        {enabled ? '启用' : '停用'}
      </span>
    </div>
  );
}

function ToggleRow({ title, description, value, onChange }: { title: string; description: string; value: string; onChange: (value: string) => void }) {
  const checked = value === 'true';

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100">
      <div>
        <p className="font-medium text-slate-800">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(String(e.target.checked))} className="sr-only peer" />
        <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
      </label>
    </div>
  );
}
