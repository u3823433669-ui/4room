export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';

export interface Task {
  id: string;
  title: string;
  quadrant: QuadrantId;
  completed: boolean;
  completedAt?: number | null; // Timestamp when completed
  dueDate?: string | null;     // YYYY-MM-DD
  autoEscalatedFrom?: QuadrantId | null; // e.g. escalated from q2 -> q1 or q4 -> q3
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
