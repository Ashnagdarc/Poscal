import { useMemo } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";

import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import { fromConvexTrade, type JournalTrade } from "@/lib/convexJournal";
import type { JournalCalendarDay } from "@/lib/journalCalendar";

type CalendarMonthResult = {
  days: JournalCalendarDay[];
};

export const useJournalCalendar = ({
  month,
  timeZone,
}: {
  month: Date;
  timeZone?: string | null;
}) => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const enabled = Boolean(user?.id && activeJournalId);

  const result = useQuery(
    anyApi.journalCalendar.getMonth,
    enabled && activeJournalId
      ? {
          journalId: activeJournalId,
          year: month.getFullYear(),
          month: month.getMonth() + 1,
          timeZone: timeZone ?? null,
        }
      : "skip",
  ) as CalendarMonthResult | undefined;

  const dayMap = useMemo(() => {
    const map = new Map<string, JournalCalendarDay>();
    for (const day of result?.days ?? []) map.set(day.dateKey, day);
    return map;
  }, [result]);

  return {
    dayMap,
    isLoading: enabled && result === undefined,
  };
};


export const useJournalDayEntries = ({
  dateKey,
  timeZone,
}: {
  dateKey?: string | null;
  timeZone?: string | null;
}) => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const enabled = Boolean(user?.id && activeJournalId && dateKey);

  const rows = useQuery(
    anyApi.journalCalendar.getDayEntries,
    enabled && activeJournalId && dateKey
      ? {
          journalId: activeJournalId,
          dateKey,
          timeZone: timeZone ?? null,
        }
      : "skip",
  ) as any[] | undefined;

  const trades = useMemo<JournalTrade[]>(
    () => (rows ?? []).map((row) => fromConvexTrade(row)),
    [rows],
  );

  return {
    trades,
    isLoading: enabled && rows === undefined,
  };
};
