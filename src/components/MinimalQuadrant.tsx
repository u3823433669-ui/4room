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

const ADVANCE_DAYS_OPTIONS = [
  { value: 0, label: '当天才显示' },
  { value: 1, label: '提前 1 天' },
  { value: 3, label: '提前 3 天' },
  { value: 7, label: '提前 7 天' },
  { value: 15, label: '提前 15 天 (生日推荐)' },
  { value: 30, label: '提前 30 天' },
  { value: null, label: '始终显示 (不隐藏)' },
];

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

  const openRecurrenceEditor = (task: Task) => {
    setEditingRecurrenceTaskId(task.id);
    const rec = task.recurrence || 'none';
    setTempRecurrence(rec);
    setTempAdvanceDays(task.advanceDays ?? getDefaultAdvanceDays(task.recurrence));
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
                        onClick={() => openRecurrenceEditor(task)}
                        className="inline-flex items-center space-x-0.5 text-[9px] px-1 py-0.2 rounded bg-purple-100/90 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold cursor-pointer"
                        title="循环任务"
                      >
                        <Repeat className="w-2.5 h-2.5" />
                        <span>{getRecurrenceLabel(task.recurrence, task.weekdays)}</span>
                      </span>
                    )}

                    {shouldShowDueBadge && (
                      <span
                        className={`inline-flex items-center space-x-0.5 text-[9px] px-1 py-0.2 rounded font-medium ${
                          dueStatus.isOverdue
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-300'
                        }`}
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
                                <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                                  {getRecurrenceLabel(task.recurrence)}
                                </span>
                              )}

                              {task.dueDate && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {dueStatus.text}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                          onClick={() => openRecurrenceEditor(task)}
                          className="inline-flex items-center space-x-0.5 text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 hover:bg-purple-100 transition-colors cursor-pointer"
                          title="点击修改循环周期及提前展示规则"
                        >
                          <Repeat className="w-2.5 h-2.5" />
                          <span>
                            {getRecurrenceLabel(task.recurrence, task.weekdays)}
                            {task.advanceDays !== null && task.advanceDays !== undefined
                              ? task.advanceDays === 0
                                ? '·当天'
                                : `·提前${task.advanceDays}天`
                              : ''}
                          </span>
                        </button>
                      )}

                      {/* Due Date & Auto-escalation Badge */}
                      {shouldShowDueBadge && (
                        <span
                          onClick={() =>
                            setChangingDateTaskId(
                              changingDateTaskId === task.id ? null : task.id
                            )
                          }
                          className={`inline-flex items-center space-x-1 text-[9px] px-1.5 py-0.2 rounded font-medium cursor-pointer transition-colors ${
                            dueStatus.isOverdue
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 animate-pulse'
                              : dueStatus.isUrgent
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                          title="点击修改或清除截止时间"
                        >
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{dueStatus.text}</span>
                          {task.autoEscalatedFrom && !isRecurring && (
                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 ml-0.5">
                              (临期转入)
                            </span>
                          )}
                        </span>
                      )}

                      {/* Date picker edit overlay */}
                      {changingDateTaskId === task.id && (
                        <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-slate-300 shadow-sm text-xs">
                          <input
                            type="date"
                            defaultValue={task.dueDate || ''}
                            onChange={e => {
                              onUpdateTaskDueDate(task.id, e.target.value || null);
                              setChangingDateTaskId(null);
                            }}
                            className="bg-transparent text-slate-700 dark:text-slate-200 text-xs outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateTaskDueDate(task.id, null);
                              setChangingDateTaskId(null);
                            }}
                            className="text-[10px] text-slate-400 hover:text-rose-500 px-1 cursor-pointer"
                          >
                            清除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover actions: Folder + Recurrence + Date + Delete + Drag */}
                  <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      onClick={() => openRecurrenceEditor(task)}
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

      {/* Recurrence Editor Modal */}
      {editingRecurrenceTaskId && (
        <div className="mb-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-purple-400/80 shadow-lg text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-700">
            <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1">
              <Repeat className="w-3 h-3 text-purple-600" />
              <span>修改循环规则</span>
            </span>
            <button
              type="button"
              onClick={() => setEditingRecurrenceTaskId(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div>
            <div className="grid grid-cols-5 gap-1">
              {RECURRENCE_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setTempRecurrence(opt.type);
                    if (opt.type !== 'none') {
                      setTempAdvanceDays(getDefaultAdvanceDays(opt.type));
                      if (opt.type === 'weekly') {
                        const initialDays = tempWeekdays.length > 0 ? tempWeekdays : [new Date().getDay()];
                        setTempWeekdays(initialDays);
                        setTempDueDate(getNextOccurrenceForWeekdays(initialDays));
                      }
                    } else {
                      setTempAdvanceDays(null);
                    }
                  }}
                  className={`py-0.5 rounded text-center text-[10px] font-medium transition-colors cursor-pointer ${
                    tempRecurrence === opt.type
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {tempRecurrence !== 'none' && tempRecurrence === 'weekly' && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                选择星期几重复
              </label>
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
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-1.5 pt-1 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setEditingRecurrenceTaskId(null)}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => saveRecurrenceEditor(editingRecurrenceTaskId)}
              className="px-2.5 py-0.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
            >
              保存
            </button>
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

            {/* Date + Advance Days */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-0.5">
                  截止/目标日期
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="date"
                    value={selectedDueDate}
                    onChange={e => setSelectedDueDate(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] outline-none"
                  />
                  {selectedDueDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDueDate('')}
                      className="text-[9px] text-slate-400 hover:text-slate-600"
                    >
                      清
                    </button>
                  )}
                </div>
              </div>

              {selectedRecurrence !== 'none' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-0.5">
                    提前展示窗口
                  </label>
                  <select
                    value={selectedAdvanceDays === null ? 'null' : selectedAdvanceDays}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedAdvanceDays(val === 'null' ? null : Number(val));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] outline-none"
                  >
                    {ADVANCE_DAYS_OPTIONS.map(opt => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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
