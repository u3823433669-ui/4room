import { CountdownItem, CountdownCategory } from '../types';

export interface CountdownCalculatedStats {
  daysDiff: number; // positive = days left; 0 = today; negative = days passed
  status: 'upcoming' | 'today' | 'passed';
  daysLabel: string;
  totalDays: number;
  passedDays: number;
  timeProgressPercent: number; // 0 - 100
  milestonesTotal: number;
  milestonesCompleted: number;
  milestoneProgressPercent: number; // 0 - 100
  effectiveProgressPercent: number; // 0 - 100
}

export const COUNTDOWN_CATEGORIES: {
  key: CountdownCategory;
  label: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  borderHover: string;
}[] = [
  {
    key: 'life',
    label: '生活日常',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/70',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
    borderHover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    key: 'work',
    label: '工作项目',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/70',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    dotColor: 'bg-indigo-500',
    borderHover: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
  {
    key: 'exam',
    label: '考试升学',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/70',
    badgeText: 'text-amber-700 dark:text-amber-300',
    dotColor: 'bg-amber-500',
    borderHover: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    key: 'anniversary',
    label: '纪念日',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/70',
    badgeText: 'text-rose-700 dark:text-rose-300',
    dotColor: 'bg-rose-500',
    borderHover: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    key: 'health',
    label: '健康健身',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/70',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    dotColor: 'bg-cyan-500',
    borderHover: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    key: 'other',
    label: '其他心愿',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/70',
    badgeText: 'text-purple-700 dark:text-purple-300',
    dotColor: 'bg-purple-500',
    borderHover: 'hover:border-purple-300 dark:hover:border-purple-700',
  },
];

export function getCategoryMeta(category: CountdownCategory) {
  return (
    COUNTDOWN_CATEGORIES.find(c => c.key === category) || {
      key: 'other' as CountdownCategory,
      label: '其他',
      badgeBg: 'bg-slate-100 dark:bg-slate-800',
      badgeText: 'text-slate-600 dark:text-slate-300',
      dotColor: 'bg-slate-400',
      borderHover: 'hover:border-slate-300',
    }
  );
}

// Calculate days difference and progress statistics
export function calculateCountdownStats(item: CountdownItem): CountdownCalculatedStats {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!item || !item.targetDate) {
      return {
        daysDiff: 0,
        status: 'today',
        daysLabel: '今天',
        totalDays: 1,
        passedDays: 0,
        timeProgressPercent: 0,
        milestonesTotal: 0,
        milestonesCompleted: 0,
        milestoneProgressPercent: 0,
        effectiveProgressPercent: 0,
      };
    }

    // Parse target date YYYY-MM-DD safely
    let target: Date;
    if (item.targetDate.includes('-')) {
      const targetParts = item.targetDate.split('-');
      target = new Date(
        Number(targetParts[0]),
        Number(targetParts[1]) - 1,
        Number(targetParts[2])
      );
    } else {
      target = new Date(item.targetDate);
    }

    if (isNaN(target.getTime())) {
      target = new Date();
    }
    target.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysDiff = Math.round((target.getTime() - today.getTime()) / msPerDay);

    let status: 'upcoming' | 'today' | 'passed' = 'upcoming';
    let daysLabel = `还有 ${daysDiff} 天`;

    if (daysDiff === 0) {
      status = 'today';
      daysLabel = '就在今天！🎉';
    } else if (daysDiff < 0) {
      status = 'passed';
      daysLabel = `已过去 ${Math.abs(daysDiff)} 天`;
    }

    // Calculate start date for time progress
    let start: Date;
    if (item.startDate) {
      if (item.startDate.includes('-')) {
        const startParts = item.startDate.split('-');
        start = new Date(
          Number(startParts[0]),
          Number(startParts[1]) - 1,
          Number(startParts[2])
        );
      } else {
        start = new Date(item.startDate);
      }
    } else {
      start = new Date(item.createdAt || Date.now());
    }

    if (isNaN(start.getTime())) {
      start = new Date(today.getTime() - 30 * msPerDay);
    }
    start.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.round((target.getTime() - start.getTime()) / msPerDay));
    const passedDays = Math.max(0, Math.round((today.getTime() - start.getTime()) / msPerDay));

    let timeProgressPercent = 0;
    if (status === 'passed') {
      timeProgressPercent = 100;
    } else if (totalDays > 0) {
      timeProgressPercent = Math.min(100, Math.max(0, Math.round((passedDays / totalDays) * 100)));
    }

    // Milestones progress
    const milestonesTotal = Array.isArray(item.milestones) ? item.milestones.length : 0;
    const milestonesCompleted = Array.isArray(item.milestones)
      ? item.milestones.filter(m => m && m.completed).length
      : 0;
    const milestoneProgressPercent =
      milestonesTotal > 0 ? Math.round((milestonesCompleted / milestonesTotal) * 100) : 0;

    // Effective progress: if milestones exist, prioritize milestones; otherwise time progress
    const effectiveProgressPercent =
      milestonesTotal > 0 ? milestoneProgressPercent : timeProgressPercent;

    return {
      daysDiff,
      status,
      daysLabel,
      totalDays,
      passedDays,
      timeProgressPercent,
      milestonesTotal,
      milestonesCompleted,
      milestoneProgressPercent,
      effectiveProgressPercent,
    };
  } catch (err) {
    console.warn('[calculateCountdownStats] Error calculating stats:', err);
    return {
      daysDiff: 0,
      status: 'today',
      daysLabel: '今天',
      totalDays: 1,
      passedDays: 0,
      timeProgressPercent: 0,
      milestonesTotal: 0,
      milestonesCompleted: 0,
      milestoneProgressPercent: 0,
      effectiveProgressPercent: 0,
    };
  }
}

// Initial sample countdowns
export const INITIAL_DEMO_COUNTDOWNS: CountdownItem[] = [
  {
    id: 'cd_2027_new_year',
    title: '2027 新年元旦',
    targetDate: '2027-01-01',
    startDate: '2026-01-01',
    category: 'life',
    isPinned: true,
    notes: '奔赴新的一年，愿所有的美好与热烈如期而至！',
    createdAt: Date.now() - 30 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'cd_quarter_project',
    title: '重要项目攻坚与交付',
    targetDate: new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0],
    startDate: new Date(Date.now() - 32 * 86400000).toISOString().split('T')[0],
    category: 'work',
    isPinned: false,
    notes: '聚焦核心价值，按节奏稳步推进各个阶段交付。',
    milestones: [
      { id: 'm1', title: '核心架构与数据库模型设计', completed: true },
      { id: 'm2', title: '主要功能交互界面定稿与开发', completed: true },
      { id: 'm3', title: '业务端到端联调与性能调优', completed: false },
      { id: 'm4', title: '生产环境发布与用户验收', completed: false },
    ],
    createdAt: Date.now() - 32 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'cd_anniversary_love',
    title: '相恋与结婚纪念日',
    targetDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
    startDate: new Date(Date.now() - 320 * 86400000).toISOString().split('T')[0],
    category: 'anniversary',
    isPinned: false,
    notes: '一屋两人三餐四季，彼此珍惜每一个共同度过的日子。',
    createdAt: Date.now() - 320 * 86400000,
    updatedAt: Date.now(),
  },
];
