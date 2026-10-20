import { RecurrenceType, Task } from '../types';

export const WEEKDAY_OPTIONS = [
  { day: 1, label: '周一', shortLabel: '一' },
  { day: 2, label: '周二', shortLabel: '二' },
  { day: 3, label: '周三', shortLabel: '三' },
  { day: 4, label: '周四', shortLabel: '四' },
  { day: 5, label: '周五', shortLabel: '五' },
  { day: 6, label: '周六', shortLabel: '六' },
  { day: 0, label: '周日', shortLabel: '日' },
];

export const WEEKDAY_NAMES: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  0: '周日',
};

/**
 * Calculates the nearest upcoming date (including today) that matches any of the given weekdays.
 */
export function getNextOccurrenceForWeekdays(weekdays: number[], fromDate: Date = new Date()): string {
  if (!weekdays || weekdays.length === 0) {
    const y = fromDate.getFullYear();
    const m = String(fromDate.getMonth() + 1).padStart(2, '0');
    const d = String(fromDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    if (weekdays.includes(candidate.getDay())) {
      const y = candidate.getFullYear();
      const m = String(candidate.getMonth() + 1).padStart(2, '0');
      const d = String(candidate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes the next due date based on recurrence type and optional weekdays.
 * e.g., daily -> +1 day, weekly -> next selected weekday or +7 days, monthly -> +1 month, yearly -> +1 year.
 */
export function computeNextDueDate(
  currentDueDateStr?: string | null,
  recurrence?: RecurrenceType | null,
  weekdays?: number[] | null
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let baseDate: Date;
  if (currentDueDateStr) {
    try {
      const [y, m, d] = currentDueDateStr.split('-').map(Number);
      baseDate = new Date(y, m - 1, d);
      baseDate.setHours(0, 0, 0, 0);
    } catch {
      baseDate = new Date(today);
    }
  } else {
    baseDate = new Date(today);
  }

  // If the base due date was in the past, calculate from today
  if (baseDate.getTime() < today.getTime()) {
    baseDate = new Date(today);
  }

  const nextDate = new Date(baseDate);

  switch (recurrence) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;

    case 'weekly': {
      if (weekdays && weekdays.length > 0) {
        let found = false;
        for (let offset = 1; offset <= 7; offset++) {
          const candidate = new Date(baseDate);
          candidate.setDate(baseDate.getDate() + offset);
          if (weekdays.includes(candidate.getDay())) {
            nextDate.setTime(candidate.getTime());
            found = true;
            break;
          }
        }
        if (!found) {
          nextDate.setDate(nextDate.getDate() + 7);
        }
      } else {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      break;
    }

    case 'monthly': {
      const origDay = nextDate.getDate();
      nextDate.setMonth(nextDate.getMonth() + 1);
      // Handle month rollover (e.g., Jan 31 -> Feb 28)
      if (nextDate.getDate() < origDay) {
        nextDate.setDate(0);
      }
      break;
    }

    case 'yearly': {
      const origMonth = nextDate.getMonth();
      const origDay = nextDate.getDate();
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      // Handle leap year Feb 29
      if (origMonth === 1 && origDay === 29 && nextDate.getMonth() !== 1) {
        nextDate.setDate(0);
      }
      break;
    }

    default:
      nextDate.setDate(nextDate.getDate() + 1);
      break;
  }

  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, '0');
  const day = String(nextDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a task should be visible in the matrix based on its dueDate and advanceDays.
 * If advanceDays is defined (e.g. 15 for annual birthdays, 0 for daily journals),
 * the task remains hidden until (dueDate - today) <= advanceDays.
 */
export function isTaskVisibleInMatrix(task: Task, refDate: Date = new Date()): boolean {
  // Completed tasks are visible unless filtered by the hideCompleted toggle
  if (task.completed) {
    return true;
  }

  // Tasks without a dueDate or without advanceDays restriction are always visible
  if (!task.dueDate || task.advanceDays === undefined || task.advanceDays === null) {
    return true;
  }

  try {
    const today = new Date(refDate);
    today.setHours(0, 0, 0, 0);

    const [y, m, d] = task.dueDate.split('-').map(Number);
    const dueDay = new Date(y, m - 1, d);
    dueDay.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // If remaining days to due date is greater than the advance show threshold, hide it
    if (diffDays > task.advanceDays) {
      return false;
    }
  } catch {
    return true;
  }

  return true;
}

/**
 * Get days remaining until task becomes visible in matrix
 */
export function getDaysUntilVisible(task: Task, refDate: Date = new Date()): number {
  if (!task.dueDate || task.advanceDays === undefined || task.advanceDays === null) {
    return 0;
  }
  try {
    const today = new Date(refDate);
    today.setHours(0, 0, 0, 0);

    const [y, m, d] = task.dueDate.split('-').map(Number);
    const dueDay = new Date(y, m - 1, d);
    dueDay.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays - task.advanceDays);
  } catch {
    return 0;
  }
}

export function getRecurrenceLabel(
  recurrence?: RecurrenceType | null,
  weekdays?: number[] | null
): string {
  switch (recurrence) {
    case 'daily':
      return '每日';
    case 'weekly': {
      if (!weekdays || weekdays.length === 0) {
        return '每周';
      }
      if (weekdays.length === 1) {
        return `每${WEEKDAY_NAMES[weekdays[0]] || '周'}`;
      }
      if (weekdays.length === 7) {
        return '每日';
      }
      const sorted = [...weekdays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
      if (sorted.length === 5 && [1, 2, 3, 4, 5].every(d => sorted.includes(d))) {
        return '每周工作日';
      }
      if (sorted.length === 2 && [0, 6].every(d => sorted.includes(d))) {
        return '每周末';
      }
      const daysStr = sorted.map(d => WEEKDAY_NAMES[d]?.replace('周', '')).join('、');
      return `每周${daysStr}`;
    }
    case 'monthly':
      return '每月';
    case 'yearly':
      return '每年';
    default:
      return '单次';
  }
}

export function getDefaultAdvanceDays(recurrence?: RecurrenceType | null): number | null {
  switch (recurrence) {
    case 'yearly':
      return 15; // 每年生日/纪念日默认提前15天显示
    case 'monthly':
      return 3;  // 每月任务默认提前3天显示
    case 'weekly':
      return 1;  // 每周任务默认提前1天显示
    case 'daily':
      return 0;  // 每日任务默认当天显示
    default:
      return null;
  }
}
