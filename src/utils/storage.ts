import { Task, User, AuthState, CountdownItem } from '../types';
import { INITIAL_DEMO_TASKS } from './constants';
import { checkAndEscalateTasks } from './escalation';
import { INITIAL_DEMO_COUNTDOWNS } from './countdown';

const TOKEN_KEY = 'focus_matrix_auth_token';
const USER_KEY = 'focus_matrix_user';
const LOCAL_STORAGE_KEY = 'focus_matrix_local_tasks';
const LOCAL_COUNTDOWNS_KEY = 'focus_matrix_local_countdowns';

export function getStoredAuth(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (token && userRaw) {
      const user = JSON.parse(userRaw);
      return { token, user };
    }
  } catch {
    // ignore
  }
  return { token: null, user: null };
}

export function saveStoredAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Local cache
export function loadLocalTasks(username?: string): Task[] {
  const key = username ? `${LOCAL_STORAGE_KEY}_${username}` : LOCAL_STORAGE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0) {
          const { tasks: escalated } = checkAndEscalateTasks(parsed);
          return escalated;
        }
        return [];
      }
    }
  } catch (e) {
    console.warn('[Storage] Error loading local tasks:', e);
  }

  const { tasks: escalatedDemo } = checkAndEscalateTasks(INITIAL_DEMO_TASKS);
  saveLocalTasks(escalatedDemo, username);
  return escalatedDemo;
}

export function saveLocalTasks(tasks: Task[], username?: string): void {
  const key = username ? `${LOCAL_STORAGE_KEY}_${username}` : LOCAL_STORAGE_KEY;
  try {
    localStorage.setItem(key, JSON.stringify(tasks));
  } catch (e) {
    console.error('[Storage] Error saving local tasks:', e);
  }
}

// Fetch user tasks from cloud server
export async function fetchCloudTasks(token: string): Promise<Task[] | null> {
  try {
    const res = await fetch('/api/v1/tasks', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        return data.tasks;
      }
    }
  } catch (err) {
    console.warn('[Cloud Fetch] Error:', err);
  }
  return null;
}

// Explicit task deletion helper
export async function deleteCloudTask(taskId: string, token: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch(`/api/v1/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.warn('[Cloud Delete] Error:', err);
  }
}

// Auto-sync debouncer
let syncDebounceTimer: NodeJS.Timeout | null = null;

export function syncTasksToCloud(
  tasks: Task[],
  token: string | null,
  username?: string,
  onRemoteMerged?: (tasks: Task[]) => void
): void {
  saveLocalTasks(tasks, username);

  if (!token) return;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/v1/tasks/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tasks }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tasks) && onRemoteMerged) {
          saveLocalTasks(data.tasks, username);
          onRemoteMerged(data.tasks);
        }
      }
    } catch {
      // offline fallback is safe in local storage
    }
  }, 400);
}

// ==========================================
// Countdowns Storage (倒数日与目标进度)
// ==========================================

export function loadLocalCountdowns(username?: string): CountdownItem[] {
  const key = username ? `${LOCAL_COUNTDOWNS_KEY}_${username}` : LOCAL_COUNTDOWNS_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Storage] Error loading local countdowns:', e);
  }

  saveLocalCountdowns(INITIAL_DEMO_COUNTDOWNS, username);
  return INITIAL_DEMO_COUNTDOWNS;
}

export function saveLocalCountdowns(items: CountdownItem[], username?: string): void {
  const key = username ? `${LOCAL_COUNTDOWNS_KEY}_${username}` : LOCAL_COUNTDOWNS_KEY;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error('[Storage] Error saving local countdowns:', e);
  }
}

export async function fetchCloudCountdowns(token: string): Promise<CountdownItem[] | null> {
  try {
    const res = await fetch('/api/v1/countdowns', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.countdowns)) {
        return data.countdowns;
      }
    }
  } catch (err) {
    console.warn('[Cloud Fetch Countdowns] Error:', err);
  }
  return null;
}

let countdownSyncTimer: NodeJS.Timeout | null = null;

export function syncCountdownsToCloud(
  countdowns: CountdownItem[],
  token: string | null,
  username?: string,
  onRemoteMerged?: (items: CountdownItem[]) => void
): void {
  saveLocalCountdowns(countdowns, username);

  if (!token) return;

  if (countdownSyncTimer) {
    clearTimeout(countdownSyncTimer);
  }

  countdownSyncTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/v1/countdowns/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ countdowns }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.countdowns) && onRemoteMerged) {
          saveLocalCountdowns(data.countdowns, username);
          onRemoteMerged(data.countdowns);
        }
      }
    } catch {
      // offline fallback
    }
  }, 400);
}
