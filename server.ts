import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

interface Task {
  id: string;
  title: string;
  quadrant: 'q1' | 'q2' | 'q3' | 'q4';
  completed: boolean;
  completedAt?: number | null;
  dueDate?: string | null;
  autoEscalatedFrom?: 'q1' | 'q2' | 'q3' | 'q4' | null;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  weekdays?: number[] | null;
  advanceDays?: number | null;
  folder?: string | null;
  recurringParentId?: string | null;
  createdAt: number;
  updatedAt: number;
}

interface CountdownMilestone {
  id: string;
  title: string;
  completed: boolean;
}

interface CountdownItem {
  id: string;
  title: string;
  targetDate: string;
  startDate?: string | null;
  category: 'life' | 'work' | 'exam' | 'anniversary' | 'health' | 'other';
  isPinned?: boolean;
  notes?: string;
  milestones?: CountdownMilestone[];
  createdAt: number;
  updatedAt: number;
}

interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

const DATA_DIR = path.join(__dirname, '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'user_tasks.json');
const COUNTDOWNS_FILE = path.join(DATA_DIR, 'user_countdowns.json');

let users: Map<string, User> = new Map(); // username -> User
let userTasks: Map<string, Task[]> = new Map(); // username -> Task[]
let userCountdowns: Map<string, CountdownItem[]> = new Map(); // username -> CountdownItem[]

// Helper password hash
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_qm_salt_2026').digest('hex');
}

function initDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      for (const [k, v] of Object.entries(parsed)) {
        users.set(k.toLowerCase(), v as User);
      }
    }
    if (fs.existsSync(TASKS_FILE)) {
      const content = fs.readFileSync(TASKS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) {
          userTasks.set(k.toLowerCase(), v as Task[]);
        }
      }
    }
    if (fs.existsSync(COUNTDOWNS_FILE)) {
      const content = fs.readFileSync(COUNTDOWNS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) {
          userCountdowns.set(k.toLowerCase(), v as CountdownItem[]);
        }
      }
    }
  } catch (err) {
    console.warn('[Db init warning]', err);
  }
}

function saveDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const usersObj: Record<string, User> = {};
    users.forEach((v, k) => {
      usersObj[k] = v;
    });
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersObj, null, 2), 'utf-8');

    const tasksObj: Record<string, Task[]> = {};
    userTasks.forEach((v, k) => {
      tasksObj[k] = v;
    });
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasksObj, null, 2), 'utf-8');

    const countdownsObj: Record<string, CountdownItem[]> = {};
    userCountdowns.forEach((v, k) => {
      countdownsObj[k] = v;
    });
    fs.writeFileSync(COUNTDOWNS_FILE, JSON.stringify(countdownsObj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Db save warning]', err);
  }
}

initDb();

// Simple in-memory session tokens
const sessionTokens = new Map<string, string>(); // token -> username

// ==========================================
// Authentication Endpoints
// ==========================================

// Register
app.post('/api/v1/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }

  const cleanUser = username.trim().toLowerCase();
  if (cleanUser.length < 2 || cleanUser.length > 20) {
    return res.status(400).json({ success: false, error: '用户名长度需在 2 到 20 个字符之间' });
  }
  if (password.length < 4) {
    return res.status(400).json({ success: false, error: '密码长度至少需 4 个字符' });
  }

  const existing = users.get(cleanUser);
  if (existing) {
    if (existing.passwordHash === hashPassword(password)) {
      const token = `token_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
      sessionTokens.set(token, cleanUser);
      return res.json({
        success: true,
        token,
        user: { id: existing.id, username: cleanUser },
        message: '该账号已存在，已为您直接登录',
      });
    }
    return res.status(400).json({ success: false, error: '该用户名已被注册，且密码不一致，请切换到【登录】输入正确密码' });
  }

  const newUser: User = {
    id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUser,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };

  users.set(cleanUser, newUser);
  if (!userTasks.has(cleanUser)) {
    userTasks.set(cleanUser, []);
  }
  if (!userCountdowns.has(cleanUser)) {
    userCountdowns.set(cleanUser, []);
  }
  saveDb();

  const token = `token_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  sessionTokens.set(token, cleanUser);

  res.json({
    success: true,
    token,
    user: { id: newUser.id, username: cleanUser },
    message: '注册成功',
  });
});

// Login (with self-healing auto-creation across container cold starts)
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '请输入用户名和密码' });
  }

  const cleanUser = username.trim().toLowerCase();
  let existing = users.get(cleanUser);

  // If user does not exist on this server instance (e.g. cold start / first login)
  if (!existing) {
    if (cleanUser.length < 2 || cleanUser.length > 20) {
      return res.status(400).json({ success: false, error: '用户名长度需在 2 到 20 个字符之间' });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, error: '密码长度至少需 4 个字符' });
    }

    const newUser: User = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUser,
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
    };

    users.set(cleanUser, newUser);
    if (!userTasks.has(cleanUser)) {
      userTasks.set(cleanUser, []);
    }
    if (!userCountdowns.has(cleanUser)) {
      userCountdowns.set(cleanUser, []);
    }
    saveDb();
    existing = newUser;
  }

  if (existing.passwordHash !== hashPassword(password)) {
    return res.status(400).json({
      success: false,
      code: 'WRONG_PASSWORD',
      error: '密码错误，请检查大小写后重新输入',
    });
  }

  const token = `token_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  sessionTokens.set(token, cleanUser);

  res.json({
    success: true,
    token,
    user: { id: existing.id, username: cleanUser },
    message: '登录成功',
  });
});

// Auth token verify middleware
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录或登录已过期' });
  }

  const token = authHeader.split(' ')[1];
  const username = sessionTokens.get(token);
  if (!username || !users.has(username)) {
    return res.status(401).json({ success: false, error: '登录状态失效，请重新登录' });
  }

  (req as unknown as { currentUser: string }).currentUser = username;
  next();
}

// Get user tasks
app.get('/api/v1/tasks', authenticate, (req, res) => {
  const username = (req as unknown as { currentUser: string }).currentUser;
  const tasks = userTasks.get(username) || [];
  res.json({ success: true, tasks, serverTimestamp: Date.now() });
});

// Save / sync user tasks
app.post('/api/v1/tasks/sync', authenticate, (req, res) => {
  try {
    const username = (req as unknown as { currentUser: string }).currentUser;
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ success: false, error: 'tasks must be an array' });
    }

    // Sanitize and save exact tasks from client (so deletions are properly persisted)
    const validTasks: Task[] = tasks
      .filter((t: any) => t && typeof t.id === 'string' && typeof t.title === 'string')
      .map((t: any) => ({
        id: String(t.id),
        title: String(t.title),
        quadrant: ['q1', 'q2', 'q3', 'q4'].includes(t.quadrant) ? t.quadrant : 'q1',
        completed: Boolean(t.completed),
        completedAt: typeof t.completedAt === 'number' ? t.completedAt : (t.completed ? Date.now() : null),
        dueDate: t.dueDate ? String(t.dueDate) : null,
        autoEscalatedFrom: t.autoEscalatedFrom || null,
        recurrence: ['daily', 'weekly', 'monthly', 'yearly', 'none'].includes(t.recurrence) ? t.recurrence : null,
        weekdays: Array.isArray(t.weekdays) ? t.weekdays.filter((d: any) => typeof d === 'number') : null,
        advanceDays: typeof t.advanceDays === 'number' ? t.advanceDays : (t.advanceDays === null ? null : undefined),
        folder: t.folder ? String(t.folder).trim() : null,
        recurringParentId: t.recurringParentId ? String(t.recurringParentId) : null,
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
        updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : Date.now(),
      }));

    userTasks.set(username, validTasks);
    saveDb();

    res.json({ success: true, tasks: validTasks, serverTimestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Explicit task deletion endpoint
app.delete('/api/v1/tasks/:id', authenticate, (req, res) => {
  try {
    const username = (req as unknown as { currentUser: string }).currentUser;
    const taskId = req.params.id;
    const existing = userTasks.get(username) || [];
    const filtered = existing.filter(t => t.id !== taskId);
    userTasks.set(username, filtered);
    saveDb();
    res.json({ success: true, tasks: filtered, serverTimestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ==========================================
// Countdown & Milestones Endpoints
// ==========================================

// Get user countdowns
app.get('/api/v1/countdowns', authenticate, (req, res) => {
  const username = (req as unknown as { currentUser: string }).currentUser;
  const countdowns = userCountdowns.get(username) || [];
  res.json({ success: true, countdowns, serverTimestamp: Date.now() });
});

// Sync user countdowns
app.post('/api/v1/countdowns/sync', authenticate, (req, res) => {
  try {
    const username = (req as unknown as { currentUser: string }).currentUser;
    const { countdowns } = req.body;

    if (!Array.isArray(countdowns)) {
      return res.status(400).json({ success: false, error: 'countdowns must be an array' });
    }

    const validCountdowns: CountdownItem[] = countdowns
      .filter((c: any) => c && typeof c.id === 'string' && typeof c.title === 'string' && typeof c.targetDate === 'string')
      .map((c: any) => ({
        id: String(c.id),
        title: String(c.title).trim(),
        targetDate: String(c.targetDate),
        startDate: c.startDate ? String(c.startDate) : null,
        category: ['life', 'work', 'exam', 'anniversary', 'health', 'other'].includes(c.category)
          ? c.category
          : 'other',
        isPinned: Boolean(c.isPinned),
        notes: c.notes ? String(c.notes) : '',
        milestones: Array.isArray(c.milestones)
          ? c.milestones
              .filter((m: any) => m && typeof m.title === 'string')
              .map((m: any) => ({
                id: String(m.id || `m_${Math.random().toString(36).substring(2, 7)}`),
                title: String(m.title).trim(),
                completed: Boolean(m.completed),
              }))
          : [],
        createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
        updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
      }));

    userCountdowns.set(username, validCountdowns);
    saveDb();

    res.json({ success: true, countdowns: validCountdowns, serverTimestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Health endpoint for Render health checks
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'Focus Matrix Cloud', uptime: process.uptime() });
});

// Download source code zip with proper headers to prevent truncation
app.get('/api/v1/download-zip', (req, res) => {
  const zipPath = path.join(__dirname, '4room-code.zip');
  if (fs.existsSync(zipPath)) {
    const stat = fs.statSync(zipPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="4room-code.zip"');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
  } else {
    res.status(404).send('Zip file not found');
  }
});

// ==========================================
// Serve Vite frontend in Dev or Dist in Prod
// ==========================================
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FocusMatrix] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server Error]', err);
  process.exit(1);
});
