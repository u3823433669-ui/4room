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
  Gamepad2,
  Save,
  Play,
  Trash2,
  Edit2,
  Check,
  Clock,
  FileText,
} from 'lucide-react';
import { Task, CountdownItem, User, SaveSlot } from '../types';
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
  getLocalSaveSlots,
  saveCurrentToSlot,
  clearSlot,
  renameSlot,
  fetchCloudSlots,
  syncSlotsToCloud,
  exportSingleSlotJson,
} from '../utils/storage';

interface DataRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTasks: Task[];
  currentCountdowns: CountdownItem[];
  user: User | null;
  token: string | null;
  onRestoreTasks: (tasks: Task[], message: string, countdowns?: CountdownItem[]) => void;
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
  const [activeTab, setActiveTab] = useState<'slots' | 'snapshots' | 'sources' | 'backup' | 'server'>('slots');
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [editingSlotName, setEditingSlotName] = useState<string>('');
  const [sources, setSources] = useState<ScannedTaskSource[]>([]);
  const [localSnapshots, setLocalSnapshots] = useState<TaskSnapshotItem[]>([]);
  const [serverSnapshots, setServerSnapshots] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshAll = async () => {
    setLoading(true);
    try {
      // 1. Load local save slots
      const localSlots = getLocalSaveSlots(user?.username);
      setSaveSlots(localSlots);

      // 2. Load scanned sources & local snapshots
      const scanned = scanAllLocalTaskSources(user?.username);
      setSources(scanned);
      setLocalSnapshots(getLocalSnapshots());

      // 3. Load server status & server snapshots & cloud slots
      const status = await fetchServerStatus();
      setServerStatus(status);

      if (token) {
        const cloudSlots = await fetchCloudSlots(token);
        if (cloudSlots && cloudSlots.length > 0) {
          // If server has more recently updated slots, merge/use them
          setSaveSlots(cloudSlots);
        }
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

  // ==========================================
  // Game Save Slots Actions
  // ==========================================

  // Save current progress to slot
  const handleSaveToSlot = (slotIndex: number, defaultName: string) => {
    const updated = saveCurrentToSlot(
      slotIndex,
      defaultName,
      currentTasks,
      currentCountdowns,
      user?.username
    );
    setSaveSlots(updated);
    if (token) {
      syncSlotsToCloud(updated, token);
    }
    showFeedback(`已成功保存至【存档 ${slotIndex}】！包含 ${currentTasks.length} 个任务`);
  };

  // Load from slot
  const handleLoadFromSlot = (slot: SaveSlot) => {
    if (!slot.tasks || slot.tasks.length === 0) {
      alert('此存档槽位为空，请先保存进度。');
      return;
    }
    if (
      window.confirm(
        `确定读取【${slot.name}】吗？\n该存档保存于：${new Date(slot.updatedAt).toLocaleString()}\n包含 ${slot.taskCount} 个事项和 ${slot.countdownCount} 个倒数日。\n读取后将加载此存档的内容。`
      )
    ) {
      onRestoreTasks(
        slot.tasks,
        `已成功读取【${slot.name}】！加载了 ${slot.taskCount} 个任务`,
        slot.countdowns
      );
      showFeedback(`已成功载入【${slot.name}】！`);
    }
  };

  // Clear slot
  const handleClearSlot = (slotIndex: number) => {
    if (window.confirm(`确定清空【存档 ${slotIndex}】吗？此操作无法撤销。`)) {
      const updated = clearSlot(slotIndex, user?.username);
      setSaveSlots(updated);
      if (token) {
        syncSlotsToCloud(updated, token);
      }
      showFeedback(`已清空【存档 ${slotIndex}】`);
    }
  };

  // Start renaming slot
  const handleStartRename = (slot: SaveSlot) => {
    setEditingSlotIndex(slot.slotIndex);
    setEditingSlotName(slot.name);
  };

  // Save renamed slot
  const handleSaveRename = (slotIndex: number) => {
    if (editingSlotName.trim()) {
      const updated = renameSlot(slotIndex, editingSlotName.trim(), user?.username);
      setSaveSlots(updated);
      if (token) {
        syncSlotsToCloud(updated, token);
      }
      showFeedback(`存档名称已更新为【${editingSlotName.trim()}】`);
    }
    setEditingSlotIndex(null);
  };

  // ==========================================
  // Recovery & Snapshots Actions
  // ==========================================

  const handleMergeSource = (source: ScannedTaskSource) => {
    const merged = mergeTaskLists(currentTasks, source.tasks);
    const addedCount = merged.length - currentTasks.length;
    onRestoreTasks(merged, `已成功从【${source.label}】合并导入 ${addedCount} 条任务！`);
    showFeedback(`合并完成！新增 ${addedCount} 条任务，已同步至云端与本地`);
  };

  const handleReplaceSource = (source: ScannedTaskSource) => {
    if (window.confirm(`确定要将当前任务列表替换为【${source.label}】中的 ${source.tasks.length} 条任务吗？`)) {
      onRestoreTasks(source.tasks, `已将任务替换为【${source.label}】的版本`);
      showFeedback(`已切换到该数据源版本！`);
    }
  };

  const handleRestoreLocalSnapshot = (snap: TaskSnapshotItem) => {
    if (window.confirm(`确定恢复此快照版本（共 ${snap.tasks.length} 条任务）吗？`)) {
      onRestoreTasks(snap.tasks, `已成功恢复 ${new Date(snap.timestamp).toLocaleTimeString()} 的快照版本`);
      showFeedback('快照恢复成功！');
    }
  };

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const parsed = parseBackupJson(content);
      if (parsed && parsed.tasks.length > 0) {
        const merged = mergeTaskLists(currentTasks, parsed.tasks);
        onRestoreTasks(merged, `从备份文件成功导入 ${parsed.tasks.length} 条任务！`, parsed.countdowns);
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
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>本地存档与数据中心</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                  支持多存档槽位
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                类似游戏的存档槽位系统（存档1、存档2...），12小时自动历史回滚与离线文档导出
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
        <div className="px-5 pt-3 border-b border-slate-100 dark:border-slate-800 flex space-x-2 bg-white dark:bg-slate-900 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('slots')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'slots'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>游戏式存档槽 (存档1~5)</span>
          </button>

          <button
            onClick={() => setActiveTab('snapshots')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'snapshots'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>12小时自动快照回滚</span>
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'sources'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>未登录数据找回 ({sources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
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
            className={`pb-2.5 px-2 border-b-2 font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'server'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>服务器状态</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: 游戏式存档槽 (存档 1, 存档 2, 存档 3...) */}
          {activeTab === 'slots' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-indigo-900 dark:text-indigo-300 font-semibold">
                  <Gamepad2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>本地存档文档系统说明</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  就像游戏的独立存档槽一样，您可以随时将当下的所有任务与倒数日保存到【存档 1】、【存档 2】等专属槽位中。随时可以【读取存档】载入进度，也可【导出此存档】为独立的 JSON 文档保存到电脑上！
                </p>
              </div>

              {/* Slot Cards List */}
              <div className="space-y-3">
                {saveSlots.map(slot => {
                  const hasData = Boolean(slot.updatedAt && slot.taskCount > 0);
                  const isEditing = editingSlotIndex === slot.slotIndex;

                  return (
                    <div
                      key={slot.slotIndex}
                      className={`p-4 rounded-2xl border transition-all shadow-xs ${
                        hasData
                          ? 'border-indigo-200 dark:border-indigo-900/80 bg-white dark:bg-slate-850 hover:border-indigo-400 dark:hover:border-indigo-600'
                          : 'border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* Left: Slot Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs">
                              存档 {slot.slotIndex}
                            </span>

                            {isEditing ? (
                              <div className="flex items-center space-x-1.5">
                                <input
                                  type="text"
                                  value={editingSlotName}
                                  onChange={e => setEditingSlotName(e.target.value)}
                                  className="px-2 py-0.5 text-xs font-bold rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                                  autoFocus
                                  placeholder="输入存档名称..."
                                />
                                <button
                                  onClick={() => handleSaveRename(slot.slotIndex)}
                                  className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                  title="确认保存名称"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[200px]">
                                  {slot.name}
                                </span>
                                <button
                                  onClick={() => handleStartRename(slot)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                                  title="修改存档名称"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {hasData ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                已存档 ({slot.taskCount} 事项)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-normal bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                空闲槽位
                              </span>
                            )}
                          </div>

                          {/* Time & Preview */}
                          {hasData ? (
                            <div className="mt-2 space-y-1.5">
                              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                <span>
                                  保存于：
                                  {new Date(slot.updatedAt).toLocaleString('zh-CN', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {slot.countdownCount > 0 && (
                                  <span>· 含 {slot.countdownCount} 个倒数日</span>
                                )}
                              </div>

                              {/* Task Preview Tags */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {slot.previewTitles.map((t, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[150px]"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {slot.taskCount > slot.previewTitles.length && (
                                  <span className="text-[10px] text-slate-400 self-center">
                                    ...共 {slot.taskCount} 项
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-slate-400">
                              此槽位当前没有内容，可将当前界面的所有任务一键保存到这里。
                            </p>
                          )}
                        </div>

                        {/* Right: Actions Buttons */}
                        <div className="flex items-center flex-wrap sm:flex-nowrap gap-1.5 shrink-0 self-end sm:self-center">
                          {/* Save current progress into this slot */}
                          <button
                            onClick={() => handleSaveToSlot(slot.slotIndex, slot.name)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                            title="将当前工作台进度覆盖保存到此槽位"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{hasData ? '覆盖保存' : '保存到此槽位'}</span>
                          </button>

                          {/* Load from this slot */}
                          {hasData && (
                            <button
                              onClick={() => handleLoadFromSlot(slot)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                              title="读取此存档并恢复到工作台"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>读取存档</span>
                            </button>
                          )}

                          {/* Export single slot file */}
                          {hasData && (
                            <button
                              onClick={() => exportSingleSlotJson(slot)}
                              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                              title="导出此存档为独立 JSON 文档"
                            >
                              <FileText className="w-4 h-4 text-indigo-500" />
                            </button>
                          )}

                          {/* Clear slot */}
                          {hasData && (
                            <button
                              onClick={() => handleClearSlot(slot.slotIndex)}
                              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="清空此槽位"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: 12小时自动历史快照回滚 */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-semibold">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>12小时自动快照策略</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  为避免记录过于频繁，系统已将历史快照自动记录周期设置为<strong>每 12 小时一次</strong>（半天一次里程碑）。这样历史列表干净且每一个快照都是有意义的大节点，随时可一键回退到指定时刻：
                </p>
              </div>

              {/* Local Snapshots */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center space-x-1">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                  <span>本地自动时间快照 ({localSnapshots.length})</span>
                </h3>

                {localSnapshots.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    暂无本地历史快照（满 12 小时或工作台变动后将自动记录）
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
                    <span>云端服务器历史快照（12小时记录）({serverSnapshots.length})</span>
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

          {/* TAB 3: 本地未登录数据扫描找回 */}
          {activeTab === 'sources' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>未登录或不同账号数据找回</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  系统为您扫描了当前浏览器中的所有存储缓存。若之前曾在游客状态下记录了任务，点击下方<strong>【一键合并导入】</strong>即可直接合并进当前进度！
                </p>
              </div>

              {sources.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  暂未检测到其他本地历史存储
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map(src => (
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

          {/* TAB 4: 备份导出与导入 */}
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
                      导出全量数据备份文档
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      将当前所有的四象限事项及倒数日配置打包为标准 JSON 格式文档下载至本地。
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      exportBackupJson(currentTasks, currentCountdowns, user?.username);
                      showFeedback('数据备份文档已下载！');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>立即下载备份文档 (.json)</span>
                  </button>
                </div>

                {/* Import */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                      <Upload className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      从备份文档导入恢复
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      选择之前导出的 JSON 备份文档，智能合并入当前账号，绝不丢失任何数据。
                    </p>
                  </div>

                  <label className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer text-center">
                    <Upload className="w-3.5 h-3.5" />
                    <span>选择备份文档导入</span>
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

          {/* TAB 5: 服务器存储引擎状态 */}
          {activeTab === 'server' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>真实服务器后端已全天候运行</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  本应用配备完整的 Node.js + Express 服务端程序（运行在端口 3000），使用双重持久化策略：
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                  <li><strong>持久化文件：</strong><code>/.data/user_tasks.json</code> 与 <code>/.data/user_slots.json</code></li>
                  <li><strong>快照记录周期：</strong>每 12 小时自动记录一次历史回滚快照。</li>
                  <li><strong>安全会话：</strong>支持重启自动恢复，会话不丢失。</li>
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
            随时可在顶部【本地存档】或用户菜单快速存取进度
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
