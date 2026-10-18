import React, { useState } from 'react';
import { Plus, Trash2, Check, GripVertical, Calendar, AlertCircle } from 'lucide-react';
import { QuadrantId, Task } from '../types';
import { sound } from '../utils/sound';
import { getDueDateStatus } from '../utils/escalation';

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
  onAddTask: (title: string, quadrant: QuadrantId, dueDate?: string | null) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskTitle: (id: string, newTitle: string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onDropTask: (taskId: string, targetQuadrant: QuadrantId) => void;
}

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
  onDropTask,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedDueDate, setSelectedDueDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const [isDragOver, setIsDragOver] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [changingDateTaskId, setChangingDateTaskId] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    onAddTask(inputValue.trim(), id, selectedDueDate || null);
    setInputValue('');
    setSelectedDueDate('');
    setShowDatePicker(false);
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

  const visibleTasks = hideCompleted ? tasks.filter(t => !t.completed) : tasks;
  const count = tasks.filter(t => !t.completed).length;

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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-[400px] sm:h-[430px] rounded-2xl border p-4 transition-all duration-200 ${cardBg} ${borderColor} ${
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
        </div>

        {/* Right strategy tag */}
        <span className={`text-xs font-medium ${strategyColor}`}>
          {strategy}
        </span>
      </div>

      {/* Task List (scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-2.5 py-1 pr-0.5">
        {visibleTasks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic select-none">
            {isDragOver ? '放置任务到此象限' : '暂无任务，可在下方快速添加'}
          </div>
        ) : (
          visibleTasks.map(task => {
            const dueStatus = getDueDateStatus(task.dueDate);

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
                  {/* Square outline checkbox matching screenshot */}
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
                        {task.autoEscalatedFrom && (
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
                          className="text-[10px] text-slate-400 hover:text-rose-500 px-1"
                        >
                          清除
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hover actions: Date set + Drag handle + delete */}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!task.dueDate && (
                    <button
                      type="button"
                      onClick={() => setChangingDateTaskId(task.id)}
                      className="p-1 text-slate-300 hover:text-indigo-600 transition-colors"
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
      </div>

      {/* Bottom Input Area matching screenshot with optional Due Date */}
      <div className="pt-3 mt-1">
        {/* Optional Date Picker Row if open */}
        {showDatePicker && (
          <div className="mb-2 flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 animate-in fade-in duration-150">
            <div className="flex items-center space-x-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>设置完成截止日:</span>
              <input
                type="date"
                value={selectedDueDate}
                onChange={e => setSelectedDueDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs outline-none"
              />
            </div>
            {selectedDueDate && (
              <button
                type="button"
                onClick={() => setSelectedDueDate('')}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                清空
              </button>
            )}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700 transition-all shadow-2xs"
          />

          {/* Quick optional date button */}
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              selectedDueDate
                ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-300 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-300'
            }`}
            title={selectedDueDate ? `已设日期: ${selectedDueDate}` : '设置截止时间（可选）'}
          >
            <Calendar className="w-4 h-4" />
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
