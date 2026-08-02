import { getAuthenticatedConvexHttpClient } from "@/lib/convexClient";
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

export const listTradingJournals = async (_userId: string): Promise<TradingJournal[]> => {
  const client = getAuthenticatedConvexHttpClient();
  const rows = await client.query(api.tradingJournals.listForUser, {});
  return rows.map(fromConvexJournal);
};

export const createTradingJournal = async (
  _userId: string,
  input: CreateJournalInput,
): Promise<TradingJournal> => {
  const client = getAuthenticatedConvexHttpClient();

  const row = await client.mutation(api.tradingJournals.create, {
    name: input.name,
    currency: input.currency,
    startingBalance: input.startingBalance,
    fullName: input.fullName ?? null,
  });

  if (!row) {
    throw new Error("Failed to create journal");
  }

  return fromConvexJournal(row);
};

export const attachOrphanJournalData = async (_userId: string, journalId: string) => {
  const client = getAuthenticatedConvexHttpClient();
  return await client.mutation(api.tradingJournals.attachOrphanData, {
    journalId: journalId as Id<"tradingAccounts">,
  });
};

export const deleteTradingJournal = async (_userId: string, journalId: string) => {
  const client = getAuthenticatedConvexHttpClient();

  return await client.mutation(api.tradingJournals.remove, {
    id: journalId as Id<"tradingAccounts">,
  });
};

export const getTradingJournalLimits = async (
  _userId: string,
  subscriptionTier?: string | null,
) => {
  const client = getAuthenticatedConvexHttpClient();

  // Tier is derived server-side from the authenticated user — never trust client tier.
  try {
    return await client.query(api.tradingJournals.getLimits, {});
  } catch {
    const limit = getJournalLimit(subscriptionTier);
    return { tier: subscriptionTier ?? "free", limit, activeCount: 0, canCreate: true };
  }
};

export type JournalId = Id<"tradingAccounts">;

export const asJournalId = (id: string | null | undefined): JournalId | null => {
  if (!id) return null;
  return id as JournalId;
};
