import { QuadrantId, Task } from '../types';

export interface QuadrantMeta {
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
}

export const QUADRANT_METAS: Record<QuadrantId, QuadrantMeta> = {
  q1: {
    id: 'q1',
    title: '象限 1：重要且紧急',
    strategy: '马上做',
    placeholder: '添加重要且紧急的任务...',
    dotColor: 'bg-[#ef4444]',
    badgeBg: 'bg-[#fee2e2] dark:bg-rose-950/80',
    badgeText: 'text-[#b91c1c] dark:text-rose-300',
    strategyColor: 'text-[#ef4444] dark:text-rose-400',
    cardBg: 'bg-[#fef2f2]/60 dark:bg-rose-950/15',
    borderColor: 'border-[#fecaca] dark:border-rose-900/50',
    buttonBg: 'bg-[#dc2626] hover:bg-[#b91c1c]',
  },
  q2: {
    id: 'q2',
    title: '象限 2：重要但不紧急',
    strategy: '计划做',
    placeholder: '添加重要不紧急的任务...',
    dotColor: 'bg-[#f59e0b]',
    badgeBg: 'bg-[#fef3c7] dark:bg-amber-950/80',
    badgeText: 'text-[#b45309] dark:text-amber-300',
    strategyColor: 'text-[#d97706] dark:text-amber-400',
    cardBg: 'bg-[#fffbeb]/70 dark:bg-amber-950/15',
    borderColor: 'border-[#fde68a] dark:border-amber-900/50',
    buttonBg: 'bg-[#d97706] hover:bg-[#b45309]',
  },
  q3: {
    id: 'q3',
    title: '象限 3：紧急但不重要',
    strategy: '授权/快速做',
    placeholder: '添加紧急但不重要的任务...',
    dotColor: 'bg-[#3b82f6]',
    badgeBg: 'bg-[#dbeafe] dark:bg-blue-950/80',
    badgeText: 'text-[#1d4ed8] dark:text-blue-300',
    strategyColor: 'text-[#2563eb] dark:text-blue-400',
    cardBg: 'bg-[#eff6ff]/70 dark:bg-blue-950/15',
    borderColor: 'border-[#bfdbfe] dark:border-blue-900/50',
    buttonBg: 'bg-[#2563eb] hover:bg-[#1d4ed8]',
  },
  q4: {
    id: 'q4',
    title: '象限 4：不紧急也不重要',
    strategy: '减少/不做',
    placeholder: '添加不紧急也不重要的任务...',
    dotColor: 'bg-[#64748b]',
    badgeBg: 'bg-[#e2e8f0] dark:bg-slate-800',
    badgeText: 'text-[#475569] dark:text-slate-300',
    strategyColor: 'text-[#64748b] dark:text-slate-400',
    cardBg: 'bg-[#f8fafc] dark:bg-slate-900/40',
    borderColor: 'border-[#e2e8f0] dark:border-slate-800',
    buttonBg: 'bg-[#475569] hover:bg-[#334155]',
  },
};

const now = Date.now();
const oneDayMs = 24 * 3600 * 1000;

export const INITIAL_DEMO_TASKS: Task[] = [
  {
    id: 'task-1',
    title: '完成项目核心模块开发',
    quadrant: 'q2',
    completed: false,
    dueDate: new Date(now + 4 * oneDayMs).toISOString().split('T')[0],
    createdAt: now - 3600 * 1000 * 3,
    updatedAt: now - 3600 * 1000 * 3,
  },
  {
    id: 'task-2',
    title: '回复例行邮件与消息通知',
    quadrant: 'q3',
    completed: false,
    dueDate: null,
    createdAt: now - 3600 * 1000 * 2,
    updatedAt: now - 3600 * 1000 * 2,
  },
  {
    id: 'task-3',
    title: '整理桌面与无用文件清理',
    quadrant: 'q4',
    completed: false,
    dueDate: null,
    createdAt: now - 3600 * 1000 * 1,
    updatedAt: now - 3600 * 1000 * 1,
  },
  // Some realistic past completed tasks for daily completion chart visualization
  {
    id: 'done-1',
    title: '提交上周工作总结与经营指标',
    quadrant: 'q1',
    completed: true,
    completedAt: now - 3600 * 1000 * 2, // today
    dueDate: new Date().toISOString().split('T')[0],
    createdAt: now - oneDayMs,
    updatedAt: now - 3600 * 1000 * 2,
  },
  {
    id: 'done-2',
    title: '代码审查与单元测试覆盖率检查',
    quadrant: 'q2',
    completed: true,
    completedAt: now - 3600 * 1000 * 5, // today
    dueDate: new Date().toISOString().split('T')[0],
    createdAt: now - oneDayMs,
    updatedAt: now - 3600 * 1000 * 5,
  },
  {
    id: 'done-3',
    title: '与架构师同步分布式缓存方案',
    quadrant: 'q2',
    completed: true,
    completedAt: now - oneDayMs - 3600 * 1000 * 4, // yesterday
    dueDate: null,
    createdAt: now - 2 * oneDayMs,
    updatedAt: now - oneDayMs - 3600 * 1000 * 4,
  },
  {
    id: 'done-4',
    title: '更新第三方依赖安全补丁',
    quadrant: 'q1',
    completed: true,
    completedAt: now - oneDayMs - 3600 * 1000 * 6, // yesterday
    dueDate: null,
    createdAt: now - 2 * oneDayMs,
    updatedAt: now - oneDayMs - 3600 * 1000 * 6,
  },
  {
    id: 'done-5',
    title: '清理云盘冗余备份与归档',
    quadrant: 'q4',
    completed: true,
    completedAt: now - 2 * oneDayMs - 3600 * 1000 * 3, // 2 days ago
    dueDate: null,
    createdAt: now - 3 * oneDayMs,
    updatedAt: now - 2 * oneDayMs - 3600 * 1000 * 3,
  },
  {
    id: 'done-6',
    title: '与产品经理对齐下期迭代排期',
    quadrant: 'q2',
    completed: true,
    completedAt: now - 3 * oneDayMs - 3600 * 1000 * 5, // 3 days ago
    dueDate: null,
    createdAt: now - 4 * oneDayMs,
    updatedAt: now - 3 * oneDayMs - 3600 * 1000 * 5,
  },
];
