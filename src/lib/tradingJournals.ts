import { convexClient } from "@/lib/convexClient";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { SubscriptionTier } from "@/contexts/SubscriptionContext";

export const JOURNAL_LIMITS = {
  free: 2,
  premium: 5,
  pro: 5,
} as const;

export type TradingJournal = {
  id: string;
  userId: string;
  name: string;
  currency: string;
  balance: number;
  startingBalance: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateJournalInput = {
  name: string;
  currency: string;
  startingBalance: number;
  fullName?: string | null;
  subscriptionTier?: SubscriptionTier | string | null;
};

const ACTIVE_JOURNAL_STORAGE_KEY = "poscal.activeJournalId";

export const getJournalLimit = (tier?: string | null) => {
  if (tier === "premium" || tier === "pro") return JOURNAL_LIMITS.premium;
  return JOURNAL_LIMITS.free;
};

export const readStoredActiveJournalId = (userId?: string | null) => {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${ACTIVE_JOURNAL_STORAGE_KEY}.${userId}`);
    return raw || null;
  } catch {
    return null;
  }
};

export const writeStoredActiveJournalId = (userId: string, journalId: string | null) => {
  if (typeof window === "undefined") return;
  const key = `${ACTIVE_JOURNAL_STORAGE_KEY}.${userId}`;
  if (!journalId) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, journalId);
};

const fromConvexJournal = (row: {
  _id: string;
  userId: string;
  name: string;
  currency: string;
  balance: number;
  startingBalance?: number | null;
  status?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}): TradingJournal => ({
  id: row._id,
  userId: row.userId,
  name: row.name,
  currency: row.currency,
  balance: row.balance,
  startingBalance: row.startingBalance ?? row.balance,
  status: row.status ?? "active",
  createdAt: new Date(row.createdAtMs).toISOString(),
  updatedAt: new Date(row.updatedAtMs).toISOString(),
});

export const listTradingJournals = async (userId: string): Promise<TradingJournal[]> => {
  if (!convexClient) return [];
  const rows = await convexClient.query(api.tradingJournals.listForUser, { userId });
  return rows.map(fromConvexJournal);
};

export const createTradingJournal = async (
  userId: string,
  input: CreateJournalInput,
): Promise<TradingJournal> => {
  if (!convexClient) {
    throw new Error("Convex client unavailable");
  }

  const row = await convexClient.mutation(api.tradingJournals.create, {
    userId,
    name: input.name,
    currency: input.currency,
    startingBalance: input.startingBalance,
    fullName: input.fullName ?? null,
    subscriptionTier: input.subscriptionTier ?? null,
  });

  if (!row) {
    throw new Error("Failed to create journal");
  }

  return fromConvexJournal(row);
};

export const attachOrphanJournalData = async (userId: string, journalId: string) => {
  if (!convexClient) return { trades: 0, history: 0, sessions: 0 };
  return await convexClient.mutation(api.tradingJournals.attachOrphanData, {
    userId,
    journalId: journalId as Id<"tradingAccounts">,
  });
};

export const deleteTradingJournal = async (userId: string, journalId: string) => {
  if (!convexClient) {
    throw new Error("Convex client unavailable");
  }

  return await convexClient.mutation(api.tradingJournals.remove, {
    userId,
    id: journalId as Id<"tradingAccounts">,
  });
};

export const getTradingJournalLimits = async (
  userId: string,
  subscriptionTier?: string | null,
) => {
  if (!convexClient) {
    const limit = getJournalLimit(subscriptionTier);
    return { tier: subscriptionTier ?? "free", limit, activeCount: 0, canCreate: true };
  }

  return await convexClient.query(api.tradingJournals.getLimits, {
    userId,
    subscriptionTier: subscriptionTier ?? null,
  });
};

export type JournalId = Id<"tradingAccounts">;

export const asJournalId = (id: string | null | undefined): JournalId | null => {
  if (!id) return null;
  return id as JournalId;
};
