import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Check,
  GripVertical,
  Calendar,
  Repeat,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Settings2,
  List,
  StickyNote,
  Folder,
  FolderOpen,
  FolderPlus,
  Tag,
  Bell,
} from 'lucide-react';
import { QuadrantId, Task, RecurrenceType, QuadrantViewMode } from '../types';
import { sound } from '../utils/sound';
import { getDueDateStatus } from '../utils/escalation';
import {
  isTaskVisibleInMatrix,
  getDaysUntilVisible,
  getRecurrenceLabel,
  getDefaultAdvanceDays,
  WEEKDAY_OPTIONS,
  getNextOccurrenceForWeekdays,
} from '../utils/recurrence';

interface MinimalQuadrantProps {
  id: QuadrantId;
  title: string;
  strategy: string;
  placeholder: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  strategyColor: string;
  cardBg: string;
  borderColor: string;
  buttonBg: string;
  tasks: Task[];
  hideCompleted: boolean;
  globalViewMode?: QuadrantViewMode;
  onAddTask: (
    title: string,
    quadrant: QuadrantId,
    dueDate?: string | null,
    recurrence?: RecurrenceType | null,
    advanceDays?: number | null,
    weekdays?: number[] | null,
    folder?: string | null
  ) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskTitle: (id: string, newTitle: string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onUpdateTaskRecurrence?: (
    id: string,
    recurrence: RecurrenceType | null,
    advanceDays: number | null,
    newDueDate?: string | null,
    weekdays?: number[] | null
  ) => void;
  onUpdateTaskFolder?: (id: string, folder: string | null) => void;
  onDropTask: (taskId: string, targetQuadrant: QuadrantId) => void;
}

const RECURRENCE_OPTIONS: { type: RecurrenceType; label: string; desc: string }[] = [
  { type: 'none', label: '单次', desc: '不循环，完成即归档' },
  { type: 'daily', label: '每日', desc: '每天重复，如日记/每日复盘，次日自动刷新' },
  { type: 'weekly', label: '每周', desc: '每周固定重复，如周报/例会' },
  { type: 'monthly', label: '每月', desc: '每月定期重复，如月度总结/账单' },
  { type: 'yearly', label: '每年', desc: '每年纪念日/生日，可设置提前15天显示' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: '🔔 当天提醒 (到期当天)', shortLabel: '当天提醒' },
  { value: 1, label: '🔔 提前 1 天提醒', shortLabel: '提前1天' },
  { value: 2, label: '🔔 提前 2 天提醒', shortLabel: '提前2天' },
  { value: 3, label: '🔔 提前 3 天提醒', shortLabel: '提前3天' },
  { value: 7, label: '🔔 提前 7 天提醒', shortLabel: '提前7天' },
  { value: 15, label: '🔔 提前 15 天提醒', shortLabel: '提前15天' },
  { value: 30, label: '🔔 提前 30 天提醒', shortLabel: '提前30天' },
  { value: null, label: '仅到期显示 (不设提前提醒)', shortLabel: '不提前' },
];

const ADVANCE_DAYS_OPTIONS = REMINDER_OPTIONS;

const DEFAULT_FOLDERS = ['工作', '学习', '日常', '备忘'];

export const MinimalQuadrant: React.FC<MinimalQuadrantProps> = ({
  id,
  title,
  strategy,
  placeholder,
  dotColor,
  badgeBg,
  badgeText,
  strategyColor,
  cardBg,
  borderColor,
  buttonBg,
  tasks,
  hideCompleted,
  globalViewMode = 'list',
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTaskTitle,
  onUpdateTaskDueDate,
  onUpdateTaskRecurrence,
  onUpdateTaskFolder,
  onDropTask,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedDueDate, setSelectedDueDate] = useState<string>('');
  const [selectedRecurrence, setSelectedRecurrence] = useState<RecurrenceType>('none');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([new Date().getDay()]);
  const [selectedAdvanceDays, setSelectedAdvanceDays] = useState<number | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [showOptionsPanel, setShowOptionsPanel] = useState<boolean>(false);

  // View mode: local override, fallback to global
  const [localViewMode, setLocalViewMode] = useState<QuadrantViewMode | null>(null);
  const currentViewMode: QuadrantViewMode = localViewMode || globalViewMode;

  // Folder collapse state: folderName -> isCollapsed
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Active folder for new task assignment popup
  const [folderPickerTaskId, setFolderPickerTaskId] = useState<string | null>(null);
  const [customFolderInput, setCustomFolderInput] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);

  const [isDragOver, setIsDragOver] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [changingDateTaskId, setChangingDateTaskId] = useState<string | null>(null);
  const [editingRecurrenceTaskId, setEditingRecurrenceTaskId] = useState<string | null>(null);
  const [showHiddenDrawer, setShowHiddenDrawer] = useState<boolean>(false);

  // Recurrence edit temp state for an existing task
  const [tempRecurrence, setTempRecurrence] = useState<RecurrenceType>('none');
  const [tempWeekdays, setTempWeekdays] = useState<number[]>([new Date().getDay()]);
  const [tempAdvanceDays, setTempAdvanceDays] = useState<number | null>(null);
  const [tempDueDate, setTempDueDate] = useState<string>('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectRecurrence = (type: RecurrenceType) => {
    setSelectedRecurrence(type);
    if (type !== 'none') {
      const defaultAdvance = getDefaultAdvanceDays(type);
      setSelectedAdvanceDays(defaultAdvance);
      if (type === 'weekly') {
        const initialWeekdays = selectedWeekdays.length > 0 ? selectedWeekdays : [new Date().getDay()];
        setSelectedWeekdays(initialWeekdays);
        setSelectedDueDate(getNextOccurrenceForWeekdays(initialWeekdays));
      } else if (!selectedDueDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        setSelectedDueDate(todayStr);
      }
    } else {
      setSelectedAdvanceDays(null);
    }
  };

  const toggleSelectedWeekday = (day: number) => {
    let next: number[];
    if (selectedWeekdays.includes(day)) {
      if (selectedWeekdays.length === 1) return;
      next = selectedWeekdays.filter(d => d !== day);
    } else {
      next = [...selectedWeekdays, day];
    }
    setSelectedWeekdays(next);
    setSelectedDueDate(getNextOccurrenceForWeekdays(next));
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    onAddTask(
      inputValue.trim(),
      id,
      selectedDueDate || null,
      selectedRecurrence === 'none' ? null : selectedRecurrence,
      selectedAdvanceDays,
      selectedRecurrence === 'weekly' ? selectedWeekdays : null,
      selectedFolder.trim() || null
    );
    setInputValue('');
    setSelectedDueDate('');
    setSelectedRecurrence('none');
    setSelectedAdvanceDays(null);
    setSelectedWeekdays([new Date().getDay()]);
    setShowOptionsPanel(false);
    setCurrentPage(1);
    sound.playPop();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onDropTask(taskId, id);
      sound.playPop();
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Pagination state: default 8 items per page
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(8);

  // Split tasks into visible matrix tasks vs. hidden upcoming recurring tasks
  const matrixTasks = tasks.filter(t => isTaskVisibleInMatrix(t));
  const hiddenRecurringTasks = tasks.filter(t => !t.completed && !isTaskVisibleInMatrix(t));

  const visibleTasks = hideCompleted ? matrixTasks.filter(t => !t.completed) : matrixTasks;
  const count = matrixTasks.filter(t => !t.completed).length;

  const totalVisible = visibleTasks.length;
  const effectivePageSize = pageSize > 0 ? pageSize : totalVisible || 1;
  const totalPages = Math.max(1, Math.ceil(totalVisible / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Auto-clamp current page if total pages decreases
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedTasks = pageSize === 0
    ? visibleTasks
    : visibleTasks.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  // Folders gathering
  const allKnownFolders = useMemo(() => {
    const set = new Set<string>(DEFAULT_FOLDERS);
    tasks.forEach(t => {
      if (t.folder && t.folder.trim()) set.add(t.folder.trim());
    });
    return Array.from(set);
  }, [tasks]);

  // Group visible tasks by folder for Folder View
  const groupedTasksByFolder = useMemo(() => {
    const map = new Map<string, Task[]>();
    visibleTasks.forEach(task => {
      const fName = task.folder && task.folder.trim() ? task.folder.trim() : '默认待办';
      if (!map.has(fName)) {
        map.set(fName, []);
      }
      map.get(fName)!.push(task);
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === '默认待办') return 1;
      if (b[0] === '默认待办') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [visibleTasks]);

  const toggleFolderCollapse = (folderName: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const collapseAllFolders = () => {
    const next: Record<string, boolean> = {};
    groupedTasksByFolder.forEach(([name]) => {
      next[name] = true;
    });
    setCollapsedFolders(next);
  };

  const expandAllFolders = () => {
    setCollapsedFolders({});
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingText(task.title);
  };

  const saveEditing = (taskId: string) => {
    if (editingText.trim()) {
      onUpdateTaskTitle(taskId, editingText.trim());
    }
    setEditingTaskId(null);
  };

  const isTaskInActiveReminder = (task: Task) => {
    if (task.completed || !task.dueDate || task.advanceDays === null || task.advanceDays === undefined) {
      return false;
    }
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = task.dueDate.split('-').map(Number);
      const dueDay = new Date(y, m - 1, d);
      dueDay.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= task.advanceDays && diffDays >= 0;
    } catch {
      return false;
    }
  };

  const openReminderEditor = (task: Task) => {
    setEditingRecurrenceTaskId(task.id);
    const rec = task.recurrence || 'none';
    setTempRecurrence(rec);
    const defAdvance =
      task.advanceDays !== undefined && task.advanceDays !== null
        ? task.advanceDays
        : task.dueDate
        ? 0
        : getDefaultAdvanceDays(task.recurrence);
    setTempAdvanceDays(defAdvance);
    setTempDueDate(task.dueDate || new Date().toISOString().split('T')[0]);

    if (task.weekdays && task.weekdays.length > 0) {
      setTempWeekdays(task.weekdays);
    } else if (task.dueDate) {
      try {
        const [y, m, d] = task.dueDate.split('-').map(Number);
        const day = new Date(y, m - 1, d).getDay();
        setTempWeekdays([day]);
      } catch {
        setTempWeekdays([new Date().getDay()]);
      }
    } else {
      setTempWeekdays([new Date().getDay()]);
    }
  };

  const openRecurrenceEditor = openReminderEditor;

  const toggleTempWeekday = (day: number) => {
    let next: number[];
    if (tempWeekdays.includes(day)) {
      if (tempWeekdays.length === 1) return;
      next = tempWeekdays.filter(d => d !== day);
    } else {
      next = [...tempWeekdays, day];
    }
    setTempWeekdays(next);
    setTempDueDate(getNextOccurrenceForWeekdays(next));
  };

  const saveRecurrenceEditor = (taskId: string) => {
    if (onUpdateTaskRecurrence) {
      onUpdateTaskRecurrence(
        taskId,
        tempRecurrence === 'none' ? null : tempRecurrence,
        tempAdvanceDays,
        tempDueDate || null,
        tempRecurrence === 'weekly' ? tempWeekdays : null
      );
    }
    setEditingRecurrenceTaskId(null);
  };

  // Sticker card theme colors per quadrant
  const stickerStyles = {
    q1: 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200/90 dark:border-rose-900/60 text-slate-800 dark:text-slate-100 hover:border-rose-300',
    q2: 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200/90 dark:border-amber-900/60 text-slate-800 dark:text-slate-100 hover:border-amber-300',
    q3: 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-200/90 dark:border-blue-900/60 text-slate-800 dark:text-slate-100 hover:border-blue-300',
    q4: 'bg-slate-50/95 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-slate-300',
  }[id];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-[320px] sm:h-[350px] md:h-[calc((100vh-125px)/2)] md:min-h-[260px] md:max-h-[430px] rounded-2xl border p-2.5 sm:p-3 transition-all duration-200 ${cardBg} ${borderColor} ${
        isDragOver ? 'ring-2 ring-indigo-400 bg-indigo-50/20 shadow-md' : 'shadow-2xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 select-none shrink-0 border-b border-slate-200/40 dark:border-slate-700/40">
        <div className="flex items-center space-x-1.5 min-w-0">
          {/* Dot */}
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight truncate">
            {title}
          </h3>
          {/* Counter pill */}
          <span
            className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-full ${badgeBg} ${badgeText} shrink-0`}
          >
            {count}
          </span>

          {/* Hidden tasks quick count indicator */}
          {hiddenRecurringTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHiddenDrawer(!showHiddenDrawer)}
              className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-100/80 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 flex items-center space-x-1 cursor-pointer hover:bg-purple-200/80 transition-colors shrink-0"
              title="点击查看未到提前展示期的循环任务"
            >
              <Repeat className="w-2.5 h-2.5" />
              <span>{hiddenRecurringTasks.length}个未到期</span>
            </button>
          )}
        </div>

        {/* Right: Quadrant View Mode Switcher + Strategy */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* 3-Mode segmented button: 清单 / 贴纸 / 文件夹 */}
          <div className="flex items-center bg-white/80 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[10px] shadow-2xs">
            <button
              type="button"
              onClick={() => setLocalViewMode('list')}
              className={`p-1 rounded transition-colors cursor-pointer ${
                currentViewMode === 'list'
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="切换为：紧凑清单列表"
            >
              <List className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setLocalViewMode('sticker')}
              className={`p-1 rounded transition-colors cursor-pointer ${
                currentViewMode === 'sticker'
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="切换为：贴纸便签（双列紧凑，一屏放双倍）"
            >
              <StickyNote className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setLocalViewMode('folder')}
              className={`p-1 rounded transition-colors cursor-pointer ${
                currentViewMode === 'folder'
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="切换为：文件夹折叠分组（分类收纳，极省空间）"
            >
              <Folder className="w-3 h-3" />
            </button>
          </div>

          <span className={`text-[11px] font-semibold ${strategyColor} hidden xs:inline`}>
            {strategy}
          </span>
        </div>
      </div>

      {/* Task List / Stickers / Folders Area (scrollable) */}
      <div className="flex-1 overflow-y-auto py-1 pr-0.5 min-h-0">
        {visibleTasks.length === 0 && hiddenRecurringTasks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic select-none">
            {isDragOver ? '放置任务到此象限' : '暂无任务，可在下方快速添加'}
          </div>
        ) : visibleTasks.length === 0 && hiddenRecurringTasks.length > 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 dark:text-slate-500 text-center space-y-1 select-none p-3">
            <Repeat className="w-5 h-5 text-purple-400 dark:text-purple-500 animate-spin-slow mb-0.5" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              当前无待处理任务
            </p>
            <p className="text-[11px] text-slate-400">
              有 {hiddenRecurringTasks.length} 个周期任务尚未到达展示时间
            </p>
            <button
              type="button"
              onClick={() => setShowHiddenDrawer(true)}
              className="text-xs text-purple-600 dark:text-purple-400 font-semibold underline mt-1 cursor-pointer"
            >
              展开查看未到期周期任务
            </button>
          </div>
        ) : currentViewMode === 'sticker' ? (
          /* ================================================= */
          /* STICKER / STICKY NOTES VIEW: 2-column compact grid */
          /* ================================================= */
          <div className="grid grid-cols-2 gap-1.5">
            {paginatedTasks.map(task => {
              const dueStatus = getDueDateStatus(task.dueDate);
              const isRecurring = task.recurrence && task.recurrence !== 'none';
              const isQ4 = id === 'q4';
              const isTodayDeadline = dueStatus.text === '今天截止';
              const isDailyOverdueInQ4 = isQ4 && task.recurrence === 'daily' && dueStatus.isOverdue;
              const shouldShowDueBadge = Boolean(
                task.dueDate &&
                !(isQ4 && isTodayDeadline) &&
                !isDailyOverdueInQ4
              );

              return (
                <div
                  key={task.id}
                  draggable={true}
                  onDragStart={e => handleDragStart(e, task)}
                  className={`group relative flex flex-col justify-between p-2 rounded-xl border shadow-2xs transition-all hover:shadow-xs ${stickerStyles} ${
                    task.completed ? 'opacity-55' : ''
                  }`}
                >
                  {/* Top: checkbox + folder + actions */}
                  <div className="flex items-center justify-between space-x-1 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        onToggleTask(task.id);
                        if (!task.completed) sound.playComplete();
                        else sound.playPop();
                      }}
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        task.completed
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-500 hover:border-indigo-500 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </button>

                    {/* Folder Pill */}
                    {task.folder ? (
                      <button
                        type="button"
                        onClick={() => setFolderPickerTaskId(task.id)}
                        className="text-[9px] px-1 py-0.2 rounded font-medium bg-indigo-100/80 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 truncate max-w-[70px] cursor-pointer"
                        title={`所属文件夹: ${task.folder} (点击修改)`}
                      >
                        📁 {task.folder}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFolderPickerTaskId(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-[9px] text-slate-400 hover:text-indigo-600 transition-opacity"
                        title="添加到文件夹"
                      >
                        +文件夹
                      </button>
                    )}

                    {/* Reminder bell button */}
                    <button
                      type="button"
                      onClick={() => openReminderEditor(task)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-600 transition-opacity p-0.5 cursor-pointer"
                      title="更改提醒时间与日期"
                    >
                      <Bell className="w-3 h-3" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity p-0.5 cursor-pointer"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Middle: Title */}
                  <div className="flex-1 my-0.5">
                    {editingTaskId === task.id ? (
                      <input
                        type="text"
                        value={editingText}
                        autoFocus
                        onChange={e => setEditingText(e.target.value)}
                        onBlur={() => saveEditing(task.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEditing(task.id);
                          if (e.key === 'Escape') setEditingTaskId(null);
                        }}
                        className="w-full text-xs bg-white dark:bg-slate-900 border border-indigo-500 rounded px-1 py-0.5 outline-none"
                      />
                    ) : (
                      <p
                        onClick={() => startEditing(task)}
                        className={`text-xs font-medium leading-snug line-clamp-2 cursor-text ${
                          task.completed ? 'line-through text-slate-400' : ''
                        }`}
                        title="点击直接修改标题"
                      >
                        {task.title}
                      </p>
                    )}
                  </div>

                  {/* Bottom: Badges */}
                  <div className="flex flex-wrap items-center gap-1 pt-1 mt-auto border-t border-slate-200/40 dark:border-slate-700/40">
                    {isRecurring && (
                      <span
                        onClick={() => openReminderEditor(task)}
                        className="inline-flex items-center space-x-0.5 text-[9px] px-1 py-0.2 rounded bg-purple-100/90 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold cursor-pointer"
                        title="点击更改循环与提醒规则"
                      >
                        <Repeat className="w-2.5 h-2.5" />
                        <span>{getRecurrenceLabel(task.recurrence, task.weekdays)}</span>
                      </span>
                    )}

                    {task.advanceDays !== null && task.advanceDays !== undefined && (
                      <span
                        onClick={() => openReminderEditor(task)}
                        className={`inline-flex items-center space-x-0.5 text-[9px] px-1 py-0.2 rounded font-medium cursor-pointer transition-colors ${
                          isTaskInActiveReminder(task)
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                            : 'bg-amber-50/90 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                        }`}
                        title="点击更改提醒时间"
                      >
                        <Bell className="w-2.5 h-2.5 text-amber-600" />
                        <span>{task.advanceDays === 0 ? '当天提醒' : `提前${task.advanceDays}天`}</span>
                      </span>
                    )}

                    {shouldShowDueBadge && (
                      <span
                        onClick={() => openReminderEditor(task)}
                        className={`inline-flex items-center space-x-0.5 text-[9px] px-1 py-0.2 rounded font-medium cursor-pointer ${
                          dueStatus.isOverdue
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                        title="点击更改提醒与截止时间"
                      >
                        <Calendar className="w-2.5 h-2.5" />
                        <span>{dueStatus.text}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : currentViewMode === 'folder' ? (
          /* ================================================= */
          /* FOLDER / COLLAPSIBLE CATEGORIES VIEW              */
          /* ================================================= */
          <div className="space-y-1.5">
            {/* Quick folder action controls */}
            <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center space-x-1">
                <span>共 {groupedTasksByFolder.length} 个分类文件夹</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={collapseAllFolders}
                  className="hover:text-indigo-600 cursor-pointer"
                >
                  全部折叠
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={expandAllFolders}
                  className="hover:text-indigo-600 cursor-pointer"
                >
                  全部展开
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(true)}
                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center space-x-0.5"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>新建文件夹</span>
                </button>
              </div>
            </div>

            {/* Folder Groups */}
            {groupedTasksByFolder.map(([folderName, folderTasks]) => {
              const isCollapsed = Boolean(collapsedFolders[folderName]);
              const completedCount = folderTasks.filter(t => t.completed).length;

              return (
                <div
                  key={folderName}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-800/60 overflow-hidden shadow-2xs"
                >
                  {/* Folder Accordion Header */}
                  <div
                    onClick={() => toggleFolderCollapse(folderName)}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100/60 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      {isCollapsed ? (
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {folderName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                        {folderTasks.length - completedCount}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                      <span>{isCollapsed ? '已折叠' : '已展开'}</span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedFolder(folderName === '默认待办' ? '' : folderName);
                        }}
                        className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-medium cursor-pointer"
                        title="在此文件夹下添加新任务"
                      >
                        +添加
                      </button>
                    </div>
                  </div>

                  {/* Tasks inside folder (when expanded) */}
                  {!isCollapsed && (
                    <div className="p-1 space-y-1 bg-white/40 dark:bg-slate-900/30">
                      {folderTasks.map(task => {
                        const dueStatus = getDueDateStatus(task.dueDate);
                        const isRecurring = task.recurrence && task.recurrence !== 'none';

                        return (
                          <div
                            key={task.id}
                            draggable={true}
                            onDragStart={e => handleDragStart(e, task)}
                            className={`group flex items-center justify-between bg-white dark:bg-slate-800/90 rounded-lg px-2 py-1 border border-slate-200/60 dark:border-slate-700/60 transition-all hover:border-slate-300 ${
                              task.completed ? 'opacity-60 bg-slate-50/60 dark:bg-slate-800/40' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-2 flex-1 min-w-0 mr-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleTask(task.id);
                                  if (!task.completed) sound.playComplete();
                                  else sound.playPop();
                                }}
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                  task.completed
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'border-slate-300 dark:border-slate-500 hover:border-indigo-500 bg-white dark:bg-slate-900'
                                }`}
                              >
                                {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </button>

                              <span
                                onClick={() => startEditing(task)}
                                className={`text-xs leading-snug break-words flex-1 cursor-text ${
                                  task.completed
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {task.title}
                              </span>

                              {isRecurring && (
                                <button
                                  type="button"
                                  onClick={() => openReminderEditor(task)}
                                  className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-semibold cursor-pointer"
                                  title="点击更改循环规则"
                                >
                                  {getRecurrenceLabel(task.recurrence)}
                                </button>
                              )}

                              {task.advanceDays !== null && task.advanceDays !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => openReminderEditor(task)}
                                  className={`text-[9px] px-1 py-0.2 rounded font-medium cursor-pointer transition-colors ${
                                    isTaskInActiveReminder(task)
                                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300'
                                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                                  }`}
                                  title="点击更改提醒时间"
                                >
                                  🔔 {task.advanceDays === 0 ? '当天提醒' : `提前${task.advanceDays}天`}
                                </button>
                              )}

                              {task.dueDate && (
                                <button
                                  type="button"
                                  onClick={() => openReminderEditor(task)}
                                  className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                                  title="点击修改提醒与到期时间"
                                >
                                  {dueStatus.text}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => openReminderEditor(task)}
                                className="p-0.5 text-slate-400 hover:text-amber-600 cursor-pointer"
                                title="更改提醒时间与日期"
                              >
                                <Bell className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setFolderPickerTaskId(task.id)}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                title="移至其他文件夹"
                              >
                                <Tag className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTask(task.id)}
                                className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                                title="删除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ================================================= */
          /* LIST VIEW: Ultra-compact, slim gap list           */
          /* ================================================= */
          <div className="space-y-1">
            {paginatedTasks.map(task => {
              const dueStatus = getDueDateStatus(task.dueDate);
              const isRecurring = task.recurrence && task.recurrence !== 'none';
              const isQ4 = id === 'q4';
              const isTodayDeadline = dueStatus.text === '今天截止';
              const isDailyOverdueInQ4 = isQ4 && task.recurrence === 'daily' && dueStatus.isOverdue;
              const shouldShowDueBadge = Boolean(
                task.dueDate &&
                !(isQ4 && isTodayDeadline) &&
                !isDailyOverdueInQ4
              );

              return (
                <div
                  key={task.id}
                  draggable={true}
                  onDragStart={e => handleDragStart(e, task)}
                  className={`group flex items-center justify-between bg-white dark:bg-slate-800/90 rounded-lg px-2.5 py-1 sm:py-1.2 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-600 ${
                    task.completed ? 'opacity-60 bg-slate-50/60 dark:bg-slate-800/40' : ''
                  }`}
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0 mr-1.5">
                    {/* Square checkbox */}
                    <button
                      type="button"
                      onClick={() => {
                        onToggleTask(task.id);
                        if (!task.completed) sound.playComplete();
                        else sound.playPop();
                      }}
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        task.completed
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-500 hover:border-indigo-500 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </button>

                    {/* Task Title (Editable) */}
                    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1">
                      {editingTaskId === task.id ? (
                        <input
                          type="text"
                          value={editingText}
                          autoFocus
                          onChange={e => setEditingText(e.target.value)}
                          onBlur={() => saveEditing(task.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEditing(task.id);
                            if (e.key === 'Escape') setEditingTaskId(null);
                          }}
                          className="flex-1 text-xs sm:text-[13px] bg-transparent border-b border-indigo-500 outline-none text-slate-800 dark:text-slate-100 py-0.2"
                        />
                      ) : (
                        <span
                          onClick={() => startEditing(task)}
                          className={`text-xs sm:text-[13px] leading-tight break-words cursor-text select-text ${
                            task.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {task.title}
                        </span>
                      )}

                      {/* Folder Tag */}
                      {task.folder && (
                        <button
                          type="button"
                          onClick={() => setFolderPickerTaskId(task.id)}
                          className="inline-flex items-center space-x-0.5 text-[9px] px-1.5 py-0.2 rounded font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors cursor-pointer"
                          title="点击更换文件夹"
                        >
                          <span>📁 {task.folder}</span>
                        </button>
                      )}

                      {/* Recurrence Badge */}
                      {isRecurring && (
                        <button
                          type="button"
                          onClick={() => openReminderEditor(task)}
                          className="inline-flex items-center space-x-0.5 text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 hover:bg-purple-100 transition-colors cursor-pointer"
                          title="点击修改循环周期及提醒规则"
                        >
                          <Repeat className="w-2.5 h-2.5" />
                          <span>{getRecurrenceLabel(task.recurrence, task.weekdays)}</span>
                        </button>
                      )}

                      {/* Reminder Badge */}
                      {task.advanceDays !== null && task.advanceDays !== undefined && (
                        <button
                          type="button"
                          onClick={() => openReminderEditor(task)}
                          className={`inline-flex items-center space-x-0.5 text-[9px] px-1.5 py-0.2 rounded font-medium transition-colors cursor-pointer ${
                            isTaskInActiveReminder(task)
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/70 hover:bg-amber-100'
                          }`}
                          title="点击更改提醒时间"
                        >
                          <Bell className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                          <span>{task.advanceDays === 0 ? '当天提醒' : `提前${task.advanceDays}天`}</span>
                        </button>
                      )}

                      {/* Due Date & Auto-escalation Badge */}
                      {shouldShowDueBadge && (
                        <button
                          type="button"
                          onClick={() => openReminderEditor(task)}
                          className={`inline-flex items-center space-x-1 text-[9px] px-1.5 py-0.2 rounded font-medium cursor-pointer transition-colors ${
                            dueStatus.isOverdue
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 animate-pulse'
                              : dueStatus.isUrgent
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                          title="点击修改截止日期或提醒时间"
                        >
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{dueStatus.text}</span>
                          {task.autoEscalatedFrom && !isRecurring && (
                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 ml-0.5">
                              (临期转入)
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hover actions: Reminder + Folder + Recurrence + Delete + Drag */}
                  <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openReminderEditor(task)}
                      className="p-1 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                      title="更改提醒时间与日期"
                    >
                      <Bell className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFolderPickerTaskId(task.id)}
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="移动至文件夹"
                    >
                      <Tag className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openReminderEditor(task)}
                      className="p-1 text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                      title="设置循环规则"
                    >
                      <Repeat className="w-3 h-3" />
                    </button>
                    {!task.dueDate && (
                      <button
                        type="button"
                        onClick={() => setChangingDateTaskId(task.id)}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="设置到期时间"
                      >
                        <Calendar className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <div
                      className="text-slate-300 cursor-grab active:cursor-grabbing p-0.5"
                      title="拖拽移动"
                    >
                      <GripVertical className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsible Hidden Upcoming Recurring Tasks Drawer */}
        {hiddenRecurringTasks.length > 0 && (
          <div className="mt-1.5 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowHiddenDrawer(!showHiddenDrawer)}
              className="w-full flex items-center justify-between px-2 py-1 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3 h-3" />
                <span>
                  未到期周期任务（{hiddenRecurringTasks.length} 个静默隐藏中）
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[10px] font-normal">
                <span>{showHiddenDrawer ? '收起' : '展开查看'}</span>
                {showHiddenDrawer ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </div>
            </button>

            {showHiddenDrawer && (
              <div className="mt-1.5 space-y-1.5 p-1.5 rounded-lg bg-purple-50/30 dark:bg-purple-950/20 border border-purple-200/40 dark:border-purple-900/30">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 px-1">
                  这些任务已按设定的规则隐藏，将在距到期日设定天数时自动浮现：
                </p>
                {hiddenRecurringTasks.map(task => {
                  const daysUntil = getDaysUntilVisible(task);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-1.5 rounded bg-white/90 dark:bg-slate-800/90 border border-purple-200/60 dark:border-purple-800/50 text-xs"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {task.title}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-900/70 text-purple-700 dark:text-purple-300 font-semibold">
                            {getRecurrenceLabel(task.recurrence)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          到期日: {task.dueDate} · 还有 <strong className="text-purple-600 dark:text-purple-400 font-bold">{daysUntil}</strong> 天进入显示期
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateTaskRecurrence) {
                              onUpdateTaskRecurrence(task.id, task.recurrence || null, null, task.dueDate);
                            }
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
                          title="立刻提前展示此任务"
                        >
                          立刻展示
                        </button>
                        <button
                          type="button"
                          onClick={() => openRecurrenceEditor(task)}
                          className="p-1 text-slate-400 hover:text-purple-600"
                          title="修改规则"
                        >
                          <Settings2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1 text-slate-400 hover:text-rose-500"
                          title="删除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination Bar - shown in list/sticker mode when multiple pages exist */}
      {totalPages > 1 && currentViewMode !== 'folder' && (
        <div className="flex items-center justify-between pt-1 pb-0.5 px-1 border-t border-slate-200/50 dark:border-slate-700/50 text-xs select-none shrink-0">
          <div className="flex items-center space-x-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span>
              第 <strong className="text-slate-700 dark:text-slate-200 font-semibold">{safeCurrentPage}</strong> / {totalPages} 页
            </span>
            <span>· 共 {totalVisible} 条</span>
          </div>

          <div className="flex items-center space-x-1">
            <div className="flex items-center space-x-0.5 mr-1 bg-slate-100/90 dark:bg-slate-800/90 rounded p-0.5 text-[9px]">
              {[8, 12, 0].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                  className={`px-1 py-0.2 rounded transition-all cursor-pointer ${
                    pageSize === sz
                      ? 'bg-white dark:bg-slate-700 font-bold text-slate-800 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title={sz === 0 ? '显示全部' : `每页 ${sz} 条`}
                >
                  {sz === 0 ? '全部' : `${sz}条`}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Reminder & Recurrence & Due Date Settings Modal */}
      {editingRecurrenceTaskId && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 max-w-sm w-full shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                    更改提醒与截止时间
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate max-w-[210px]">
                    {tasks.find(t => t.id === editingRecurrenceTaskId)?.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecurrenceTaskId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Due Date Section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>截止 / 目标日期</span>
                </label>
                <div className="flex items-center space-x-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setTempDueDate(todayStr);
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    今天
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tom = new Date();
                      tom.setDate(tom.getDate() + 1);
                      setTempDueDate(tom.toISOString().split('T')[0]);
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    明天
                  </button>
                  {tempDueDate && (
                    <button
                      type="button"
                      onClick={() => setTempDueDate('')}
                      className="text-rose-500 hover:underline cursor-pointer"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
              <input
                type="date"
                value={tempDueDate}
                onChange={e => setTempDueDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-amber-500"
              />
            </div>

            {/* Reminder Timing Section (User's core request) */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span>提醒时间设置</span>
                </label>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200/50">
                  {tempAdvanceDays === 0
                    ? '🔔 当天提醒'
                    : tempAdvanceDays === 1
                    ? '🔔 提前 1 天提醒'
                    : tempAdvanceDays !== null
                    ? `🔔 提前 ${tempAdvanceDays} 天提醒`
                    : '仅到期显示 (不设提前提醒)'}
                </span>
              </div>

              {/* Quick reminder choice pills */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { value: 0, label: '当天提醒' },
                  { value: 1, label: '提前 1 天' },
                  { value: 2, label: '提前 2 天' },
                  { value: 3, label: '提前 3 天' },
                  { value: 7, label: '提前 7 天' },
                  { value: 15, label: '提前 15 天' },
                  { value: 30, label: '提前 30 天' },
                  { value: null, label: '不提前' },
                ].map(opt => {
                  const isSelected = tempAdvanceDays === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setTempAdvanceDays(opt.value)}
                      className={`py-1 rounded-lg text-center text-[10px] font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-white font-bold shadow-2xs ring-1 ring-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                {tempAdvanceDays === 0
                  ? '提示：当天提醒仅在到期日当天展示并触发到期提醒。'
                  : tempAdvanceDays === 1
                  ? '提示：提前1天提醒将在到期日前1天开始在象限中突出显示。'
                  : tempAdvanceDays !== null
                  ? `提示：将在到期日前 ${tempAdvanceDays} 天开始在象限中突出显示。`
                  : '提示：不设提前提醒，事项将仅按常规截止日期显示。'}
              </p>
            </div>

            {/* Recurrence Cycle Section */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <Repeat className="w-3.5 h-3.5 text-purple-600" />
                <span>循环频次（可选）</span>
              </label>
              <div className="grid grid-cols-5 gap-1">
                {RECURRENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setTempRecurrence(opt.type);
                      if (opt.type === 'weekly' && tempWeekdays.length === 0) {
                        setTempWeekdays([new Date().getDay()]);
                      }
                    }}
                    className={`py-1 rounded-lg text-center text-[10px] font-medium transition-all cursor-pointer ${
                      tempRecurrence === opt.type
                        ? 'bg-purple-600 text-white font-bold shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Weekly weekday picker */}
              {tempRecurrence === 'weekly' && (
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] text-slate-500">选择每周提醒的星期几：</span>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_OPTIONS.map(opt => {
                      const isSelected = tempWeekdays.includes(opt.day);
                      return (
                        <button
                          key={opt.day}
                          type="button"
                          onClick={() => toggleTempWeekday(opt.day)}
                          className={`py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 text-white font-bold'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingRecurrenceTaskId(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => saveRecurrenceEditor(editingRecurrenceTaskId)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs cursor-pointer flex items-center space-x-1"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>保存提醒设置</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Folder Assignment Picker Overlay */}
      {folderPickerTaskId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 max-w-xs w-full shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                <Folder className="w-4 h-4 text-amber-500" />
                <span>选择任务所属文件夹</span>
              </div>
              <button
                type="button"
                onClick={() => setFolderPickerTaskId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              设置文件夹后，在【文件夹视图】可分类折叠，极大地节省屏幕空间：
            </p>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (onUpdateTaskFolder) onUpdateTaskFolder(folderPickerTaskId, null);
                  setFolderPickerTaskId(null);
                }}
                className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                未分类 / 默认
              </button>

              {allKnownFolders.map(fName => (
                <button
                  key={fName}
                  type="button"
                  onClick={() => {
                    if (onUpdateTaskFolder) onUpdateTaskFolder(folderPickerTaskId, fName);
                    setFolderPickerTaskId(null);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 cursor-pointer"
                >
                  📁 {fName}
                </button>
              ))}
            </div>

            {/* Custom folder creation */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-1.5">
              <input
                type="text"
                placeholder="新建文件夹名称..."
                value={customFolderInput}
                onChange={e => setCustomFolderInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customFolderInput.trim()) {
                    if (onUpdateTaskFolder) {
                      onUpdateTaskFolder(folderPickerTaskId, customFolderInput.trim());
                    }
                    setCustomFolderInput('');
                    setFolderPickerTaskId(null);
                  }
                }}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none"
              />
              <button
                type="button"
                disabled={!customFolderInput.trim()}
                onClick={() => {
                  if (customFolderInput.trim() && onUpdateTaskFolder) {
                    onUpdateTaskFolder(folderPickerTaskId, customFolderInput.trim());
                    setCustomFolderInput('');
                    setFolderPickerTaskId(null);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal (for Folder View) */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 max-w-xs w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                <FolderPlus className="w-4 h-4 text-indigo-600" />
                <span>新建文件夹分类</span>
              </span>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              autoFocus
              placeholder="请输入分类名 (如: 幼儿园, 签证, 学习...)"
              value={customFolderInput}
              onChange={e => setCustomFolderInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customFolderInput.trim()) {
                  setSelectedFolder(customFolderInput.trim());
                  setShowNewFolderModal(false);
                  setCustomFolderInput('');
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none"
            />

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-2.5 py-1 text-xs text-slate-500"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!customFolderInput.trim()}
                onClick={() => {
                  setSelectedFolder(customFolderInput.trim());
                  setShowNewFolderModal(false);
                  setCustomFolderInput('');
                }}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Area with Recurrence & Due Date Controls */}
      <div className="pt-1.5 mt-auto shrink-0">
        {/* Recurrence & Due Date Options Panel */}
        {showOptionsPanel && (
          <div className="mb-1.5 p-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 rounded-xl text-xs space-y-2 shadow-md animate-in fade-in duration-150">
            {/* Recurrence Type Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1 text-[11px]">
                  <Repeat className="w-3 h-3 text-purple-600" />
                  <span>循环频次</span>
                </span>
                <span className="text-[9px] text-slate-400">
                  {RECURRENCE_OPTIONS.find(o => o.type === selectedRecurrence)?.desc}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {RECURRENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleSelectRecurrence(opt.type)}
                    className={`py-0.5 rounded text-center text-[10px] font-medium transition-all cursor-pointer ${
                      selectedRecurrence === opt.type
                        ? 'bg-purple-600 text-white font-bold shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly Weekday Selector */}
            {selectedRecurrence === 'weekly' && (
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                    每周执行时间（选择星期几）
                  </label>
                  <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-1 py-0.2 rounded">
                    {getRecurrenceLabel('weekly', selectedWeekdays)}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAY_OPTIONS.map(opt => {
                    const isSelected = selectedWeekdays.includes(opt.day);
                    return (
                      <button
                        key={opt.day}
                        type="button"
                        onClick={() => toggleSelectedWeekday(opt.day)}
                        className={`py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-purple-600 text-white font-bold shadow-2xs ring-1 ring-purple-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Date + Reminder Days Controls */}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-indigo-500" />
                    <span>截止/目标日期</span>
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        setSelectedDueDate(todayStr);
                        if (selectedAdvanceDays === null) setSelectedAdvanceDays(0);
                      }}
                      className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-[9px] cursor-pointer"
                    >
                      今天
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tom = new Date();
                        tom.setDate(tom.getDate() + 1);
                        setSelectedDueDate(tom.toISOString().split('T')[0]);
                        if (selectedAdvanceDays === null) setSelectedAdvanceDays(1);
                      }}
                      className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-[9px] cursor-pointer"
                    >
                      明天
                    </button>
                    {selectedDueDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDueDate('');
                          setSelectedAdvanceDays(null);
                        }}
                        className="text-[9px] text-rose-500 hover:underline cursor-pointer"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="date"
                  value={selectedDueDate}
                  onChange={e => {
                    setSelectedDueDate(e.target.value);
                    if (e.target.value && selectedAdvanceDays === null) {
                      setSelectedAdvanceDays(0);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs outline-none"
                />
              </div>

              {/* 提醒时间设置 (只要有截止日期或设定了循环，都可以选择提醒时间，比如当天提醒或提前1天提醒) */}
              {(selectedDueDate || selectedRecurrence !== 'none') && (
                <div className="space-y-1 pt-1 border-t border-slate-100/70 dark:border-slate-800/70">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <Bell className="w-3 h-3 text-amber-500" />
                      <span>提醒时间</span>
                    </label>
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                      {selectedAdvanceDays === 0
                        ? '当天提醒'
                        : selectedAdvanceDays === 1
                        ? '提前 1 天提醒'
                        : selectedAdvanceDays !== null
                        ? `提前 ${selectedAdvanceDays} 天提醒`
                        : '仅到期显示'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setSelectedAdvanceDays(0)}
                      className={`flex-1 py-1 rounded text-center text-[10px] font-medium transition-all cursor-pointer ${
                        selectedAdvanceDays === 0
                          ? 'bg-amber-500 text-white font-bold shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      当天提醒
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAdvanceDays(1)}
                      className={`flex-1 py-1 rounded text-center text-[10px] font-medium transition-all cursor-pointer ${
                        selectedAdvanceDays === 1
                          ? 'bg-amber-500 text-white font-bold shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      提前 1 天
                    </button>
                    <select
                      value={selectedAdvanceDays === null ? 'null' : selectedAdvanceDays}
                      onChange={e => {
                        const val = e.target.value;
                        setSelectedAdvanceDays(val === 'null' ? null : Number(val));
                      }}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px] outline-none"
                    >
                      {REMINDER_OPTIONS.map(opt => (
                        <option key={String(opt.value)} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Folder selection for new task */}
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">归入文件夹：</span>
              <div className="flex items-center space-x-1">
                <select
                  value={selectedFolder}
                  onChange={e => setSelectedFolder(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] outline-none"
                >
                  <option value="">默认待办 (无分类)</option>
                  {allKnownFolders.map(f => (
                    <option key={f} value={f}>
                      📁 {f}
                    </option>
                  ))}
                </select>
                {selectedFolder && (
                  <button
                    type="button"
                    onClick={() => setSelectedFolder('')}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Folder tag chip if selected */}
        {selectedFolder && !showOptionsPanel && (
          <div className="mb-1 flex items-center space-x-1 text-[10px] text-indigo-600 dark:text-indigo-400 px-1">
            <span>将存入文件夹：</span>
            <span className="font-bold bg-indigo-50 dark:bg-indigo-950/70 px-1.5 py-0.2 rounded border border-indigo-200/60">
              📁 {selectedFolder}
            </span>
            <button
              type="button"
              onClick={() => setSelectedFolder('')}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-center space-x-1.5">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-500 transition-all shadow-2xs"
          />

          {/* Quick cycle & date config button */}
          <button
            type="button"
            onClick={() => setShowOptionsPanel(!showOptionsPanel)}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              selectedRecurrence !== 'none' || selectedDueDate || selectedFolder
                ? 'bg-purple-50 dark:bg-purple-950 border-purple-300 text-purple-600 dark:text-purple-400 font-bold shadow-2xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-purple-600 hover:border-purple-300'
            }`}
            title="设置循环、截止日期或指定文件夹"
          >
            {selectedRecurrence !== 'none' ? (
              <Repeat className="w-3.5 h-3.5 stroke-[2.2]" />
            ) : selectedFolder ? (
              <Folder className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <Calendar className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Quadrant Add Button */}
          <button
            type="button"
            onClick={handleSubmit}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white ${buttonBg} shadow-2xs hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0`}
            title="添加任务"
          >
            <Plus className="w-4 h-4 stroke-[2.4]" />
          </button>
        </div>
      </div>
    </div>
  );
};
