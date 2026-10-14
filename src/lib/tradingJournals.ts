import { getAuthenticatedConvexHttpClient } from "@/lib/convexClient";
import { getConvexAuthTokenMirror } from "@/lib/authTokenStore";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { SubscriptionTier } from "@/contexts/SubscriptionContext";

export const JOURNAL_LIMITS = {
  free: 1,
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
  isReadOnly?: boolean;
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
  if (tier === "pro") return JOURNAL_LIMITS.pro;
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
  isReadOnly?: boolean;
}): TradingJournal => ({
  id: row._id,
  isReadOnly: row.isReadOnly,
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
  const token = getConvexAuthTokenMirror();
  if (!token) throw new Error("Your session is not ready. Please try again.");

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await fetch("/api/journal-book", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ journalId }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; done?: boolean; message?: string }
      | null;

    if (!response.ok && response.status !== 202) {
      throw new Error(payload?.message || `Could not delete journal (${response.status})`);
    }
    if (payload?.done) return { success: true };
  }

  throw new Error(
    "Journal deletion is taking longer than expected. Your journal is archived and cleanup can be resumed safely.",
  );
};

export const getTradingJournalLimits = async (
  _userId: string,
  _subscriptionTier?: string | null,
) => {
  const client = getAuthenticatedConvexHttpClient();

  return await client.query(api.tradingJournals.getLimits, {});
};

export type JournalId = Id<"tradingAccounts">;

export const asJournalId = (id: string | null | undefined): JournalId | null => {
  if (!id) return null;
  return id as JournalId;
};
