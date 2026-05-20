import { useState, useEffect, useCallback } from 'react';
import { Bot, Heart, HardDrive, Database, Clock, ArrowUpCircle, Download, Upload, Shield, Zap, Loader2, RefreshCw } from 'lucide-react';
import { PageAlert } from '@/components/common/PageAlert';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useApi } from '@/hooks/useApi';
import { getFriendlyErrorMessage } from '@/lib/apiError';
import type { ExportPackageInfo, HealthStatus } from '@/shared';

interface BackupInfo {
  id: string;
  fileName: string;
  size: number;
  createdAt: string;
}

interface LogEntry {
  id: string;
  action: string;
  target: string;
  user?: { realName: string; username: string };
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}天${hours}小时`;
}

export default function AiOps() {
  const { get, post } = useApi();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [exportInfo, setExportInfo] = useState<ExportPackageInfo | null>(null);

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const fetchHealth = useCallback(async () => {
    try {
      const data = await get<HealthStatus>('/ai-ops/health');
      setHealthData(data);
    } catch (err) {
      showMessage(getFriendlyErrorMessage(err, '获取系统状态失败'), 'error');
    } finally {
      setIsLoadingHealth(false);
    }
  }, [get]);

  const fetchBackups = useCallback(async () => {
    try {
      const data = await get<BackupInfo[]>('/ai-ops/backups');
      setBackups(data);
    } catch (err) {
      showMessage(getFriendlyErrorMessage(err, '获取备份记录失败'), 'error');
    }
  }, [get]);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await get<LogEntry[]>('/ai-ops/logs', { lines: '20' });
      setLogs(data);
    } catch (err) {
      showMessage(getFriendlyErrorMessage(err, '获取日志失败'), 'error');
    }
  }, [get]);

  useEffect(() => {
    fetchHealth();
    fetchBackups();
    fetchLogs();
  }, [fetchHealth, fetchBackups, fetchLogs]);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await post('/ai-ops/backup');
      showMessage('备份完成');
      fetchBackups();
    } catch (err: any) {
      showMessage(getFriendlyErrorMessage(err, '备份失败'), 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    const ok = await confirm({
      title: '恢复备份',
      description: '确定要从该备份恢复？恢复前会自动创建当前数据的快照。恢复过程中请不要关闭服务或重复点击。',
      confirmText: '确认恢复',
      tone: 'danger',
    });
    if (!ok) return;
    setIsRestoring(true);
    try {
      await post('/ai-ops/restore', { backupId });
      showMessage('恢复成功');
      fetchHealth();
    } catch (err: any) {
      showMessage(getFriendlyErrorMessage(err, '恢复失败'), 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await post<ExportPackageInfo>('/ai-ops/export');
      setExportInfo(data);
      showMessage(`导出成功: ${data.packageName}`);
    } catch (err: any) {
      showMessage(getFriendlyErrorMessage(err, '导出失败'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-600" />
            AI运维中心
          </h1>
          <p className="text-slate-500 mt-1">系统健康监控、备份恢复与日志查看</p>
        </div>
        <button
          onClick={() => { setIsLoadingHealth(true); fetchHealth(); fetchBackups(); fetchLogs(); }}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {message && (
        <PageAlert tone={messageType}>{message}</PageAlert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Health + Logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* System Health */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-green-500" />
              系统状态
              {isLoadingHealth ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : healthData?.status === 'HEALTHY' ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">正常</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{healthData?.status}</span>
              )}
            </h3>
            {healthData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Database className="w-4 h-4" />
                    数据库
                  </div>
                  <p className="text-lg font-bold text-slate-900">{healthData.database.latency}ms</p>
                  <p className="text-xs text-slate-500">{healthData.database.status} · {formatBytes(healthData.database.size || 0)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <HardDrive className="w-4 h-4" />
                    磁盘
                  </div>
                  <p className="text-lg font-bold text-slate-900">{healthData.disk.used}MB</p>
                  <p className="text-xs text-slate-500">共 {healthData.disk.total}MB ({healthData.disk.percent}%)</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Zap className="w-4 h-4" />
                    内存
                  </div>
                  <p className="text-lg font-bold text-slate-900">{healthData.memory.used}MB</p>
                  <p className="text-xs text-slate-500">共 {healthData.memory.total}MB ({healthData.memory.percent}%)</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Clock className="w-4 h-4" />
                    运行时间
                  </div>
                  <p className="text-lg font-bold text-slate-900">{formatUptime(healthData.uptime)}</p>
                  <p className="text-xs text-slate-500">v{healthData.version}</p>
                </div>
              </div>
            )}
          </div>

          {/* Backup List */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">备份记录 ({backups.length})</h3>
            {backups.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">暂无备份记录</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {backups.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-slate-700">{b.fileName || b.id}</p>
                      <p className="text-xs text-slate-400">{new Date(b.createdAt).toLocaleString('zh-CN')} · {formatBytes(b.size)}</p>
                    </div>
                    <button
                      onClick={() => handleRestore(b.id)}
                      disabled={isRestoring}
                      className="px-3 py-1.5 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isRestoring ? '恢复中...' : '恢复'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-500" />
              审计日志 ({logs.length})
            </h3>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">暂无日志</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-slate-500 flex-shrink-0">{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                    <span className="font-medium text-slate-700">{log.action}</span>
                    <span className="text-slate-400">{log.target}</span>
                    {log.user && <span className="text-xs text-slate-400 ml-auto">({log.user.realName})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 mb-4">快捷操作</h3>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all disabled:opacity-50"
              >
                <ArrowUpCircle className="w-6 h-6 text-blue-600" />
                <div className="text-left">
                  <span className="text-sm font-medium block">一键备份</span>
                  <span className="text-xs text-slate-400">{isBackingUp ? '备份中...' : '立即全量备份'}</span>
                </div>
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-all"
              >
                <Download className="w-6 h-6 text-green-600" />
                <div className="text-left">
                  <span className="text-sm font-medium block">导出数据</span>
                  <span className="text-xs text-slate-400">导出用于迁移</span>
                </div>
              </button>
              {exportInfo && (
                <a
                  href={exportInfo.downloadUrl}
                  className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition-all"
                >
                  <Download className="w-6 h-6 text-green-700" />
                  <div className="text-left">
                    <span className="text-sm font-medium block">下载迁移包</span>
                    <span className="text-xs text-slate-500">{formatBytes(exportInfo.fileSize)} · 24小时内有效</span>
                  </div>
                </a>
              )}
              <button
                onClick={() => { fetchBackups(); }}
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all"
              >
                <Upload className="w-6 h-6 text-amber-600" />
                <div className="text-left">
                  <span className="text-sm font-medium block">查看备份</span>
                  <span className="text-xs text-slate-400">从备份恢复系统</span>
                </div>
              </button>
              <button
                onClick={() => { fetchLogs(); }}
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all"
              >
                <Shield className="w-6 h-6 text-purple-600" />
                <div className="text-left">
                  <span className="text-sm font-medium block">刷新日志</span>
                  <span className="text-xs text-slate-400">查看最新操作记录</span>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 mb-3">数据安全</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />自动备份：每天凌晨 02:00</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />备份保留：30 天</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />传输加密：JWT + HTTPS</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />存储加密：敏感字段加密</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
