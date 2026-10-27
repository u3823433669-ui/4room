export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type QuadrantViewMode = 'list' | 'sticker' | 'folder';

export interface Task {
  id: string;
  title: string;
  quadrant: QuadrantId;
  completed: boolean;
  completedAt?: number | null; // Timestamp when completed
  dueDate?: string | null;     // YYYY-MM-DD
  autoEscalatedFrom?: QuadrantId | null; // e.g. escalated from q2 -> q1 or q4 -> q3
  recurrence?: RecurrenceType | null;   // 'daily' | 'weekly' | 'monthly' | 'yearly'
  weekdays?: number[] | null;          // 0 = 周日, 1 = 周一, ..., 6 = 周六 (用于每周重复指定的星期几)
  advanceDays?: number | null;         // 提前多少天显示 (例如每年生日提前 15 天显示，默认每天为0天即当天显示)
  folder?: string | null;              // 文件夹/分类归属 (如 "工作", "学习", "日常", "备忘", 自定义文件夹)
  recurringParentId?: string | null;   // 如果是归档的完成记录，关联母任务ID
  createdAt: number;
  updatedAt: number;
}

export interface DayCompletionStat {
  dateStr: string;      // YYYY-MM-DD
  dayLabel: string;     // e.g. "10-18"
  count: number;
  tasks: Task[];
}

export interface User {
  id: string;
  username: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

export type CountdownCategory = 'life' | 'work' | 'exam' | 'anniversary' | 'health' | 'other';

export interface CountdownMilestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface CountdownItem {
  id: string;
  title: string;                 // e.g. "距离2027考研", "距离结婚纪念日"
  targetDate: string;            // YYYY-MM-DD
  startDate?: string | null;     // YYYY-MM-DD
  category: CountdownCategory;   // 分类
  isPinned?: boolean;            // 置顶显示
  showOnHome?: boolean;          // 是否显示在主屏幕上
  notes?: string;                // 备注寄语
  milestones?: CountdownMilestone[]; // 阶段目标清单，用于计算打卡完成进度
  createdAt: number;
  updatedAt: number;
}
