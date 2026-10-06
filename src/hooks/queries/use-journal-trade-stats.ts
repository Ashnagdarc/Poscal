import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";

import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";

export type JournalTradeStatsSnapshot = {
  sourceVersion: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  cancelledTrades: number;
  closedWithPnl: number;
  wins: number;
  losses: number;
  breakeven: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  winPnlSum: number;
  lossAbsSum: number;
  bestTrade: number | null;
  worstTrade: number | null;
  rCount: number;
  rSum: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxDrawdown: number;
  processedTrades: number;
  updatedAtMs: number;
};

type StatsQueryResult = {
  stats: JournalTradeStatsSnapshot | null;
  stale: boolean;
  sourceVersion: number;
} | null;

/**
 * Reads the materialized lifetime trade stats for the active journal.
 * If missing/stale, starts an idempotent batched backfill. Existing trade rows
 * are read-only during this process.
 */
export const useJournalTradeStats = () => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const ensure = useMutation(anyApi.journalTradeStats.ensureForJournal);
  const requestedKey = useRef<string | null>(null);

  const enabled = Boolean(user?.id && activeJournalId);
  const result = useQuery(
    anyApi.journalTradeStats.getForJournal,
    enabled ? { journalId: activeJournalId } : "skip",
  ) as StatsQueryResult | undefined;

  useEffect(() => {
    if (!enabled || !activeJournalId || result === undefined) return;
    if (result && !result.stale && result.stats) {
      requestedKey.current = null;
      return;
    }

    const version = result?.sourceVersion ?? 0;
    const key = `${activeJournalId}:${version}`;
    if (requestedKey.current === key) return;
    requestedKey.current = key;

    void ensure({ journalId: activeJournalId }).catch((error) => {
      requestedKey.current = null;
      console.error("[journal-stats] Failed to start analytics backfill", error);
    });
  }, [activeJournalId, enabled, ensure, result]);

  return {
    stats: result?.stats ?? null,
    isLoading: enabled && result === undefined,
    isBackfilling: Boolean(enabled && result && (result.stale || !result.stats)),
    stale: result?.stale ?? false,
  };
};
