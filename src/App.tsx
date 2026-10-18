import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Eye,
  EyeOff,
  Moon,
  Sun,
  BarChart3,
  User as UserIcon,
  LogOut,
  Zap,
} from 'lucide-react';
import { Task, QuadrantId, AuthState, User } from './types';
import {
  loadLocalTasks,
  saveLocalTasks,
  getStoredAuth,
  saveStoredAuth,
  clearStoredAuth,
  fetchCloudTasks,
  syncTasksToCloud,
  deleteCloudTask,
} from './utils/storage';
import { checkAndEscalateTasks } from './utils/escalation';
import { MinimalQuadrant } from './components/MinimalQuadrant';
import { CompletionStatsModal } from './components/CompletionStatsModal';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>(() => getStoredAuth());
  const [tasks, setTasks] = useState<Task[]>(() =>
    loadLocalTasks(authState.user?.username)
  );

  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('focus_matrix_theme') === 'dark';
  });

  const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);
  const [escalatedAlert, setEscalatedAlert] = useState<string | null>(null);

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

  // Pull cloud tasks when user logs in or mounts
  useEffect(() => {
    async function loadCloud() {
      if (authState.token && authState.user) {
        const cloudTasks = await fetchCloudTasks(authState.token);
        if (cloudTasks !== null) {
          const { tasks: escalated } = checkAndEscalateTasks(cloudTasks);
          setTasks(escalated);
          saveLocalTasks(escalated, authState.user.username);
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
    if (cloudTasks) {
      const { tasks: escalated } = checkAndEscalateTasks(cloudTasks);
      setTasks(escalated);
      saveLocalTasks(escalated, user.username);
    }
  };

  // Logout
  const handleLogout = () => {
    clearStoredAuth();
    setAuthState({ token: null, user: null });
    setShowUserDropdown(false);
    // Reload guest tasks
    const guestTasks = loadLocalTasks();
    setTasks(guestTasks);
  };

  // Add task with optional due date
  const handleAddTask = (title: string, quadrant: QuadrantId, dueDate?: string | null) => {
    const now = Date.now();
    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      quadrant,
      completed: false,
      completedAt: null,
      dueDate: dueDate || null,
      createdAt: now,
      updatedAt: now,
    };

    updateTasks(prev => [...prev, newTask]);
  };

  // Toggle complete
  const handleToggleTask = (id: string) => {
    const now = Date.now();
    updateTasks(prev =>
      prev.map(t => {
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
      })
    );
  };

  // Reopen task from stats modal
  const handleReopenTask = (id: string) => {
    updateTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: false, completedAt: null, updatedAt: Date.now() } : t))
    );
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

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: App Logo & Title */}
          <div className="flex items-center space-x-3 select-none">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
              <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                Focus Matrix
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                艾森豪威尔四象限时间管理
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Daily Completion Chart Button */}
            <button
              onClick={() => setIsStatsModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="查看按天完成任务图表与历史详情"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">完成统计</span>
            </button>

            {/* Hide/Show completed toggle */}
            <button
              onClick={() => setHideCompleted(!hideCompleted)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-2xs transition-colors cursor-pointer"
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

            {/* User Account / Login Button */}
            {authState.user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 shadow-2xs transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{authState.user.username}</span>
                </button>

                {showUserDropdown && (
                  <div
                    className="absolute right-0 top-10 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150 text-xs"
                    onMouseLeave={() => setShowUserDropdown(false)}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700 text-slate-500">
                      <span>当前账号：</span>
                      <strong className="block text-slate-800 dark:text-slate-200 font-bold truncate">
                        {authState.user.username}
                      </strong>
                    </div>

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
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>登录 / 注册</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auto-escalation floating notification toast */}
      {escalatedAlert && (
        <div className="fixed top-20 right-6 z-40 bg-amber-500 text-white text-xs px-4 py-2.5 rounded-2xl shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <Zap className="w-4 h-4" />
          <span>{escalatedAlert}</span>
        </div>
      )}

      {/* Main 2x2 Matrix Grid matching the screenshot */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
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
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
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
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
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
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
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

      {/* User Login / Register Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
