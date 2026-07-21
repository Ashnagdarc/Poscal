import { convexClient } from "@/lib/convexClient";
import { api } from "../../convex/_generated/api";

export type ProgressPhase = "pre_market" | "post_market";
export type TaskPhase = "pre_market" | "session" | "post_market";

export interface ProgressTask {
  id: string;
  label: string;
  phase: TaskPhase;
  completed: boolean;
}

export interface ProgressSession {
  id: string;
  dateKey: string;
  phase: ProgressPhase;
  preMarketNotes: string;
  postMarketNotes: string;
  tasks: ProgressTask[];
  sessionStarted: boolean;
  journalCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PROGRESS_TASKS: ProgressTask[] = [
  { id: "pre-1", label: "Review market conditions", phase: "pre_market", completed: false },
  { id: "pre-2", label: "Check economic calendar", phase: "pre_market", completed: false },
  { id: "pre-3", label: "Define trading plan", phase: "pre_market", completed: false },
  { id: "session-1", label: "Follow entry checklist", phase: "session", completed: false },
  { id: "session-2", label: "Set stop loss on all trades", phase: "session", completed: false },
  { id: "post-1", label: "Review all trades", phase: "post_market", completed: false },
  { id: "post-2", label: "Document lessons learned", phase: "post_market", completed: false },
];

const STORAGE_PREFIX = "poscal.progressSessions";

const storageKey = (userId: string) => `${STORAGE_PREFIX}.${userId}`;

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createEmptySession = (dateKey: string): ProgressSession => ({
  id: `local-${dateKey}`,
  dateKey,
  phase: "pre_market",
  preMarketNotes: "",
  postMarketNotes: "",
  tasks: DEFAULT_PROGRESS_TASKS.map((task) => ({ ...task })),
  sessionStarted: false,
  journalCreated: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const fromConvexRow = (row: {
  _id: string;
  dateKey: string;
  phase: ProgressPhase;
  preMarketNotes?: string | null;
  postMarketNotes?: string | null;
  tasks: ProgressTask[];
  sessionStarted: boolean;
  journalCreated: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}): ProgressSession => ({
  id: row._id,
  dateKey: row.dateKey,
  phase: row.phase,
  preMarketNotes: row.preMarketNotes ?? "",
  postMarketNotes: row.postMarketNotes ?? "",
  tasks: Array.isArray(row.tasks) && row.tasks.length > 0
    ? row.tasks
    : DEFAULT_PROGRESS_TASKS.map((task) => ({ ...task })),
  sessionStarted: row.sessionStarted,
  journalCreated: row.journalCreated,
  createdAt: new Date(row.createdAtMs).toISOString(),
  updatedAt: new Date(row.updatedAtMs).toISOString(),
});

const readLocalSessions = (userId: string): ProgressSession[] => {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProgressSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalSessions = (userId: string, sessions: ProgressSession[]) => {
  localStorage.setItem(storageKey(userId), JSON.stringify(sessions));
};

const upsertLocalSession = (userId: string, session: ProgressSession) => {
  const sessions = readLocalSessions(userId);
  const index = sessions.findIndex((item) => item.dateKey === session.dateKey);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }
  writeLocalSessions(userId, sessions);
  return session;
};

export const listProgressSessions = async (userId: string): Promise<ProgressSession[]> => {
  if (convexClient) {
    try {
      const rows = await convexClient.query(api.progressSessions.listForUser, {
        userId,
        limit: 120,
      });
      const sessions = rows.map(fromConvexRow);
      writeLocalSessions(userId, sessions);
      return sessions;
    } catch (error) {
      console.warn("[progressSessions] Falling back to local sessions", error);
    }
  }

  return readLocalSessions(userId);
};

export const getProgressSessionForDay = async (
  userId: string,
  dateKey: string,
): Promise<ProgressSession> => {
  if (convexClient) {
    try {
      const row = await convexClient.query(api.progressSessions.getForDay, {
        userId,
        dateKey,
      });
      if (row) {
        const session = fromConvexRow(row);
        upsertLocalSession(userId, session);
        return session;
      }
    } catch (error) {
      console.warn("[progressSessions] Falling back to local day session", error);
    }
  }

  const local = readLocalSessions(userId).find((session) => session.dateKey === dateKey);
  return local ?? createEmptySession(dateKey);
};

export const saveProgressSession = async (
  userId: string,
  session: ProgressSession,
): Promise<ProgressSession> => {
  const payload = {
    ...session,
    updatedAt: new Date().toISOString(),
    journalCreated:
      session.journalCreated
      || Boolean(session.preMarketNotes.trim())
      || Boolean(session.postMarketNotes.trim())
      || session.tasks.some((task) => task.completed)
      || session.sessionStarted,
  };

  if (convexClient) {
    try {
      const row = await convexClient.mutation(api.progressSessions.upsertDay, {
        userId,
        dateKey: payload.dateKey,
        phase: payload.phase,
        preMarketNotes: payload.preMarketNotes || null,
        postMarketNotes: payload.postMarketNotes || null,
        tasks: payload.tasks,
        sessionStarted: payload.sessionStarted,
        journalCreated: payload.journalCreated,
      });
      if (row) {
        const saved = fromConvexRow(row);
        upsertLocalSession(userId, saved);
        return saved;
      }
    } catch (error) {
      console.warn("[progressSessions] Falling back to local save", error);
    }
  }

  return upsertLocalSession(userId, {
    ...payload,
    id: payload.id.startsWith("local-") ? payload.id : `local-${payload.dateKey}`,
  });
};

export const formatProgressDateKey = toDateKey;

export const computeTaskStats = (tasks: ProgressTask[]) => {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const byPhase = (phase: TaskPhase) => {
    const phaseTasks = tasks.filter((task) => task.phase === phase);
    return {
      total: phaseTasks.length,
      completed: phaseTasks.filter((task) => task.completed).length,
    };
  };

  return {
    total,
    completed,
    preMarket: byPhase("pre_market"),
    session: byPhase("session"),
    postMarket: byPhase("post_market"),
  };
};

export type HeatmapTone = "none" | "journal" | "tasks_partial" | "tasks_complete" | "profit" | "breakeven" | "loss";

export interface HeatmapDay {
  dateKey: string;
  tone: HeatmapTone;
}

export const buildJournalHeatmap = (sessions: ProgressSession[], weeks = 12): HeatmapDay[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  const sessionMap = new Map(sessions.map((session) => [session.dateKey, session]));
  const days: HeatmapDay[] = [];

  for (let cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = toDateKey(cursor);
    const session = sessionMap.get(dateKey);
    days.push({
      dateKey,
      tone: session?.journalCreated ? "journal" : "none",
    });
  }

  return days;
};

export const buildTasksHeatmap = (sessions: ProgressSession[], weeks = 12): HeatmapDay[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  const sessionMap = new Map(sessions.map((session) => [session.dateKey, session]));
  const days: HeatmapDay[] = [];

  for (let cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = toDateKey(cursor);
    const session = sessionMap.get(dateKey);
    if (!session) {
      days.push({ dateKey, tone: "none" });
      continue;
    }

    const stats = computeTaskStats(session.tasks);
    if (stats.completed === 0) {
      days.push({ dateKey, tone: "none" });
    } else if (stats.completed >= stats.total) {
      days.push({ dateKey, tone: "tasks_complete" });
    } else {
      days.push({ dateKey, tone: "tasks_partial" });
    }
  }

  return days;
};

export const buildProfitHeatmap = (
  dailyPnl: Array<{ dateKey: string; pnl: number }>,
  weeks = 12,
): HeatmapDay[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  const pnlMap = new Map(dailyPnl.map((day) => [day.dateKey, day.pnl]));
  const days: HeatmapDay[] = [];

  for (let cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = toDateKey(cursor);
    const pnl = pnlMap.get(dateKey);
    if (pnl === undefined) {
      days.push({ dateKey, tone: "none" });
    } else if (pnl > 0) {
      days.push({ dateKey, tone: "profit" });
    } else if (pnl < 0) {
      days.push({ dateKey, tone: "loss" });
    } else {
      days.push({ dateKey, tone: "breakeven" });
    }
  }

  return days;
};

export const computeStreak = (sessions: ProgressSession[], predicate: (session: ProgressSession) => boolean) => {
  const sorted = [...sessions]
    .filter(predicate)
    .map((session) => session.dateKey)
    .sort((left, right) => right.localeCompare(left));

  if (!sorted.length) {
    return { current: 0, best: 0 };
  }

  const uniqueDays = Array.from(new Set(sorted));
  let best = 1;
  let run = 1;

  for (let index = 1; index < uniqueDays.length; index += 1) {
    const newer = new Date(`${uniqueDays[index - 1]}T00:00:00`);
    const older = new Date(`${uniqueDays[index]}T00:00:00`);
    const diffDays = Math.round((newer.getTime() - older.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  const todayKey = toDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  let current = 0;
  if (uniqueDays[0] === todayKey || uniqueDays[0] === yesterdayKey) {
    current = 1;
    for (let index = 1; index < uniqueDays.length; index += 1) {
      const newer = new Date(`${uniqueDays[index - 1]}T00:00:00`);
      const older = new Date(`${uniqueDays[index]}T00:00:00`);
      const diffDays = Math.round((newer.getTime() - older.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, best: Math.max(best, current) };
};
