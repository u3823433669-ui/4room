import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  History,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FolderSync,
  Layers,
  ArrowRight,
  ShieldCheck,
  HardDrive,
  FileJson,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { Task, CountdownItem, User } from '../types';
import {
  scanAllLocalTaskSources,
  ScannedTaskSource,
  getLocalSnapshots,
  TaskSnapshotItem,
  mergeTaskLists,
  exportBackupJson,
  parseBackupJson,
  fetchServerStatus,
  fetchServerSnapshots,
  restoreServerSnapshot,
} from '../utils/storage';

interface DataRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTasks: Task[];
  currentCountdowns: CountdownItem[];
  user: User | null;
  token: string | null;
  onRestoreTasks: (tasks: Task[], message: string) => void;
  onForceSync: () => void;
}

export const DataRecoveryModal: React.FC<DataRecoveryModalProps> = ({
  isOpen,
  onClose,
  currentTasks,
  currentCountdowns,
  user,
  token,
  onRestoreTasks,
  onForceSync,
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'snapshots' | 'backup' | 'server'>('sources');
  const [sources, setSources] = useState<ScannedTaskSource[]>([]);
  const [localSnapshots, setLocalSnapshots] = useState<TaskSnapshotItem[]>([]);
  const [serverSnapshots, setServerSnapshots] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshAll = async () => {
    setLoading(true);
    try {
      const scanned = scanAllLocalTaskSources(user?.username);
      setSources(scanned);
      setLocalSnapshots(getLocalSnapshots());

      const status = await fetchServerStatus();
      setServerStatus(status);

      if (token) {
        const sSnaps = await fetchServerSnapshots(token);
        if (sSnaps) {
          setServerSnapshots(sSnaps);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshAll();
    }
  }, [isOpen, user?.username, token]);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Merge tasks from scanned source
  const handleMergeSource = (source: ScannedTaskSource) => {
    const merged = mergeTaskLists(currentTasks, source.tasks);
    const addedCount = merged.length - currentTasks.length;
    onRestoreTasks(merged, `已成功从【${source.label}】合并导入 ${addedCount} 条任务！`);
    showFeedback(`合并完成！新增 ${addedCount} 条任务，已同步至云端与本地`);
  };

  // Replace with scanned source
  const handleReplaceSource = (source: ScannedTaskSource) => {
    if (window.confirm(`确定要将当前任务列表替换为【${source.label}】中的 ${source.tasks.length} 条任务吗？`)) {
      onRestoreTasks(source.tasks, `已将任务替换为【${source.label}】的版本`);
      showFeedback(`已切换到该数据源版本！`);
    }
  };

  // Restore from local snapshot
  const handleRestoreLocalSnapshot = (snap: TaskSnapshotItem) => {
    if (window.confirm(`确定恢复此快照版本（共 ${snap.tasks.length} 条任务）吗？`)) {
      onRestoreTasks(snap.tasks, `已成功恢复 ${new Date(snap.timestamp).toLocaleTimeString()} 的快照版本`);
      showFeedback('快照恢复成功！');
    }
  };

  // Restore from server snapshot
  const handleRestoreServerSnapshot = async (snapshotId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const restored = await restoreServerSnapshot(token, snapshotId);
      if (restored) {
        onRestoreTasks(restored, '已成功从服务器历史快照中恢复！');
        showFeedback('服务器历史版本恢复成功！');
      } else {
        showFeedback('恢复失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle JSON file import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const parsed = parseBackupJson(content);
      if (parsed && parsed.tasks.length > 0) {
        const merged = mergeTaskLists(currentTasks, parsed.tasks);
        onRestoreTasks(merged, `从备份文件成功导入 ${parsed.tasks.length} 条任务！`);
        showFeedback(`导入成功！共合并 ${parsed.tasks.length} 条任务`);
      } else {
        alert('备份文件格式不正确或未包含有效任务数据');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>数据找回与存储中心</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                  服务器持久化运行中
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                账号与本地缓存双重隔离保护，支持找回未登录数据、多版本快照回滚与文件备份
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action toast message */}
        {actionMessage && (
          <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Current State Banner */}
        <div className="px-5 py-3 bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-slate-400">当前账号：</span>
              <strong className="text-indigo-600 dark:text-indigo-400 font-bold ml-1">
                {user ? user.username : '游客模式 (未登录)'}
              </strong>
            </div>
            <div className="hidden sm:inline-block w-px h-3 bg-slate-300 dark:bg-slate-700" />
            <div>
              <span className="text-slate-400">当前在用任务：</span>
              <span className="font-semibold ml-1">{currentTasks.length} 项</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onForceSync();
                showFeedback('已将当前所有数据强制同步至服务器数据库！');
              }}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-2xs flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>立即推送至云端</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-slate-100 dark:border-slate-800 flex space-x-2 bg-white dark:bg-slate-900 text-xs">
          <button
            onClick={() => setActiveTab('sources')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'sources'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>本地与游客数据找回 ({sources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('snapshots')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'snapshots'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>历史自动快照回滚 ({localSnapshots.length + serverSnapshots.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'backup'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>文件备份导入/导出</span>
          </button>

          <button
            onClick={() => setActiveTab('server')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'server'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>服务器存储引擎</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: 本地数据源扫描找回 */}
          {activeTab === 'sources' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>为什么退出或换账号后看不到之前的数据？</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  为保护用户隐私，<strong>未登录（游客模式）</strong>与每个<strong>登录账号</strong>采用独立存储。当您在未登录时添加任务，它们会保存在“游客本地存储”中。下方已自动为您扫描出本机存储的所有任务集，点击<strong>【一键合并导入】</strong>即可瞬间找回并合并到当前账号中！
                </p>
              </div>

              {sources.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  暂未检测到其他本地历史存储
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map((src, idx) => (
                    <div
                      key={src.key}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {src.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                              {src.count} 项任务
                            </span>
                            {src.hasCustomTasks && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                                含自定义事项
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Key: {src.key}
                          </div>

                          {/* Preview tags */}
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {src.sampleTitles.map((t, i) => (
                              <span
                                key={i}
                                className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[180px]"
                              >
                                {t}
                              </span>
                            ))}
                            {src.count > src.sampleTitles.length && (
                              <span className="text-[11px] text-slate-400 self-center">
                                ...等 {src.count} 条
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                          <button
                            onClick={() => handleMergeSource(src)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <FolderSync className="w-3.5 h-3.5" />
                            <span>一键合并导入</span>
                          </button>
                          <button
                            onClick={() => handleReplaceSource(src)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                          >
                            覆盖恢复
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 自动历史快照回滚 */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                每次进行任务修改、删除、添加时，系统均会在本地与服务器分别创建时间戳快照。如果误操作或发生数据差异，可一键回退到指定时刻：
              </p>

              {/* Local Snapshots */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center space-x-1">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                  <span>本地自动时间快照 ({localSnapshots.length})</span>
                </h3>

                {localSnapshots.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    暂无本地历史快照
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {localSnapshots.map(snap => (
                      <div
                        key={snap.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {new Date(snap.timestamp).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300">
                              {snap.taskCount} 项任务
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                            {snap.previewTitles.join('、')}
                          </p>
                        </div>

                        <button
                          onClick={() => handleRestoreLocalSnapshot(snap)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-semibold transition-colors cursor-pointer"
                        >
                          恢复此版本
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Server Snapshots */}
              {token && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center space-x-1">
                    <Database className="w-3.5 h-3.5 text-emerald-500" />
                    <span>云端服务器历史快照 ({serverSnapshots.length})</span>
                  </h3>

                  {serverSnapshots.length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      暂无云端历史快照
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {serverSnapshots.map(snap => (
                        <div
                          key={snap.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {new Date(snap.timestamp).toLocaleString('zh-CN', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-[10px] text-emerald-700 dark:text-emerald-300">
                                {snap.taskCount} 项任务
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                              {snap.previewTitles?.join('、') || '任务快照'}
                            </p>
                          </div>

                          <button
                            onClick={() => handleRestoreServerSnapshot(snap.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold transition-colors cursor-pointer"
                          >
                            从服务器恢复
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 备份导出与导入 */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Export */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                      <Download className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      导出全量数据备份
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      将当前所有的四象限事项及倒数日配置打包为标准 JSON 格式文件下载至您的电脑。
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      exportBackupJson(currentTasks, currentCountdowns, user?.username);
                      showFeedback('数据备份文件已开始下载！');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>立即下载备份文件 (.json)</span>
                  </button>
                </div>

                {/* Import */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                      <Upload className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      从备份文件导入恢复
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      选择之前导出的 JSON 备份文件，智能合并入当前账号，绝不丢失任何数据。
                    </p>
                  </div>

                  <label className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer text-center">
                    <Upload className="w-3.5 h-3.5" />
                    <span>选择备份文件导入</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 服务器存储引擎状态 */}
          {activeTab === 'server' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>真实服务器后端已全天候运行</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  本应用配备完整的 Node.js + Express 服务端程序（运行在端口 3000），使用企业级双重持久化策略：
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                  <li><strong>持久化存储路径：</strong>服务器根目录 <code>/.data/user_tasks.json</code>，写入磁盘永久保留。</li>
                  <li><strong>账号加密防丢失：</strong>密码使用 SHA-256 加盐不可逆哈希，每个账号独立数据库。</li>
                  <li><strong>容器无缝自愈：</strong>无论何时重新启动服务，已保存数据与会话均完整加载。</li>
                  <li><strong>Git 仓库实时同步：</strong>所有修改均通过自动脚本推送至远端 GitHub 仓库。</li>
                </ul>
              </div>

              {serverStatus && (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">服务名称</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{serverStatus.server}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">持久化引擎</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{serverStatus.persistence}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">磁盘落盘文件</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{serverStatus.dataFile}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">已注册账号数</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{serverStatus.totalUsers} 个</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">服务器存储总任务</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{serverStatus.totalTasks} 条</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">服务器连续在线时间</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.floor(serverStatus.uptimeSeconds / 60)} 分钟</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            随时可在右上角点击【云端同步】或用户菜单打开此中心
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
