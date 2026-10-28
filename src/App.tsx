import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutGrid,
  Eye,
  EyeOff,
  Moon,
  Sun,
  BarChart3,
  Timer,
  User as UserIcon,
  LogOut,
  Zap,
  Sparkles,
  List,
  StickyNote,
  Folder,
  Bell,
  Database,
  FolderSync,
  Download,
} from 'lucide-react';
import { Task, QuadrantId, AuthState, User, RecurrenceType, CountdownItem, QuadrantViewMode } from './types';
import {
  loadLocalTasks,
  saveLocalTasks,
  getStoredAuth,
  saveStoredAuth,
  clearStoredAuth,
  fetchCloudTasks,
  syncTasksToCloud,
  deleteCloudTask,
  loadLocalCountdowns,
  saveLocalCountdowns,
  fetchCloudCountdowns,
  syncCountdownsToCloud,
  isUserCustomTasks,
  mergeTaskLists,
  exportBackupJson,
  saveLocalSnapshot,
} from './utils/storage';
import { checkAndEscalateTasks } from './utils/escalation';
import { computeNextDueDate } from './utils/recurrence';
import { calculateCountdownStats, formatPercent } from './utils/countdown';
import { MinimalQuadrant } from './components/MinimalQuadrant';
import { CompletionStatsModal } from './components/CompletionStatsModal';
import { CountdownModal } from './components/CountdownModal';
import { AuthModal } from './components/AuthModal';
import { DataRecoveryModal } from './components/DataRecoveryModal';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>(() => getStoredAuth());
  const [tasks, setTasks] = useState<Task[]>(() => {
    const initial = loadLocalTasks(authState.user?.username);
    return checkAndEscalateTasks(initial).tasks;
  });

  // Requirement 1: Persist hide completed tasks state across page refreshes
  const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
    return localStorage.getItem('focus_matrix_hide_completed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('focus_matrix_hide_completed', String(hideCompleted));
  }, [hideCompleted]);

  // Requirement 2: Dedicated countdown & milestone progress tracker
  const [countdowns, setCountdowns] = useState<CountdownItem[]>(() =>
    loadLocalCountdowns(authState.user?.username)
  );
  const [isCountdownModalOpen, setIsCountdownModalOpen] = useState<boolean>(false);

  // Global view mode: 'list' | 'sticker' | 'folder'
  const [globalViewMode, setGlobalViewMode] = useState<QuadrantViewMode>(() => {
    return (localStorage.getItem('focus_matrix_view_mode') as QuadrantViewMode) || 'list';
  });

  useEffect(() => {
    localStorage.setItem('focus_matrix_view_mode', globalViewMode);
  }, [globalViewMode]);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('focus_matrix_theme') === 'dark';
  });

  const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState<boolean>(false);
  const [unmergedGuestTasks, setUnmergedGuestTasks] = useState<Task[] | null>(null);
  const [dismissedGuestAlert, setDismissedGuestAlert] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);
  const [escalatedAlert, setEscalatedAlert] = useState<string | null>(null);
  const [cycleToast, setCycleToast] = useState<string | null>(null);

  // Check if there are unmerged guest tasks stored in localStorage
  useEffect(() => {
    if (authState.user) {
      try {
        const raw = localStorage.getItem('focus_matrix_local_tasks');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const currentTitles = new Set(tasks.map(t => `${t.quadrant}_${t.title.trim().toLowerCase()}`));
            const missing = parsed.filter(
              t => !currentTitles.has(`${t.quadrant}_${t.title.trim().toLowerCase()}`)
            );
            if (missing.length > 0 && isUserCustomTasks(parsed)) {
              setUnmergedGuestTasks(missing);
            } else {
              setUnmergedGuestTasks(null);
            }
          }
        }
      } catch {
        // ignore
      }
    } else {
      setUnmergedGuestTasks(null);
    }
  }, [authState.user, tasks]);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('focus_matrix_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('focus_matrix_theme', 'light');
    }
  }, [isDarkMode]);

  // Pull cloud tasks and countdowns when user logs in or mounts
  useEffect(() => {
    async function loadCloud() {
      if (authState.token && authState.user) {
        const cloudTasks = await fetchCloudTasks(authState.token);
        if (cloudTasks !== null) {
          // If server has tasks, check if on-screen tasks contain user custom tasks not yet on server
          setTasks(current => {
            let finalizedTasks = cloudTasks;
            if (isUserCustomTasks(current)) {
              finalizedTasks = mergeTaskLists(cloudTasks, current);
            }
            const { tasks: escalated } = checkAndEscalateTasks(finalizedTasks);
            saveLocalTasks(escalated, authState.user!.username);
            return escalated;
          });
        }
        const cloudCountdowns = await fetchCloudCountdowns(authState.token);
        if (cloudCountdowns !== null) {
          setCountdowns(cloudCountdowns);
          saveLocalCountdowns(cloudCountdowns, authState.user.username);
        }
      }
    }
    loadCloud();
  }, [authState.token, authState.user]);

  // Periodic deadline escalation check (<= 2 days rule)
  useEffect(() => {
    const runEscalation = () => {
      setTasks(current => {
        const { tasks: updated, changedCount } = checkAndEscalateTasks(current);
        if (changedCount > 0) {
          syncTasksToCloud(updated, authState.token, authState.user?.username);
          setEscalatedAlert(`已自动将 ${changedCount} 个临期任务（2天内到期）转入紧急象限`);
          setTimeout(() => setEscalatedAlert(null), 4000);
          return updated;
        }
        return current;
      });
    };

    runEscalation();
    const interval = setInterval(runEscalation, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authState.token, authState.user]);

  // Update countdowns helper with cloud sync
  const updateCountdowns = (updater: (prev: CountdownItem[]) => CountdownItem[]) => {
    setCountdowns(prev => {
      const next = updater(prev);
      syncCountdownsToCloud(
        next,
        authState.token,
        authState.user?.username,
        merged => setCountdowns(merged)
      );
      return next;
    });
  };

  const handleSaveCountdown = (item: CountdownItem) => {
    updateCountdowns(prev => {
      const index = prev.findIndex(c => c.id === item.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = item;
        return copy;
      }
      return [item, ...prev];
    });
  };

  const handleDeleteCountdown = (id: string) => {
    updateCountdowns(prev => prev.filter(c => c.id !== id));
  };

  const handleToggleMilestone = (countdownId: string, milestoneId: string) => {
    updateCountdowns(prev =>
      prev.map(c => {
        if (c.id !== countdownId || !c.milestones) return c;
        return {
          ...c,
          milestones: c.milestones.map(m =>
            m.id === milestoneId ? { ...m, completed: !m.completed } : m
          ),
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleAddMilestone = (countdownId: string, milestoneTitle: string) => {
    updateCountdowns(prev =>
      prev.map(c => {
        if (c.id !== countdownId) return c;
        const currentMilestones = c.milestones || [];
        return {
          ...c,
          milestones: [
            ...currentMilestones,
            {
              id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              title: milestoneTitle,
              completed: false,
            },
          ],
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleTogglePin = (id: string) => {
    updateCountdowns(prev =>
      prev.map(c => (c.id === id ? { ...c, isPinned: !c.isPinned, updatedAt: Date.now() } : c))
    );
  };

  const handleToggleShowOnHome = (id: string) => {
    updateCountdowns(prev => {
      const current = prev.find(c => c.id === id);
      const willBeActive = !current?.showOnHome;
      return prev.map(c => ({
        ...c,
        showOnHome: c.id === id ? willBeActive : false,
        updatedAt: Date.now(),
      }));
    });
  };

  // Update tasks helper with auto-escalation check and cloud sync
  const updateTasks = (updater: (prev: Task[]) => Task[]) => {
    setTasks(prev => {
      const rawNext = updater(prev);
      const { tasks: finalized } = checkAndEscalateTasks(rawNext);
      syncTasksToCloud(
        finalized,
        authState.token,
        authState.user?.username,
        merged => setTasks(merged)
      );
      return finalized;
    });
  };

  // Auth success
  const handleAuthSuccess = async (token: string, user: User) => {
    saveStoredAuth(token, user);
    setAuthState({ token, user });

    // Fetch user cloud tasks
    const cloudTasks = await fetchCloudTasks(token);
    const hasServerTasks = cloudTasks && cloudTasks.length > 0;
    const currentHasCustom = isUserCustomTasks(tasks);

    if (hasServerTasks) {
      let finalTasks = cloudTasks;
      // If user had added custom tasks on screen, merge them so they're not lost!
      if (currentHasCustom) {
        finalTasks = mergeTaskLists(cloudTasks, tasks);
        syncTasksToCloud(finalTasks, token, user.username);
      }
      const { tasks: escalated } = checkAndEscalateTasks(finalTasks);
      setTasks(escalated);
      saveLocalTasks(escalated, user.username);
    } else if (tasks.length > 0) {
      // First-time login/register: upload current on-screen tasks to cloud so they aren't lost!
      syncTasksToCloud(tasks, token, user.username);
      saveLocalTasks(tasks, user.username);
    }

    const cloudCountdowns = await fetchCloudCountdowns(token);
    if (cloudCountdowns && cloudCountdowns.length > 0) {
      setCountdowns(cloudCountdowns);
      saveLocalCountdowns(cloudCountdowns, user.username);
    } else if (countdowns.length > 0) {
      syncCountdownsToCloud(countdowns, token, user.username);
      saveLocalCountdowns(countdowns, user.username);
    }
  };

  // Logout with snapshot archiving to guarantee zero data loss
  const handleLogout = () => {
    saveLocalSnapshot(tasks);
    clearStoredAuth();
    setAuthState({ token: null, user: null });
    setShowUserDropdown(false);
    setUnmergedGuestTasks(null);
    setDismissedGuestAlert(false);

    // Reload guest tasks & countdowns
    const guestTasks = loadLocalTasks();
    setTasks(guestTasks);
    const guestCountdowns = loadLocalCountdowns();
    setCountdowns(guestCountdowns);
  };

  // Merge unmerged guest tasks into current account
  const handleMergeGuestTasks = () => {
    if (!unmergedGuestTasks || unmergedGuestTasks.length === 0) return;
    const merged = mergeTaskLists(tasks, unmergedGuestTasks);
    const { tasks: escalated } = checkAndEscalateTasks(merged);
    setTasks(escalated);
    syncTasksToCloud(escalated, authState.token, authState.user?.username);
    setUnmergedGuestTasks(null);
    setDismissedGuestAlert(true);
    setCycleToast(`已成功将 ${unmergedGuestTasks.length} 条未登录本地任务合并至当前账号！`);
    setTimeout(() => setCycleToast(null), 4000);
  };

  // Handler for restoring tasks from Data Recovery modal
  const handleRestoreTasksFromRecovery = (restored: Task[], message: string) => {
    const { tasks: escalated } = checkAndEscalateTasks(restored);
    setTasks(escalated);
    syncTasksToCloud(escalated, authState.token, authState.user?.username);
    setCycleToast(message);
    setTimeout(() => setCycleToast(null), 4000);
  };

  // Add task with optional due date, recurrence, advanceDays, weekdays and folder
  const handleAddTask = (
    title: string,
    quadrant: QuadrantId,
    dueDate?: string | null,
    recurrence?: RecurrenceType | null,
    advanceDays?: number | null,
    weekdays?: number[] | null,
    folder?: string | null
  ) => {
    const now = Date.now();
    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      quadrant,
      completed: false,
      completedAt: null,
      dueDate: dueDate || null,
      recurrence: recurrence || null,
      weekdays: recurrence === 'weekly' ? weekdays || null : null,
      advanceDays: advanceDays !== undefined ? advanceDays : null,
      folder: folder || null,
      createdAt: now,
      updatedAt: now,
    };

    updateTasks(prev => [...prev, newTask]);
  };

  // Update task folder category
  const handleUpdateTaskFolder = (id: string, folder: string | null) => {
    const now = Date.now();
    updateTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, folder: folder || null, updatedAt: now } : t))
    );
  };

  // Toggle complete with recurring task support
  const handleToggleTask = (id: string) => {
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    updateTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;

      // If user is completing a recurring task:
      if (!task.completed && task.recurrence && task.recurrence !== 'none') {
        // 1. Create an archived completed record for today's stats
        const completedRecord: Task = {
          id: `done_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: task.title,
          quadrant: task.quadrant,
          completed: true,
          completedAt: now,
          dueDate: task.dueDate || todayStr,
          recurrence: task.recurrence,
          weekdays: task.weekdays,
          advanceDays: task.advanceDays,
          recurringParentId: task.id,
          createdAt: task.createdAt,
          updatedAt: now,
        };

        // 2. Compute next cycle due date
        const nextDueDate = computeNextDueDate(task.dueDate || todayStr, task.recurrence, task.weekdays);
        const updatedRecurringTask: Task = {
          ...task,
          completed: false,
          completedAt: null,
          dueDate: nextDueDate,
          updatedAt: now,
        };

        const advanceDesc =
          task.advanceDays === 0
            ? '当天刷新呈现'
            : task.advanceDays !== null && task.advanceDays !== undefined
            ? `提前 ${task.advanceDays} 天自动呈现`
            : '已刷新就绪';

        setCycleToast(
          `🎉 "${task.title}" 今日打卡完成并计入统计！下期（${nextDueDate}）${advanceDesc}`
        );
        setTimeout(() => setCycleToast(null), 5000);

        return prev
          .map(t => (t.id === id ? updatedRecurringTask : t))
          .concat(completedRecord);
      }

      // Standard single task toggle
      return prev.map(t => {
        if (t.id === id) {
          const next = !t.completed;
          return {
            ...t,
            completed: next,
            completedAt: next ? now : null,
            updatedAt: now,
          };
        }
        return t;
      });
    });
  };

  // Reopen task from stats modal (supports recurring task restore)
  const handleReopenTask = (id: string) => {
    updateTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;

      // If reopening a completed recurring log, delete log and restore parent due date
      if (task.recurringParentId) {
        deleteCloudTask(id, authState.token);
        return prev
          .filter(t => t.id !== id)
          .map(t => {
            if (t.id === task.recurringParentId) {
              return {
                ...t,
                dueDate: task.dueDate || t.dueDate,
                updatedAt: Date.now(),
              };
            }
            return t;
          });
      }

      return prev.map(t =>
        t.id === id ? { ...t, completed: false, completedAt: null, updatedAt: Date.now() } : t
      );
    });
  };

  // Delete task
  const handleDeleteTask = (id: string) => {
    deleteCloudTask(id, authState.token);
    updateTasks(prev => prev.filter(t => t.id !== id));
  };

  // In-place edit task title
  const handleUpdateTaskTitle = (id: string, newTitle: string) => {
    const now = Date.now();
    updateTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, title: newTitle, updatedAt: now } : t))
    );
  };

  // Update task due date
  const handleUpdateTaskDueDate = (id: string, newDueDate: string | null) => {
    const now = Date.now();
    updateTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, dueDate: newDueDate, updatedAt: now } : t))
    );
  };

  // Update task recurrence, weekdays and advance visibility settings
  const handleUpdateTaskRecurrence = (
    id: string,
    recurrence: RecurrenceType | null,
    advanceDays: number | null,
    newDueDate?: string | null,
    weekdays?: number[] | null
  ) => {
    const now = Date.now();
    updateTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const isRecur = Boolean(recurrence && recurrence !== 'none');
        const restoredQuadrant = isRecur && t.autoEscalatedFrom ? t.autoEscalatedFrom : t.quadrant;
        return {
          ...t,
          quadrant: restoredQuadrant,
          autoEscalatedFrom: isRecur ? null : t.autoEscalatedFrom,
          recurrence,
          weekdays: recurrence === 'weekly' ? weekdays || null : null,
          advanceDays,
          dueDate: newDueDate !== undefined ? newDueDate : t.dueDate,
          updatedAt: now,
        };
      })
    );
  };

  // Drop task into quadrant
  const handleDropTask = (taskId: string, targetQuadrant: QuadrantId) => {
    const now = Date.now();
    updateTasks(prev => {
      const index = prev.findIndex(t => t.id === taskId);
      if (index === -1) return prev;
      const updated = [...prev];
      const target = { ...updated[index], quadrant: targetQuadrant, updatedAt: now };
      updated.splice(index, 1);
      return [...updated, target];
    });
  };

  // Selected or nearest countdown for header and main screen display
  const homeCountdown = useMemo(() => {
    if (countdowns.length === 0) return null;
    // 1. Explicitly selected for home screen
    const explicit = countdowns.find(c => c.showOnHome);
    if (explicit) {
      return { item: explicit, stats: calculateCountdownStats(explicit) };
    }
    // 2. Pinned
    const pinned = countdowns.find(c => c.isPinned);
    if (pinned) {
      return { item: pinned, stats: calculateCountdownStats(pinned) };
    }
    // 3. Nearest upcoming
    const upcoming = countdowns
      .map(item => ({ item, stats: calculateCountdownStats(item) }))
      .filter(x => x.stats.status !== 'passed')
      .sort((a, b) => a.stats.daysDiff - b.stats.daysDiff);
    return upcoming[0] || { item: countdowns[0], stats: calculateCountdownStats(countdowns[0]) };
  }, [countdowns]);

  const [dismissedReminderBanner, setDismissedReminderBanner] = useState(false);

  // Active reminder tasks: tasks where reminder is set and today has reached the reminder window
  const activeReminderTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      if (t.advanceDays === null || t.advanceDays === undefined) return false;
      try {
        const [y, m, d] = t.dueDate.split('-').map(Number);
        const dueDay = new Date(y, m - 1, d);
        dueDay.setHours(0, 0, 0, 0);
        const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= t.advanceDays && diffDays >= 0;
      } catch {
        return false;
      }
    });
  }, [tasks]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Left: App Logo & Title */}
          <div className="flex items-center space-x-2.5 select-none">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
              <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                Focus Matrix
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                艾森豪威尔四象限时间管理
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* View Mode Switcher: 清单 / 贴纸 / 文件夹 */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-xs shadow-2xs mr-0.5">
              <button
                type="button"
                onClick={() => setGlobalViewMode('list')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                  globalViewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="清单视图：高密度极简紧凑列表"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">清单</span>
              </button>
              <button
                type="button"
                onClick={() => setGlobalViewMode('sticker')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                  globalViewMode === 'sticker'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="贴纸视图：双列便签网格，一屏容纳双倍事项"
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">贴纸</span>
              </button>
              <button
                type="button"
                onClick={() => setGlobalViewMode('folder')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                  globalViewMode === 'folder'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="文件夹视图：分类折叠，海量事项一键收纳"
              >
                <Folder className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">文件夹</span>
              </button>
            </div>

            {/* Standalone Countdown & Milestone Progress Button */}
            <button
              onClick={() => setIsCountdownModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/40 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100/90 dark:hover:bg-amber-900/50 shadow-2xs transition-colors cursor-pointer"
              title={
                homeCountdown
                  ? `主屏倒数：${homeCountdown.item.title}（剩余 ${
                      homeCountdown.stats.daysDiff === 0
                        ? '今天'
                        : homeCountdown.stats.status === 'passed'
                        ? `已过 ${Math.abs(homeCountdown.stats.daysDiff)} 天`
                        : `${homeCountdown.stats.daysDiff}天`
                    }，进度 ${formatPercent(homeCountdown.stats.effectiveProgressPercent)}%）- 点击打开看板管理`
                  : '打开倒数日看板'
              }
            >
              <Timer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>倒数日</span>
              {homeCountdown && (
                <span className="hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.5 text-[10px] bg-amber-200/90 dark:bg-amber-800/90 text-amber-900 dark:text-amber-100 rounded-md font-bold">
                  <span className="truncate max-w-[70px]">{homeCountdown.item.title}:</span>
                  <span>
                    {homeCountdown.stats.daysDiff === 0
                      ? '今天'
                      : homeCountdown.stats.status === 'passed'
                      ? `+${Math.abs(homeCountdown.stats.daysDiff)}天`
                      : `${homeCountdown.stats.daysDiff}天`}
                  </span>
                  <span className="text-amber-700 dark:text-amber-300 font-mono text-[9px]">
                    ({formatPercent(homeCountdown.stats.effectiveProgressPercent)}%)
                  </span>
                </span>
              )}
            </button>

            {/* Daily Completion Chart Button */}
            <button
              onClick={() => setIsStatsModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="查看按天完成任务图表与历史详情"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">完成统计</span>
            </button>

            {/* Hide/Show completed toggle */}
            <button
              onClick={() => setHideCompleted(!hideCompleted)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-2xs transition-colors cursor-pointer"
            >
              {hideCompleted ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">显示已完成</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">隐藏已完成</span>
                </>
              )}
            </button>

            {/* Dark mode button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-2xs transition-colors cursor-pointer"
              title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Data Recovery & Persistence Button */}
            <button
              onClick={() => setIsRecoveryModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="查看服务器数据库持久化状态、历史快照与找回未登录数据"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">备份与找回</span>
            </button>

            {/* User Account / Login Button */}
            {authState.user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 shadow-2xs transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{authState.user.username}</span>
                </button>

                {showUserDropdown && (
                  <div
                    className="absolute right-0 top-10 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150 text-xs"
                    onMouseLeave={() => setShowUserDropdown(false)}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700 text-slate-500">
                      <span>当前账号：</span>
                      <strong className="block text-slate-800 dark:text-slate-200 font-bold truncate">
                        {authState.user.username}
                      </strong>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        ● 云端持久化存储已连接
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setIsRecoveryModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 flex items-center space-x-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/70 text-left transition-colors cursor-pointer"
                    >
                      <FolderSync className="w-3.5 h-3.5 text-indigo-500" />
                      <span>数据找回与历史快照</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        exportBackupJson(tasks, countdowns, authState.user?.username);
                      }}
                      className="w-full px-3.5 py-2 flex items-center space-x-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/70 text-left transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-500" />
                      <span>导出离线备份 (JSON)</span>
                    </button>

                    <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

                    <button
                      onClick={handleLogout}
                      className="w-full px-3.5 py-2 flex items-center space-x-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>退出登录</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>登录 / 注册</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Unmerged Guest Tasks Prompt Banner */}
      {unmergedGuestTasks && unmergedGuestTasks.length > 0 && !dismissedGuestAlert && (
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white px-3 py-2 text-xs shadow-md animate-in fade-in duration-200">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-white shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="font-bold shrink-0">数据找回提示：</span>
              <span className="truncate">
                检测到您之前在未登录状态下创建了 <strong className="underline underline-offset-2">{unmergedGuestTasks.length}</strong> 条任务数据（{unmergedGuestTasks.slice(0, 2).map(t => `【${t.title}】`).join('、')}{unmergedGuestTasks.length > 2 ? '等' : ''}）
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleMergeGuestTasks}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center space-x-1"
              >
                <FolderSync className="w-3 h-3" />
                <span>一键合并导入当前账号</span>
              </button>
              <button
                onClick={() => setIsRecoveryModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                查看详情
              </button>
              <button
                onClick={() => setDismissedGuestAlert(true)}
                className="text-white/70 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
                title="关闭提示条"
              >
                忽略 ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active reminders banner if any tasks are currently in their reminder window */}
      {activeReminderTasks.length > 0 && !dismissedReminderBanner && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200/90 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 px-3 py-1.5 text-xs shadow-2xs animate-in fade-in duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2 truncate min-w-0 mr-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white shrink-0 shadow-2xs">
                <Bell className="w-3 h-3" />
              </span>
              <span className="font-bold shrink-0">到期提醒：</span>
              <span className="truncate">
                今日有 <strong className="text-amber-700 dark:text-amber-300 font-bold">{activeReminderTasks.length}</strong> 个事项到达提醒时间（
                {activeReminderTasks.slice(0, 3).map(t => `【${t.title}】`).join('、')}
                {activeReminderTasks.length > 3 ? ' 等' : ''}）
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDismissedReminderBanner(true)}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 text-[11px] font-bold cursor-pointer shrink-0 px-1 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40"
              title="关闭提醒条"
            >
              知道了 ✕
            </button>
          </div>
        </div>
      )}

      {/* Auto-escalation floating notification toast */}
      {escalatedAlert && (
        <div className="fixed top-16 right-6 z-40 bg-amber-500 text-white text-xs px-4 py-2.5 rounded-2xl shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <Zap className="w-4 h-4" />
          <span>{escalatedAlert}</span>
        </div>
      )}

      {/* Recurring Task cycle completion notification toast */}
      {cycleToast && (
        <div className="fixed top-16 right-6 z-40 bg-emerald-600 text-white text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-300 max-w-md">
          <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-300" />
          <span className="font-medium">{cycleToast}</span>
        </div>
      )}

      {/* Main 2x2 Matrix Grid matching the screenshot with optimized viewport spacing */}
      <main className="max-w-7xl w-full mx-auto px-2.5 sm:px-4 lg:px-6 py-2 sm:py-2.5 flex-1 flex flex-col justify-start">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 flex-1">
          {/* Quadrant 1: 重要且紧急 */}
          <MinimalQuadrant
            id="q1"
            title="象限 1：重要且紧急"
            strategy="马上做"
            placeholder="添加重要且紧急的任务..."
            dotColor="bg-[#ef4444]"
            badgeBg="bg-[#fee2e2] dark:bg-rose-950/80"
            badgeText="text-[#b91c1c] dark:text-rose-300"
            strategyColor="text-[#ef4444] dark:text-rose-400"
            cardBg="bg-[#fef2f2]/60 dark:bg-rose-950/15"
            borderColor="border-[#fecaca] dark:border-rose-900/50"
            buttonBg="bg-[#dc2626] hover:bg-[#b91c1c]"
            tasks={tasks.filter(t => t.quadrant === 'q1')}
            hideCompleted={hideCompleted}
            globalViewMode={globalViewMode}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
            onUpdateTaskRecurrence={handleUpdateTaskRecurrence}
            onUpdateTaskFolder={handleUpdateTaskFolder}
            onDropTask={handleDropTask}
          />

          {/* Quadrant 2: 重要但不紧急 */}
          <MinimalQuadrant
            id="q2"
            title="象限 2：重要但不紧急"
            strategy="计划做"
            placeholder="添加重要不紧急的任务..."
            dotColor="bg-[#f59e0b]"
            badgeBg="bg-[#fef3c7] dark:bg-amber-950/80"
            badgeText="text-[#b45309] dark:text-amber-300"
            strategyColor="text-[#d97706] dark:text-amber-400"
            cardBg="bg-[#fffbeb]/70 dark:bg-amber-950/15"
            borderColor="border-[#fde68a] dark:border-amber-900/50"
            buttonBg="bg-[#d97706] hover:bg-[#b45309]"
            tasks={tasks.filter(t => t.quadrant === 'q2')}
            hideCompleted={hideCompleted}
            globalViewMode={globalViewMode}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
            onUpdateTaskRecurrence={handleUpdateTaskRecurrence}
            onUpdateTaskFolder={handleUpdateTaskFolder}
            onDropTask={handleDropTask}
          />

          {/* Quadrant 3: 紧急但不重要 */}
          <MinimalQuadrant
            id="q3"
            title="象限 3：紧急但不重要"
            strategy="授权/快速做"
            placeholder="添加紧急但不重要的任务..."
            dotColor="bg-[#3b82f6]"
            badgeBg="bg-[#dbeafe] dark:bg-blue-950/80"
            badgeText="text-[#1d4ed8] dark:text-blue-300"
            strategyColor="text-[#2563eb] dark:text-blue-400"
            cardBg="bg-[#eff6ff]/70 dark:bg-blue-950/15"
            borderColor="border-[#bfdbfe] dark:border-blue-900/50"
            buttonBg="bg-[#2563eb] hover:bg-[#1d4ed8]"
            tasks={tasks.filter(t => t.quadrant === 'q3')}
            hideCompleted={hideCompleted}
            globalViewMode={globalViewMode}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
            onUpdateTaskRecurrence={handleUpdateTaskRecurrence}
            onUpdateTaskFolder={handleUpdateTaskFolder}
            onDropTask={handleDropTask}
          />

          {/* Quadrant 4: 不紧急也不重要 */}
          <MinimalQuadrant
            id="q4"
            title="象限 4：不紧急也不重要"
            strategy="减少/不做"
            placeholder="添加不紧急也不重要的任务..."
            dotColor="bg-[#64748b]"
            badgeBg="bg-[#e2e8f0] dark:bg-slate-800"
            badgeText="text-[#475569] dark:text-slate-300"
            strategyColor="text-[#64748b] dark:text-slate-400"
            cardBg="bg-[#f8fafc] dark:bg-slate-900/40"
            borderColor="border-[#e2e8f0] dark:border-slate-800"
            buttonBg="bg-[#475569] hover:bg-[#334155]"
            tasks={tasks.filter(t => t.quadrant === 'q4')}
            hideCompleted={hideCompleted}
            globalViewMode={globalViewMode}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
            onUpdateTaskRecurrence={handleUpdateTaskRecurrence}
            onUpdateTaskFolder={handleUpdateTaskFolder}
            onDropTask={handleDropTask}
          />
        </div>
      </main>

      {/* Completion Stats & Daily Task Inspection Modal */}
      <CompletionStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        tasks={tasks}
        onReopenTask={handleReopenTask}
      />

      {/* Standalone Countdown & Milestone Progress Modal */}
      {isCountdownModalOpen && (
        <CountdownModal
          isOpen={isCountdownModalOpen}
          onClose={() => setIsCountdownModalOpen(false)}
          countdowns={countdowns}
          onSaveCountdown={handleSaveCountdown}
          onDeleteCountdown={handleDeleteCountdown}
          onToggleMilestone={handleToggleMilestone}
          onAddMilestone={handleAddMilestone}
          onTogglePin={handleTogglePin}
          onToggleShowOnHome={handleToggleShowOnHome}
        />
      )}

      {/* User Login / Register Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Data Recovery & Persistence Modal */}
      {isRecoveryModalOpen && (
        <DataRecoveryModal
          isOpen={isRecoveryModalOpen}
          onClose={() => setIsRecoveryModalOpen(false)}
          currentTasks={tasks}
          currentCountdowns={countdowns}
          user={authState.user}
          token={authState.token}
          onRestoreTasks={handleRestoreTasksFromRecovery}
          onForceSync={() => syncTasksToCloud(tasks, authState.token, authState.user?.username)}
        />
      )}
    </div>
  );
}
