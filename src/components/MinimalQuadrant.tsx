import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Check,
  GripVertical,
  Calendar,
  Repeat,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Eye,
  Settings2,
} from 'lucide-react';
import { QuadrantId, Task, RecurrenceType } from '../types';
import { sound } from '../utils/sound';
import { getDueDateStatus } from '../utils/escalation';
import {
  isTaskVisibleInMatrix,
  getDaysUntilVisible,
  getRecurrenceLabel,
  getDefaultAdvanceDays,
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
  onAddTask: (
    title: string,
    quadrant: QuadrantId,
    dueDate?: string | null,
    recurrence?: RecurrenceType | null,
    advanceDays?: number | null
  ) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskTitle: (id: string, newTitle: string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onUpdateTaskRecurrence?: (
    id: string,
    recurrence: RecurrenceType | null,
    advanceDays: number | null,
    newDueDate?: string | null
  ) => void;
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
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTaskTitle,
  onUpdateTaskDueDate,
  onUpdateTaskRecurrence,
  onDropTask,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedDueDate, setSelectedDueDate] = useState<string>('');
  const [selectedRecurrence, setSelectedRecurrence] = useState<RecurrenceType>('none');
  const [selectedAdvanceDays, setSelectedAdvanceDays] = useState<number | null>(null);
  const [showOptionsPanel, setShowOptionsPanel] = useState<boolean>(false);

  const [isDragOver, setIsDragOver] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [changingDateTaskId, setChangingDateTaskId] = useState<string | null>(null);
  const [editingRecurrenceTaskId, setEditingRecurrenceTaskId] = useState<string | null>(null);
  const [showHiddenDrawer, setShowHiddenDrawer] = useState<boolean>(false);

  // Recurrence edit temp state for an existing task
  const [tempRecurrence, setTempRecurrence] = useState<RecurrenceType>('none');
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
      if (!selectedDueDate) {
        // For daily, default to today; for others, set a default date
        const todayStr = new Date().toISOString().split('T')[0];
        setSelectedDueDate(todayStr);
      }
    } else {
      setSelectedAdvanceDays(null);
    }
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    onAddTask(
      inputValue.trim(),
      id,
      selectedDueDate || null,
      selectedRecurrence === 'none' ? null : selectedRecurrence,
      selectedAdvanceDays
    );
    setInputValue('');
    setSelectedDueDate('');
    setSelectedRecurrence('none');
    setSelectedAdvanceDays(null);
    setShowOptionsPanel(false);
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

  // Split tasks into visible matrix tasks vs. hidden upcoming recurring tasks
  const matrixTasks = tasks.filter(t => isTaskVisibleInMatrix(t));
  const hiddenRecurringTasks = tasks.filter(t => !t.completed && !isTaskVisibleInMatrix(t));

  const visibleTasks = hideCompleted ? matrixTasks.filter(t => !t.completed) : matrixTasks;
  const count = matrixTasks.filter(t => !t.completed).length;

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
    setTempRecurrence(task.recurrence || 'none');
    setTempAdvanceDays(task.advanceDays ?? getDefaultAdvanceDays(task.recurrence));
    setTempDueDate(task.dueDate || new Date().toISOString().split('T')[0]);
  };

  const saveRecurrenceEditor = (taskId: string) => {
    if (onUpdateTaskRecurrence) {
      onUpdateTaskRecurrence(
        taskId,
        tempRecurrence === 'none' ? null : tempRecurrence,
        tempAdvanceDays,
        tempDueDate || null
      );
    }
    setEditingRecurrenceTaskId(null);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-[440px] sm:h-[480px] rounded-2xl border p-4 transition-all duration-200 ${cardBg} ${borderColor} ${
        isDragOver ? 'ring-2 ring-indigo-400 bg-indigo-50/20 shadow-md' : 'shadow-2xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 select-none">
        <div className="flex items-center space-x-2">
          {/* Dot */}
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {title}
          </h3>
          {/* Counter pill */}
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeBg} ${badgeText}`}
          >
            {count}
          </span>

          {/* Hidden tasks quick count indicator */}
          {hiddenRecurringTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHiddenDrawer(!showHiddenDrawer)}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100/80 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 flex items-center space-x-1 cursor-pointer hover:bg-purple-200/80 transition-colors"
              title="点击查看未到提前展示期的循环任务"
            >
              <Repeat className="w-2.5 h-2.5" />
              <span>{hiddenRecurringTasks.length}个未到期</span>
            </button>
          )}
        </div>

        {/* Right strategy tag */}
        <span className={`text-xs font-medium ${strategyColor}`}>
          {strategy}
        </span>
      </div>

      {/* Task List (scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-2.5 py-1 pr-0.5">
        {visibleTasks.length === 0 && hiddenRecurringTasks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic select-none">
            {isDragOver ? '放置任务到此象限' : '暂无任务，可在下方快速添加'}
          </div>
        ) : visibleTasks.length === 0 && hiddenRecurringTasks.length > 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 dark:text-slate-500 text-center space-y-1 select-none p-4">
            <Repeat className="w-6 h-6 text-purple-400 dark:text-purple-500 animate-spin-slow mb-1" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              当前无待处理任务
            </p>
            <p className="text-[11px] text-slate-400">
              有 {hiddenRecurringTasks.length} 个周期任务尚未到达展示时间（如生日提前15天自动显示）
            </p>
            <button
              type="button"
              onClick={() => setShowHiddenDrawer(true)}
              className="text-xs text-purple-600 dark:text-purple-400 font-semibold underline mt-2 cursor-pointer"
            >
              展开查看未到期周期任务
            </button>
          </div>
        ) : (
          visibleTasks.map(task => {
            const dueStatus = getDueDateStatus(task.dueDate);
            const isRecurring = task.recurrence && task.recurrence !== 'none';

            return (
              <div
                key={task.id}
                draggable={true}
                onDragStart={e => handleDragStart(e, task)}
                className={`group flex items-center justify-between bg-white dark:bg-slate-800/90 rounded-xl px-3.5 py-3 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs transition-all hover:shadow-xs hover:border-slate-300 dark:hover:border-slate-600 ${
                  task.completed ? 'opacity-60 bg-slate-50/60 dark:bg-slate-800/40' : ''
                }`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0 mr-2">
                  {/* Square outline checkbox */}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleTask(task.id);
                      if (!task.completed) {
                        sound.playComplete();
                      } else {
                        sound.playPop();
                      }
                    }}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                      task.completed
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-500 hover:border-indigo-500 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  {/* Task Title (Editable) */}
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
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
                        className="flex-1 text-xs sm:text-sm bg-transparent border-b border-indigo-500 outline-none text-slate-800 dark:text-slate-100 py-0.5"
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(task)}
                        className={`text-xs sm:text-sm leading-snug break-words cursor-text select-text ${
                          task.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    )}

                    {/* Recurrence Badge */}
                    {isRecurring && (
                      <button
                        type="button"
                        onClick={() => openRecurrenceEditor(task)}
                        className="inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 hover:bg-purple-100 transition-colors cursor-pointer"
                        title="点击修改循环周期及提前展示规则"
                      >
                        <Repeat className="w-2.5 h-2.5" />
                        <span>
                          {getRecurrenceLabel(task.recurrence)}
                          {task.advanceDays !== null && task.advanceDays !== undefined
                            ? task.advanceDays === 0
                              ? '·当天'
                              : `·提前${task.advanceDays}天`
                            : ''}
                        </span>
                      </button>
                    )}

                    {/* Due Date & Auto-escalation Badge */}
                    {task.dueDate && (
                      <span
                        onClick={() =>
                          setChangingDateTaskId(
                            changingDateTaskId === task.id ? null : task.id
                          )
                        }
                        className={`inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
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
                      <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-300 shadow-sm text-xs">
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

                {/* Hover actions: Recurrence set + Date set + Drag handle + delete */}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openRecurrenceEditor(task)}
                    className="p-1 text-slate-300 hover:text-purple-600 transition-colors cursor-pointer"
                    title="设置循环与提前展示规则"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                  {!task.dueDate && (
                    <button
                      type="button"
                      onClick={() => setChangingDateTaskId(task.id)}
                      className="p-1 text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="设置到期时间"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div
                    className="text-slate-300 cursor-grab active:cursor-grabbing p-0.5"
                    title="拖拽移动"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Collapsible Hidden Upcoming Recurring Tasks Drawer */}
        {hiddenRecurringTasks.length > 0 && (
          <div className="mt-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowHiddenDrawer(!showHiddenDrawer)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  未到期周期任务（{hiddenRecurringTasks.length} 个静默隐藏中）
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] font-normal">
                <span>{showHiddenDrawer ? '收起' : '展开查看'}</span>
                {showHiddenDrawer ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {showHiddenDrawer && (
              <div className="mt-2 space-y-2 p-2 rounded-xl bg-purple-50/30 dark:bg-purple-950/20 border border-purple-200/40 dark:border-purple-900/30">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 px-1">
                  这些任务已按设定的规则隐藏，将在距到期日设定天数时自动浮现：
                </p>
                {hiddenRecurringTasks.map(task => {
                  const daysUntil = getDaysUntilVisible(task);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-purple-200/60 dark:border-purple-800/50 text-xs"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {task.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/70 text-purple-700 dark:text-purple-300 font-semibold">
                            {getRecurrenceLabel(task.recurrence)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                          到期日: {task.dueDate} · 还有 <strong className="text-purple-600 dark:text-purple-400 font-bold">{daysUntil}</strong> 天进入显示期（提前{task.advanceDays ?? 0}天展示）
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Quick force show */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateTaskRecurrence) {
                              // Setting advanceDays to null allows it to show immediately
                              onUpdateTaskRecurrence(task.id, task.recurrence || null, null, task.dueDate);
                            }
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
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
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1 text-slate-400 hover:text-rose-500"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Inline Recurrence Modal / Editor for existing task */}
      {editingRecurrenceTaskId && (
        <div className="mb-2 p-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-purple-400/80 shadow-lg text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-700">
            <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
              <Repeat className="w-3.5 h-3.5 text-purple-600" />
              <span>修改循环与展示规则</span>
            </span>
            <button
              type="button"
              onClick={() => setEditingRecurrenceTaskId(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              循环频次
            </label>
            <div className="grid grid-cols-5 gap-1">
              {RECURRENCE_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setTempRecurrence(opt.type);
                    if (opt.type !== 'none') {
                      setTempAdvanceDays(getDefaultAdvanceDays(opt.type));
                    } else {
                      setTempAdvanceDays(null);
                    }
                  }}
                  className={`py-1 rounded text-center font-medium transition-colors cursor-pointer ${
                    tempRecurrence === opt.type
                      ? 'bg-purple-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {tempRecurrence !== 'none' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  周期基准日期 / 生日到期日
                </label>
                <input
                  type="date"
                  value={tempDueDate}
                  onChange={e => setTempDueDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  提前展示窗口（距离日期还有多少天时显示出来）
                </label>
                <div className="flex flex-wrap gap-1">
                  {ADVANCE_DAYS_OPTIONS.map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setTempAdvanceDays(opt.value)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        tempAdvanceDays === opt.value
                          ? 'bg-purple-600 text-white font-bold'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setEditingRecurrenceTaskId(null)}
              className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => saveRecurrenceEditor(editingRecurrenceTaskId)}
              className="px-3.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs cursor-pointer"
            >
              保存设置
            </button>
          </div>
        </div>
      )}

      {/* Bottom Input Area with Recurrence & Due Date Controls */}
      <div className="pt-3 mt-1">
        {/* Recurrence & Due Date Options Panel */}
        {showOptionsPanel && (
          <div className="mb-2 p-3 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 rounded-xl text-xs space-y-2.5 shadow-md animate-in fade-in duration-150">
            {/* Recurrence Type Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                  <Repeat className="w-3.5 h-3.5 text-purple-600" />
                  <span>循环频次</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {RECURRENCE_OPTIONS.find(o => o.type === selectedRecurrence)?.desc}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {RECURRENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleSelectRecurrence(opt.type)}
                    className={`py-1 rounded text-center font-medium transition-all cursor-pointer ${
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

            {/* If recurring or user wants due date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {selectedRecurrence === 'yearly'
                    ? '每年生日/纪念日日期'
                    : '截止/目标完成日'}
                </label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="date"
                    value={selectedDueDate}
                    onChange={e => setSelectedDueDate(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs outline-none"
                  />
                  {selectedDueDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDueDate('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      清空
                    </button>
                  )}
                </div>
              </div>

              {selectedRecurrence !== 'none' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    提前展示窗口
                  </label>
                  <select
                    value={selectedAdvanceDays === null ? 'null' : selectedAdvanceDays}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedAdvanceDays(val === 'null' ? null : Number(val));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs outline-none font-medium text-slate-700 dark:text-slate-200"
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

            {/* Helpful explanation badge based on selection */}
            {selectedRecurrence === 'yearly' && (
              <div className="bg-purple-50 dark:bg-purple-950/50 p-2 rounded-lg text-[11px] text-purple-700 dark:text-purple-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  每年生日/纪念日：距离该日期还有{' '}
                  <strong>{selectedAdvanceDays ?? 15} 天</strong> 时自动呈现，其余时间静默隐藏。
                </span>
              </div>
            )}
            {selectedRecurrence === 'daily' && (
              <div className="bg-purple-50 dark:bg-purple-950/50 p-2 rounded-lg text-[11px] text-purple-700 dark:text-purple-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  每日打卡任务：今天完成后计入今日统计，次日凌晨自动刷新恢复待办。
                </span>
              </div>
            )}
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700 transition-all shadow-2xs"
          />

          {/* Quick cycle & date config button */}
          <button
            type="button"
            onClick={() => setShowOptionsPanel(!showOptionsPanel)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              selectedRecurrence !== 'none' || selectedDueDate
                ? 'bg-purple-50 dark:bg-purple-950 border-purple-300 text-purple-600 dark:text-purple-400 font-bold shadow-2xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-purple-600 hover:border-purple-300'
            }`}
            title={
              selectedRecurrence !== 'none'
                ? `已设循环: ${getRecurrenceLabel(selectedRecurrence)} (提前${selectedAdvanceDays ?? 0}天)`
                : selectedDueDate
                ? `已设日期: ${selectedDueDate}`
                : '设置循环与截止日期'
            }
          >
            {selectedRecurrence !== 'none' ? (
              <Repeat className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
          </button>

          {/* Quadrant Add Button */}
          <button
            type="button"
            onClick={handleSubmit}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${buttonBg} shadow-2xs hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0`}
            title="添加任务"
          >
            <Plus className="w-5 h-5 stroke-[2.4]" />
          </button>
        </div>
      </div>
    </div>
  );
};
