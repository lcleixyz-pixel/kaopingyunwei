import { Bell, CalendarDays, CheckCircle2, Database, Download, FileText, Loader2, Printer, RotateCcw, Settings as SettingsIcon, UserCog } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { apiClient, useApi } from '@/hooks/useApi';
import type { CertificatePrintTemplateDefinition, PdfTemplate, PdfTemplateDefinition, PdfTemplateKey, StandardPdfTemplateDefinition, Table5PdfTemplateDefinition, WorkdayCalendar } from '@/shared';
import { useAuthStore } from '@/stores/authStore';
import { UserManagementPanel } from '@/components/settings/UserManagementPanel';

type TabId = 'accounts' | 'notifications' | 'workdays' | 'backup' | 'pdfTemplates';

interface SettingsForm {
  autoBackupTime: string;
  backupRetentionDays: string;
  autoBackupEnabled: string;
  reminderEnabled: string;
  reminderIntensity: string;
}

const tabs = [
  { id: 'accounts' as TabId, label: '账号管理', icon: UserCog },
  { id: 'notifications' as TabId, label: '提醒设置', icon: Bell },
  { id: 'workdays' as TabId, label: '工作日历', icon: CalendarDays },
  { id: 'backup' as TabId, label: '备份设置', icon: Database },
  { id: 'pdfTemplates' as TabId, label: '打印模板', icon: Printer },
];

const defaultSettings: SettingsForm = {
  autoBackupTime: '02:00',
  backupRetentionDays: '30',
  autoBackupEnabled: 'true',
  reminderEnabled: 'true',
  reminderIntensity: 'ENHANCED',
};

const inputClass = 'w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none';

export default function Settings() {
  const { get, post, patch, put } = useApi();
  const { user } = useAuthStore();
  const isBranchAdmin = user?.role === 'BRANCH_ADMIN';
  const canManageAccounts = user?.role === 'SYS_ADMIN' || user?.role === 'HQ_ADMIN';
  const canManagePdfTemplates = user?.role === 'SYS_ADMIN' || user?.role === 'HQ_ADMIN';
  const visibleTabs = isBranchAdmin
    ? tabs.filter((tab) => tab.id === 'workdays')
    : tabs.filter((tab) => {
      if (tab.id === 'accounts') return canManageAccounts;
      if (tab.id === 'pdfTemplates') return canManagePdfTemplates;
      return true;
    });
  const [activeTab, setActiveTab] = useState<TabId>(isBranchAdmin ? 'workdays' : canManageAccounts ? 'accounts' : 'workdays');
  const [settings, setSettings] = useState<SettingsForm>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [calendar, setCalendar] = useState<WorkdayCalendar | null>(null);
  const [holidaysText, setHolidaysText] = useState('');
  const [workdaysText, setWorkdaysText] = useState('');
  const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<PdfTemplateKey | ''>('');
  const [templateDraft, setTemplateDraft] = useState<PdfTemplate | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [settingsData, calendars, templates] = await Promise.all([
          isBranchAdmin ? Promise.resolve(defaultSettings) : get<SettingsForm>('/settings'),
          get<WorkdayCalendar[]>('/settings/workday-calendars'),
          canManagePdfTemplates ? get<PdfTemplate[]>('/pdf-templates') : Promise.resolve([]),
        ]);
        if (!isBranchAdmin) setSettings({ ...defaultSettings, ...settingsData });
        const currentCalendar = calendars[0] || null;
        setCalendar(currentCalendar);
        setHolidaysText((currentCalendar?.holidays || []).join('\n'));
        setWorkdaysText((currentCalendar?.workdays || []).join('\n'));
        setPdfTemplates(templates);
        const selectedTemplate = templates[0] || null;
        setSelectedTemplateKey(selectedTemplate?.key || '');
        setTemplateDraft(selectedTemplate ? cloneTemplate(selectedTemplate) : null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [canManagePdfTemplates, get, isBranchAdmin]);

  const update = (key: keyof SettingsForm, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const applyRecommendedBackupSettings = () => {
    setSettings((current) => ({
      ...current,
      autoBackupEnabled: 'true',
      autoBackupTime: '02:00',
      backupRetentionDays: '30',
    }));
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

  const selectPdfTemplate = (key: PdfTemplateKey) => {
    const template = pdfTemplates.find((item) => item.key === key) || null;
    setSelectedTemplateKey(key);
    setTemplateDraft(template ? cloneTemplate(template) : null);
  };

  const updateTemplateDraft = (updater: (template: PdfTemplate) => PdfTemplate) => {
    setTemplateDraft((current) => current ? updater(current) : current);
  };

  const savePdfTemplate = async () => {
    if (!templateDraft) return;
    setIsSaving(true);
    setMessage('');
    try {
      const saved = await put<PdfTemplate>(`/pdf-templates/${templateDraft.key}`, {
        name: templateDraft.name,
        definition: templateDraft.definition,
      });
      setPdfTemplates((current) => replaceTemplate(current, saved));
      setTemplateDraft(cloneTemplate(saved));
      setSelectedTemplateKey(saved.key);
      setMessage('PDF 打印模板已保存');
    } catch (err: any) {
      setMessage(err?.message || '保存 PDF 打印模板失败');
    } finally {
      setIsSaving(false);
    }
  };

  const resetPdfTemplate = async () => {
    if (!templateDraft) return;
    setIsSaving(true);
    setMessage('');
    try {
      const saved = await post<PdfTemplate>(`/pdf-templates/${templateDraft.key}/reset`, {});
      setPdfTemplates((current) => replaceTemplate(current, saved));
      setTemplateDraft(cloneTemplate(saved));
      setSelectedTemplateKey(saved.key);
      setMessage('PDF 打印模板已恢复默认');
    } catch (err: any) {
      setMessage(err?.message || '重置 PDF 打印模板失败');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadPdfTemplatePreview = async () => {
    if (!templateDraft) return;
    try {
      const response = await apiClient.get(`/pdf-templates/${templateDraft.key}/preview.pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${templateDraft.name}-预览.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err?.message || '下载 PDF 模板预览失败');
    }
  };

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
              {activeTab === 'accounts' && <UserManagementPanel />}

              {activeTab === 'notifications' && (
                <Panel title="提醒设置">
                  <ToggleRow title="系统内消息提醒" description="关闭后不再生成新的节点到期/逾期提醒" value={settings.reminderEnabled} onChange={(value) => update('reminderEnabled', value)} />
                  <Field label="提醒强度">
                    <select className={inputClass} value={settings.reminderIntensity} onChange={(e) => update('reminderIntensity', e.target.value)}>
                      <option value="ENHANCED">加强：提前最多3天，12小时内不重复</option>
                      <option value="STANDARD">标准：提前最多2天，24小时内不重复</option>
                    </select>
                  </Field>
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
                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      <div className="flex items-start justify-between gap-3">
                        <p>推荐：每日 02:00 自动备份，保留 30 天。当前总部 + 分支规模下，这个策略足够稳妥，也不会堆积太多本地备份。</p>
                        <button
                          type="button"
                          onClick={applyRecommendedBackupSettings}
                          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          应用
                        </button>
                      </div>
                    </div>
                    <ToggleRow title="启用自动备份" description="按下方时间每天自动备份数据" value={settings.autoBackupEnabled} onChange={(value) => update('autoBackupEnabled', value)} />
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
                  </div>
                </div>
              )}

              {activeTab === 'pdfTemplates' && (
                <PdfTemplatePanel
                  templates={pdfTemplates}
                  selectedTemplateKey={selectedTemplateKey}
                  draft={templateDraft}
                  isSaving={isSaving}
                  onSelect={selectPdfTemplate}
                  onDraftChange={updateTemplateDraft}
                  onSave={savePdfTemplate}
                  onReset={resetPdfTemplate}
                  onPreview={downloadPdfTemplatePreview}
                />
              )}

              {activeTab !== 'accounts' && activeTab !== 'pdfTemplates' && (
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
              )}
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

function PdfTemplatePanel({
  templates,
  selectedTemplateKey,
  draft,
  isSaving,
  onSelect,
  onDraftChange,
  onSave,
  onReset,
  onPreview,
}: {
  templates: PdfTemplate[];
  selectedTemplateKey: PdfTemplateKey | '';
  draft: PdfTemplate | null;
  isSaving: boolean;
  onSelect: (key: PdfTemplateKey) => void;
  onDraftChange: (updater: (template: PdfTemplate) => PdfTemplate) => void;
  onSave: () => void;
  onReset: () => void;
  onPreview: () => void;
}) {
  const updateDefinition = (definition: PdfTemplateDefinition) => {
    onDraftChange((template) => ({ ...template, definition }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-slate-900">打印模板</h3>
        <p className="text-sm text-slate-500 mt-1">总部统一维护 PDF 表单模板，分支仍在原业务页面下载打印。</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-5">
        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => onSelect(template.key)}
              className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                selectedTemplateKey === template.key ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4" />
                {template.name}
              </div>
              <div className="mt-1 text-xs text-slate-500">{template.isDefault ? '系统默认模板' : `自定义 v${template.version}`}</div>
            </button>
          ))}
          {templates.length === 0 && <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">暂无可维护模板</div>}
        </div>

        <div className="min-w-0 rounded-lg border border-slate-200 p-5">
          {!draft ? (
            <div className="py-16 text-center text-slate-500">请选择一个 PDF 模板</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                <Field label="模板名称">
                  <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(event) => onDraftChange((template) => ({ ...template, name: event.target.value }))}
                  />
                </Field>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={onPreview} className="px-3 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    预览
                  </button>
                  <button type="button" onClick={onReset} disabled={isSaving} className="px-3 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-400 inline-flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    重置
                  </button>
                  <button type="button" onClick={onSave} disabled={isSaving} className="px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 inline-flex items-center gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    保存
                  </button>
                </div>
              </div>
              <PdfTemplateDefinitionEditor definition={draft.definition} onChange={updateDefinition} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PdfTemplateDefinitionEditor({ definition, onChange }: { definition: PdfTemplateDefinition; onChange: (definition: PdfTemplateDefinition) => void }) {
  if (definition.kind === 'standard') {
    return <StandardPdfTemplateEditor definition={definition} onChange={onChange} />;
  }
  if (definition.kind === 'certificate-print') {
    return <CertificatePrintTemplateEditor definition={definition} onChange={onChange} />;
  }
  return <Table5TemplateEditor definition={definition} onChange={onChange} />;
}

function StandardPdfTemplateEditor({ definition, onChange }: { definition: StandardPdfTemplateDefinition; onChange: (definition: StandardPdfTemplateDefinition) => void }) {
  const updateTypography = (field: keyof StandardPdfTemplateDefinition['typography'], value: number) => {
    onChange({ ...definition, typography: { ...definition.typography, [field]: value } });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="标题">
          <input className={inputClass} value={definition.title} onChange={(event) => onChange({ ...definition, title: event.target.value })} />
        </Field>
        <Field label="说明文字">
          <input className={inputClass} value={definition.description || ''} onChange={(event) => onChange({ ...definition, description: event.target.value })} />
        </Field>
        <NumberInput label="页边距" value={definition.page.margin} onChange={(value) => onChange({ ...definition, page: { ...definition.page, margin: value } })} />
        <NumberInput label="标题字号" value={definition.typography.titleSize} onChange={(value) => updateTypography('titleSize', value)} />
        <NumberInput label="正文字号" value={definition.typography.rowSize} onChange={(value) => updateTypography('rowSize', value)} />
        <NumberInput label="表格字号" value={definition.typography.tableBodySize} onChange={(value) => updateTypography('tableBodySize', value)} />
      </div>

      <TemplateSection title="字段标签">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {definition.rows.map((row, index) => (
            <Field key={`${row.source}-${index}`} label={row.source}>
              <input
                className={inputClass}
                value={row.label}
                onChange={(event) => onChange({ ...definition, rows: definition.rows.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })}
              />
            </Field>
          ))}
        </div>
      </TemplateSection>

      {definition.table && (
        <TemplateSection title="表格列">
          <div className="space-y-3">
            {definition.table.columns.map((column, index) => (
              <div key={`${column.source}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
                <Field label={column.source}>
                  <input
                    className={inputClass}
                    value={column.label}
                    onChange={(event) => onChange({
                      ...definition,
                      table: {
                        ...definition.table!,
                        columns: definition.table!.columns.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item),
                      },
                    })}
                  />
                </Field>
                <NumberInput
                  label="列宽"
                  value={column.width || 95}
                  onChange={(value) => onChange({
                    ...definition,
                    table: {
                      ...definition.table!,
                      columns: definition.table!.columns.map((item, itemIndex) => itemIndex === index ? { ...item, width: value } : item),
                    },
                  })}
                />
              </div>
            ))}
          </div>
        </TemplateSection>
      )}

      <TemplateSection title="签字区">
        <textarea
          className={`${inputClass} min-h-28 resize-y`}
          value={definition.signatures.join('\n')}
          onChange={(event) => onChange({ ...definition, signatures: event.target.value.split('\n') })}
        />
      </TemplateSection>
    </div>
  );
}

function CertificatePrintTemplateEditor({ definition, onChange }: { definition: CertificatePrintTemplateDefinition; onChange: (definition: CertificatePrintTemplateDefinition) => void }) {
  const updateField = (index: number, patch: Partial<CertificatePrintTemplateDefinition['fields'][number]>) => {
    onChange({
      ...definition,
      fields: definition.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field),
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="标题">
          <input className={inputClass} value={definition.title} onChange={(event) => onChange({ ...definition, title: event.target.value })} />
        </Field>
        <Field label="说明文字">
          <input className={inputClass} value={definition.description || ''} onChange={(event) => onChange({ ...definition, description: event.target.value })} />
        </Field>
      </div>
      <TemplateSection title="套打字段坐标（毫米）">
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {['字段', '类型', '来源', 'X', 'Y', '宽', '高', '字号', '对齐'].map((header) => <th key={header} className="px-3 py-2 text-left font-medium">{header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {definition.fields.map((field, index) => (
                <tr key={field.id}>
                  <td className="px-3 py-2"><input className={inputClass} value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} /></td>
                  <td className="px-3 py-2">
                    <select className={inputClass} value={field.type || 'text'} onChange={(event) => updateField(index, { type: event.target.value as 'text' | 'image' })}>
                      <option value="text">文字</option>
                      <option value="image">图片</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{field.source}</td>
                  <td className="px-3 py-2"><SmallNumber value={field.xMm} onChange={(value) => updateField(index, { xMm: value })} /></td>
                  <td className="px-3 py-2"><SmallNumber value={field.yMm} onChange={(value) => updateField(index, { yMm: value })} /></td>
                  <td className="px-3 py-2"><SmallNumber value={field.widthMm} onChange={(value) => updateField(index, { widthMm: value })} /></td>
                  <td className="px-3 py-2"><SmallNumber value={field.heightMm} onChange={(value) => updateField(index, { heightMm: value })} /></td>
                  <td className="px-3 py-2"><SmallNumber value={field.fontSize} onChange={(value) => updateField(index, { fontSize: value })} /></td>
                  <td className="px-3 py-2">
                    <select className={inputClass} value={field.align} onChange={(event) => updateField(index, { align: event.target.value as 'left' | 'center' | 'right' })}>
                      <option value="left">左</option>
                      <option value="center">中</option>
                      <option value="right">右</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TemplateSection>
    </div>
  );
}

function Table5TemplateEditor({ definition, onChange }: { definition: Table5PdfTemplateDefinition; onChange: (definition: Table5PdfTemplateDefinition) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="标题">
          <input className={inputClass} value={definition.title} onChange={(event) => onChange({ ...definition, title: event.target.value })} />
        </Field>
        <Field label="表号">
          <input className={inputClass} value={definition.codeLabel || ''} onChange={(event) => onChange({ ...definition, codeLabel: event.target.value })} />
        </Field>
        <NumberInput label="页边距" value={definition.page.margin} onChange={(value) => onChange({ ...definition, page: { ...definition.page, margin: value } })} />
        <NumberInput label="标题字号" value={definition.typography.titleSize} onChange={(value) => onChange({ ...definition, typography: { ...definition.typography, titleSize: value } })} />
      </div>
      <TemplateSection title="表格标签">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(definition.labels).map(([key, value]) => (
            <Field key={key} label={key}>
              <input
                className={inputClass}
                value={value}
                onChange={(event) => onChange({ ...definition, labels: { ...definition.labels, [key]: event.target.value } })}
              />
            </Field>
          ))}
        </div>
      </TemplateSection>
      <TemplateSection title="签字文字">
        <div className="grid grid-cols-1 gap-3">
          <Field label="信息管理员意见">
            <input className={inputClass} value={definition.signatures.informationManagerOpinion} onChange={(event) => onChange({ ...definition, signatures: { ...definition.signatures, informationManagerOpinion: event.target.value } })} />
          </Field>
          <Field label="单位意见">
            <input className={inputClass} value={definition.signatures.unitOpinion} onChange={(event) => onChange({ ...definition, signatures: { ...definition.signatures, unitOpinion: event.target.value } })} />
          </Field>
        </div>
      </TemplateSection>
    </div>
  );
}

function TemplateSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {children}
    </section>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" className={inputClass} value={value} onChange={(event) => onChange(parseNumericInput(event.target.value))} />
    </Field>
  );
}

function SmallNumber({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input type="number" step="0.1" className="w-24 rounded-md border border-slate-300 px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500" value={value} onChange={(event) => onChange(parseNumericInput(event.target.value))} />
  );
}

function cloneTemplate(template: PdfTemplate): PdfTemplate {
  return JSON.parse(JSON.stringify(template)) as PdfTemplate;
}

function replaceTemplate(templates: PdfTemplate[], next: PdfTemplate): PdfTemplate[] {
  return templates.map((template) => template.key === next.key ? next : template);
}

function parseNumericInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
