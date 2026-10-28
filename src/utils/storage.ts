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
  saveLocalSnapshot(tasks);

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
// Snapshots & Data Recovery Utilities
// ==========================================

const SNAPSHOTS_KEY = 'focus_matrix_snapshots';

export interface TaskSnapshotItem {
  id: string;
  timestamp: number;
  taskCount: number;
  previewTitles: string[];
  tasks: Task[];
}

export function getLocalSnapshots(): TaskSnapshotItem[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalSnapshot(tasks: Task[]): void {
  if (!tasks || tasks.length === 0) return;
  try {
    const existing = getLocalSnapshots();
    // Avoid duplicate snapshot if nothing changed within 30 seconds
    if (existing.length > 0) {
      const last = existing[0];
      if (
        Date.now() - last.timestamp < 30000 &&
        last.taskCount === tasks.length &&
        JSON.stringify(last.previewTitles) === JSON.stringify(tasks.slice(0, 4).map(t => t.title))
      ) {
        return;
      }
    }

    const newSnapshot: TaskSnapshotItem = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      taskCount: tasks.length,
      previewTitles: tasks.slice(0, 5).map(t => t.title),
      tasks: [...tasks],
    };

    const updated = [newSnapshot, ...existing].slice(0, 20); // keep last 20 local snapshots
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[Storage] Error saving local snapshot:', err);
  }
}

// Check if a task set is solely demo tasks or contains user custom tasks
export function isUserCustomTasks(tasks: Task[]): boolean {
  if (!tasks || tasks.length === 0) return false;
  const demoIds = new Set(['task-1', 'task-2', 'task-3', 'done-1', 'done-2', 'done-3', 'done-4', 'done-5']);
  return tasks.some(t => !demoIds.has(t.id));
}

// Scan all localStorage sources to find any stored task lists (guest, other accounts, backups)
export interface ScannedTaskSource {
  key: string;
  label: string;
  count: number;
  tasks: Task[];
  hasCustomTasks: boolean;
  sampleTitles: string[];
}

export function scanAllLocalTaskSources(currentUsername?: string): ScannedTaskSource[] {
  const sources: ScannedTaskSource[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('focus_matrix_local_tasks')) continue;

      const raw = localStorage.getItem(k);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isCurrent = currentUsername
            ? k === `${LOCAL_STORAGE_KEY}_${currentUsername}`
            : k === LOCAL_STORAGE_KEY;

          let label = '未登录/游客本地存储 (Guest)';
          if (k.startsWith(`${LOCAL_STORAGE_KEY}_`)) {
            const user = k.replace(`${LOCAL_STORAGE_KEY}_`, '');
            label = `账号 [${user}] 存储缓存`;
          }

          if (isCurrent) {
            label += ' (当前使用中)';
          }

          sources.push({
            key: k,
            label,
            count: parsed.length,
            tasks: parsed,
            hasCustomTasks: isUserCustomTasks(parsed),
            sampleTitles: parsed.slice(0, 4).map((t: any) => t.title || '未命名事项'),
          });
        }
      } catch {
        // ignore invalid json
      }
    }
  } catch (err) {
    console.warn('[Storage] Scan sources error:', err);
  }

  return sources;
}

// Smart merge of two task lists avoiding duplicate titles/IDs
export function mergeTaskLists(existing: Task[], incoming: Task[]): Task[] {
  const existingIds = new Set(existing.map(t => t.id));
  const existingKeySet = new Set(existing.map(t => `${t.quadrant}_${t.title.trim().toLowerCase()}`));
  const merged = [...existing];

  for (const item of incoming) {
    const key = `${item.quadrant}_${item.title.trim().toLowerCase()}`;
    if (!existingIds.has(item.id) && !existingKeySet.has(key)) {
      merged.push({
        ...item,
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        updatedAt: Date.now(),
      });
      existingKeySet.add(key);
    }
  }

  return merged;
}

// Export backup to JSON file download
export function exportBackupJson(
  tasks: Task[],
  countdowns: CountdownItem[],
  username?: string
): void {
  const payload = {
    app: 'FocusMatrix',
    version: '2.0.0',
    exportTime: new Date().toISOString(),
    username: username || 'guest',
    tasks,
    countdowns,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `focus_matrix_backup_${username || 'local'}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import backup from JSON file
export function parseBackupJson(jsonStr: string): { tasks: Task[]; countdowns: CountdownItem[] } | null {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return null;

    const tasks: Task[] = Array.isArray(data.tasks) ? data.tasks : [];
    const countdowns: CountdownItem[] = Array.isArray(data.countdowns) ? data.countdowns : [];
    return { tasks, countdowns };
  } catch {
    return null;
  }
}

// Server Diagnostic Status fetcher
export async function fetchServerStatus(): Promise<{
  success: boolean;
  server: string;
  persistence: string;
  dataFile: string;
  totalUsers: number;
  totalTasks: number;
  uptimeSeconds: number;
} | null> {
  try {
    const res = await fetch('/api/v1/server-status');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Server Status] Error:', err);
  }
  return null;
}

// Server Snapshot History fetcher
export async function fetchServerSnapshots(token: string): Promise<Array<{
  id: string;
  timestamp: number;
  taskCount: number;
  previewTitles: string[];
}> | null> {
  try {
    const res = await fetch('/api/v1/tasks/history', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        return data.history;
      }
    }
  } catch (err) {
    console.warn('[Server Snapshots] Error:', err);
  }
  return null;
}

// Restore from Server Snapshot
export async function restoreServerSnapshot(token: string, snapshotId: string): Promise<Task[] | null> {
  try {
    const res = await fetch('/api/v1/tasks/history/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ snapshotId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        return data.tasks;
      }
    }
  } catch (err) {
    console.warn('[Restore Server Snapshot] Error:', err);
  }
  return null;
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
