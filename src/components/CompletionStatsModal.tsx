import React, { useState, useMemo } from 'react';
import {
  X,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Repeat,
} from 'lucide-react';
import { Task, DayCompletionStat, QuadrantId } from '../types';
import { QUADRANT_METAS } from '../utils/constants';
import { getRecurrenceLabel } from '../utils/recurrence';

interface CompletionStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onReopenTask: (taskId: string) => void;
}

export const CompletionStatsModal: React.FC<CompletionStatsModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onReopenTask,
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);

  // Group completed tasks by YYYY-MM-DD
  const dailyStats = useMemo(() => {
    const map = new Map<string, Task[]>();

    // Calculate dates range
    const result: DayCompletionStat[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      const dayLabel = `${month}/${day}`;

      map.set(dateStr, []);
      result.push({
        dateStr,
        dayLabel,
        count: 0,
        tasks: [],
      });
    }

    // Populate completed tasks
    tasks.forEach(t => {
      if (t.completed && t.completedAt) {
        const d = new Date(t.completedAt);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (map.has(dateStr)) {
          map.get(dateStr)!.push(t);
        }
      }
    });

    result.forEach(item => {
      const dayTasks = map.get(item.dateStr) || [];
      item.count = dayTasks.length;
      item.tasks = dayTasks;
    });

    return result;
  }, [tasks, rangeDays]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Selected date defaults to today or the latest day with completions
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const selectedDayStat = useMemo(() => {
    return dailyStats.find(s => s.dateStr === selectedDate) || {
      dateStr: selectedDate,
      dayLabel: selectedDate,
      count: 0,
      tasks: [],
    };
  }, [dailyStats, selectedDate]);

  if (!isOpen) return null;

  const totalCompleted = tasks.filter(t => t.completed).length;
  const maxCount = Math.max(1, ...dailyStats.map(s => s.count));
  const todayCount = dailyStats.find(s => s.dateStr === todayStr)?.count || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                每日完成任务统计与复盘
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                查看每天办结数量，点击柱状图查看当日完成的具体任务
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-center">
              <span className="text-xs text-slate-400">历史总完成</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {totalCompleted} <span className="text-xs font-normal text-slate-400">项</span>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-center">
              <span className="text-xs text-emerald-700 dark:text-emerald-400">今日完成</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300 mt-0.5">
                {todayCount} <span className="text-xs font-normal text-emerald-500">项</span>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 text-center">
              <span className="text-xs text-indigo-700 dark:text-indigo-400">周期完成总计</span>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-300 mt-0.5">
                {dailyStats.reduce((sum, d) => sum + d.count, 0)}{' '}
                <span className="text-xs font-normal text-indigo-400">项</span>
              </p>
            </div>
          </div>

          {/* Time range switcher */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              <span>办结趋势柱状图</span>
            </span>

            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
              <button
                onClick={() => setRangeDays(7)}
                className={`px-2 py-0.5 rounded ${rangeDays === 7 ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-2xs' : ''}`}
              >
                7天
              </button>
              <button
                onClick={() => setRangeDays(14)}
                className={`px-2 py-0.5 rounded ${rangeDays === 14 ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-2xs' : ''}`}
              >
                14天
              </button>
              <button
                onClick={() => setRangeDays(30)}
                className={`px-2 py-0.5 rounded ${rangeDays === 30 ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-2xs' : ''}`}
              >
                30天
              </button>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
            <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 pt-6 pb-2 px-1">
              {dailyStats.map(stat => {
                const isSelected = stat.dateStr === selectedDate;
                const isToday = stat.dateStr === todayStr;
                const heightPercent = stat.count > 0 ? Math.max(12, Math.round((stat.count / maxCount) * 100)) : 4;

                return (
                  <button
                    key={stat.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(stat.dateStr)}
                    className="flex-1 flex flex-col items-center justify-end h-full group focus:outline-none cursor-pointer"
                  >
                    {/* Count label above bar */}
                    <span
                      className={`text-[10px] font-semibold mb-1 transition-opacity ${
                        stat.count > 0
                          ? isSelected
                            ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'text-slate-500'
                          : 'opacity-0 group-hover:opacity-100 text-slate-300'
                      }`}
                    >
                      {stat.count}
                    </span>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-t from-indigo-600 to-indigo-500 shadow-sm ring-2 ring-indigo-400/50'
                          : isToday
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : stat.count > 0
                          ? 'bg-indigo-300 dark:bg-indigo-700/60 hover:bg-indigo-400'
                          : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
                      }`}
                    />

                    {/* Day label */}
                    <span
                      className={`text-[10px] mt-1.5 truncate max-w-full ${
                        isSelected
                          ? 'font-bold text-indigo-600 dark:text-indigo-400'
                          : isToday
                          ? 'font-bold text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {isToday ? '今天' : stat.dayLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Task Detail List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  {selectedDate === todayStr ? '今天' : selectedDate} 办结任务清单
                </h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">
                  共 {selectedDayStat.tasks.length} 项
                </span>
              </div>
            </div>

            {selectedDayStat.tasks.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700/60">
                <p className="text-xs text-slate-400">
                  该日未记录已完成的任务
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  点击上方柱状图中其他有数值的日期查看
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedDayStat.tasks.map(task => {
                  const qMeta = QUADRANT_METAS[task.quadrant];
                  const timeStr = task.completedAt
                    ? new Date(task.completedAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 text-xs"
                    >
                      <div className="flex items-center space-x-2.5 flex-1 min-w-0 mr-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Quadrant badge */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${qMeta.badgeBg} ${qMeta.badgeText}`}
                        >
                          {qMeta.title.slice(0, 4)}
                        </span>

                        {/* Recurrence badge */}
                        {task.recurrence && task.recurrence !== 'none' && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                            <Repeat className="w-2.5 h-2.5" />
                            <span>{getRecurrenceLabel(task.recurrence)}打卡</span>
                          </span>
                        )}

                        {timeStr && (
                          <span className="text-[10px] text-slate-400 flex items-center space-x-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{timeStr}</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => onReopenTask(task.id)}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="恢复为未完成"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
