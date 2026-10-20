import { Task, QuadrantId } from '../types';

/**
 * Checks tasks for upcoming deadlines (<= 2 days).
 * Rules:
 * - 'q2' (重要但不紧急) -> 'q1' (重要且紧急)
 * - 'q4' (不紧急也不重要) -> 'q3' (紧急但不重要)
 */
export function checkAndEscalateTasks(tasks: Task[]): { tasks: Task[]; changedCount: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nowMs = today.getTime();
  const twoDaysMs = 2 * 24 * 3600 * 1000;

  let changedCount = 0;

  const updatedTasks = tasks.map(task => {
    // Recurring tasks (e.g., daily, weekly, monthly, yearly) do NOT auto-escalate across quadrants!
    const isRecurring = Boolean(task.recurrence && task.recurrence !== 'none');

    // If an existing recurring task was previously auto-escalated (e.g. from q4->q3 or q2->q1),
    // restore it immediately back to its original quadrant and clear autoEscalatedFrom!
    if (isRecurring && task.autoEscalatedFrom) {
      changedCount++;
      return {
        ...task,
        quadrant: task.autoEscalatedFrom,
        autoEscalatedFrom: null,
        updatedAt: Date.now(),
      };
    }

    if (isRecurring) {
      return task;
    }

    // Only active non-recurring tasks with a due date can auto-escalate
    if (task.completed || !task.dueDate) {
      return task;
    }

    try {
      const [year, month, day] = task.dueDate.split('-').map(Number);
      const dueTime = new Date(year, month - 1, day, 23, 59, 59).getTime();
      const diffMs = dueTime - nowMs;

      // Within 2 days (<= 2 days, or already overdue diffMs < 0)
      if (diffMs <= twoDaysMs) {
        if (task.quadrant === 'q2') {
          changedCount++;
          return {
            ...task,
            quadrant: 'q1' as QuadrantId,
            autoEscalatedFrom: 'q2' as QuadrantId,
            updatedAt: Date.now(),
          };
        } else if (task.quadrant === 'q4') {
          changedCount++;
          return {
            ...task,
            quadrant: 'q3' as QuadrantId,
            autoEscalatedFrom: 'q4' as QuadrantId,
            updatedAt: Date.now(),
          };
        }
      }
    } catch {
      // ignore date parse issues
    }

    return task;
  });

  return { tasks: updatedTasks, changedCount };
}

/**
 * Returns user-friendly status of due date
 */
export function getDueDateStatus(dueDate?: string | null): {
  text: string;
  isUrgent: boolean;
  isOverdue: boolean;
} {
  if (!dueDate) return { text: '', isUrgent: false, isOverdue: false };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = dueDate.split('-').map(Number);
    const target = new Date(year, month - 1, day);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `逾期 ${Math.abs(diffDays)} 天`, isUrgent: true, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: '今天截止', isUrgent: true, isOverdue: false };
    } else if (diffDays === 1) {
      return { text: '明天截止', isUrgent: true, isOverdue: false };
    } else if (diffDays === 2) {
      return { text: '后天截止 (剩2天)', isUrgent: true, isOverdue: false };
    } else {
      return { text: `${month}月${day}日`, isUrgent: false, isOverdue: false };
    }
  } catch {
    return { text: dueDate, isUrgent: false, isOverdue: false };
  }
}
