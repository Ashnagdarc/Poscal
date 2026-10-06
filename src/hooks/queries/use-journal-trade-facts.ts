import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";

import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import { fromConvexTrade, type JournalTrade } from "@/lib/convexJournal";
import type { MonthlyReturnsGrid, ResultDaySummary } from "@/lib/historyResults";

type MonthSummaryResult = {
  ready: boolean;
  days: Array<{
    dateKey: string;
    tradeCount: number;
    pnl: number;
    wins: number;
    losses: number;
    breakeven: number;
  }>;
};

type MonthlyReturnsResult = {
  ready: boolean;
  years: number[];
  returns: number[][];
};

type StatusResult = {
  ready: boolean;
  currentVersion: number;
  sourceVersion: number | null;
  status: "running" | "complete" | "failed" | null;
} | null;

const formatPnlLabel = (value: number) => {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : 1;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${abs.toFixed(digits)}`;
};

export const useJournalTradeFacts = ({
  calendarMonth,
  selectedMonthKey,
  selectedDateKey,
  timeZone,
}: {
  calendarMonth: Date;
  selectedMonthKey?: string;
  selectedDateKey?: string;
  timeZone?: string | null;
}) => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const ensure = useMutation(anyApi.journalTradeFacts.ensureForJournal);
  const requestedVersion = useRef<string | null>(null);
  const enabled = Boolean(user?.id && activeJournalId);

  const status = useQuery(
    anyApi.journalTradeFacts.getStatus,
    enabled ? { journalId: activeJournalId } : "skip",
  ) as StatusResult | undefined;

  useEffect(() => {
    if (!enabled || !activeJournalId || status === undefined) return;
    if (status?.ready) {
      requestedVersion.current = null;
      return;
    }

    const key = `${activeJournalId}:${status?.currentVersion ?? 0}`;
    if (requestedVersion.current === key) return;
    requestedVersion.current = key;

    void ensure({ journalId: activeJournalId }).catch((error) => {
      requestedVersion.current = null;
      console.error("[journal-facts] Failed to start facts backfill", error);
    });
  }, [activeJournalId, enabled, ensure, status]);

  const ready = Boolean(status?.ready);

  const month = useQuery(
    anyApi.journalTradeFacts.getMonthSummary,
    ready && activeJournalId
      ? {
          journalId: activeJournalId,
          year: calendarMonth.getFullYear(),
          month: calendarMonth.getMonth() + 1,
          timeZone: timeZone ?? null,
        }
      : "skip",
  ) as MonthSummaryResult | undefined;

  const monthlyReturns = useQuery(
    anyApi.journalTradeFacts.getMonthlyReturns,
    ready && activeJournalId
      ? {
          journalId: activeJournalId,
          timeZone: timeZone ?? null,
          lookbackYears: 5,
        }
      : "skip",
  ) as MonthlyReturnsResult | undefined;

  const selection = useQuery(
    anyApi.journalTradeFacts.listForSelection,
    ready && activeJournalId && (selectedMonthKey || selectedDateKey)
      ? {
          journalId: activeJournalId,
          monthKey: selectedMonthKey ?? null,
          dateKey: selectedDateKey ?? null,
          timeZone: timeZone ?? null,
        }
      : "skip",
  ) as any[] | undefined;

  const daySummaries = useMemo(() => {
    const map = new Map<string, ResultDaySummary>();
    for (const day of month?.days ?? []) {
      map.set(day.dateKey, {
        dateKey: day.dateKey,
        tradeCount: day.tradeCount,
        tone: day.pnl > 0 ? "positive" : day.pnl < 0 ? "negative" : "neutral",
        label: formatPnlLabel(day.pnl),
      });
    }
    return map;
  }, [month]);

  const grid = useMemo<MonthlyReturnsGrid>(
    () => ({
      years: monthlyReturns?.years ?? [],
      returns: monthlyReturns?.returns ?? [],
    }),
    [monthlyReturns],
  );

  const selectedTrades = useMemo<JournalTrade[]>(
    () => (selection ?? []).map((row) => fromConvexTrade(row)),
    [selection],
  );

  return {
    ready,
    isBackfilling: Boolean(enabled && status && !status.ready),
    daySummaries,
    monthlyReturns: grid,
    selectedTrades,
    isSelectionLoading: Boolean(ready && (selectedMonthKey || selectedDateKey) && selection === undefined),
  };
};
