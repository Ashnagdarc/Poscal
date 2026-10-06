import { useMemo } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";

import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
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
