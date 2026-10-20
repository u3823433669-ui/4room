export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Task {
  id: string;
  title: string;
  quadrant: QuadrantId;
  completed: boolean;
  completedAt?: number | null; // Timestamp when completed
  dueDate?: string | null;     // YYYY-MM-DD
  autoEscalatedFrom?: QuadrantId | null; // e.g. escalated from q2 -> q1 or q4 -> q3
  recurrence?: RecurrenceType | null;   // 'daily' | 'weekly' | 'monthly' | 'yearly'
  advanceDays?: number | null;         // 提前多少天显示 (例如每年生日提前 15 天显示，默认每天为0天即当天显示)
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
