import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  addDays,
  addWeeks,
  endOfDay,
  format,
  formatDistanceToNow,
  getISOWeek,
  getISOWeekYear,
  isSameDay,
  startOfDay,
  startOfISOWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";

type ImpactFilter = "all" | "high" | "medium" | "low";

type CalendarEvent = {
  id: string;
  country: string;
  event: string;
  impact: string;
  scheduledAtMs: number;
  actual: string | null;
  estimate: string | null;
  previous: string | null;
  unit: string | null;
};

const PAGE_SIZE = 12;

const getWeekMeta = (date: Date) => {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  const weekStart = startOfISOWeek(date);
  const weekEnd = addDays(weekStart, 6);
  return {
    weekParam: `${year}-W${String(week).padStart(2, "0")}`,
    label: `Week ${week}`,
    rangeLabel: `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d")}`,
    fromMs: startOfDay(weekStart).getTime(),
    toMs: endOfDay(weekEnd).getTime(),
    days: Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
  };
};

const impactTone = (impact: string) => {
  const value = impact.toLowerCase();
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "holiday") return "holiday";
  return "low";
};

const formatValue = (value: string | null, unit: string | null) => {
  if (!value) return "—";
  return unit ? `${value}${unit}` : value;
};

const News = () => {
  const [impact, setImpact] = useState<ImpactFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const week = useMemo(() => getWeekMeta(calendarAnchor), [calendarAnchor]);
  const isCurrentWeek = useMemo(
    () => getWeekMeta(new Date()).weekParam === week.weekParam,
    [week.weekParam],
  );

  const events = useQuery(api.news.listEvents, {
    fromMs: week.fromMs,
    toMs: week.toMs,
    impact: null,
    country: null,
  });
  const ingestState = useQuery(api.news.getIngestState, {});

  // Keep selected day inside the visible week; prefer today when available.
  useEffect(() => {
    const today = startOfDay(new Date());
    const inWeek = week.days.some((day) => isSameDay(day, selectedDay));
    if (inWeek) return;
    const preferred = week.days.find((day) => isSameDay(day, today)) ?? week.days[0];
    setSelectedDay(preferred);
  }, [week.days, selectedDay]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedDay, impact, week.weekParam]);

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  };

  const dayCounts = useMemo(() => {
    const rows = events ?? [];
    return week.days.map((day) => ({
      day,
      count: rows.filter((event) => isSameDay(event.scheduledAtMs, day)).length,
    }));
  }, [events, week.days]);

  const dayEvents = useMemo(() => {
    const rows = (events ?? []) as CalendarEvent[];
    return rows.filter((event) => isSameDay(event.scheduledAtMs, selectedDay));
  }, [events, selectedDay]);

  const impactCounts = useMemo(() => {
    const rows = dayEvents;
    return {
      all: rows.length,
      high: rows.filter((row) => impactTone(row.impact) === "high").length,
      medium: rows.filter((row) => impactTone(row.impact) === "medium").length,
      low: rows.filter((row) => {
        const tone = impactTone(row.impact);
        return tone === "low" || tone === "holiday";
      }).length,
    };
  }, [dayEvents]);

  const filteredDayEvents = useMemo(() => {
    if (impact === "all") return dayEvents;
    return dayEvents.filter((event) => {
      const tone = impactTone(event.impact);
      if (impact === "low") return tone === "low" || tone === "holiday";
      return tone === impact;
    });
  }, [dayEvents, impact]);

  const visibleEvents = filteredDayEvents.slice(0, visibleCount);
  const hasMore = filteredDayEvents.length > visibleCount;
  const isLoading = events === undefined;
  const isToday = isSameDay(selectedDay, new Date());

  const shiftWeek = (delta: number) => {
    setCalendarAnchor((value) => addWeeks(value, delta));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <PageHeader
        title="Calendar"
        subtitle={
          ingestState?.lastIngestAtMs
            ? `Updated ${formatDistanceToNow(ingestState.lastIngestAtMs, { addSuffix: true })}`
            : "Economic releases"
        }
        icon={<CalendarDays className="h-5 w-5" />}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            aria-label="Refresh calendar"
            onClick={handleRefresh}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-4 pb-4 pt-1 sm:px-6 md:max-w-3xl">
        {/* Week + day strip */}
        <section className="rounded-2xl bg-secondary p-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              aria-label="Previous week"
              onClick={() => shiftWeek(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 text-center">
              <p className="font-display text-base font-bold text-foreground">{week.label}</p>
              <p className="text-[11px] text-muted-foreground">{week.rangeLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              {!isCurrentWeek ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-2 text-xs"
                  onClick={() => {
                    const now = new Date();
                    setCalendarAnchor(now);
                    setSelectedDay(startOfDay(now));
                  }}
                >
                  Today
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                aria-label="Next week"
                onClick={() => shiftWeek(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {dayCounts.map(({ day, count }) => {
              const selected = isSameDay(day, selectedDay);
              const today = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(startOfDay(day))}
                  className={cn(
                    "flex flex-col items-center rounded-xl px-1 py-2 transition-all active:scale-[0.97]",
                    selected
                      ? "bg-brand text-brand-foreground"
                      : "bg-background/70 text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={selected}
                  aria-label={format(day, "EEEE, MMMM d")}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 font-display text-sm font-bold tabular-nums",
                      selected ? "text-brand-foreground" : "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <span
                    className={cn(
                      "mt-1 h-1 w-1 rounded-full",
                      count > 0
                        ? selected
                          ? "bg-brand-foreground/80"
                          : today
                            ? "bg-brand"
                            : "bg-muted-foreground/50"
                        : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </section>

        {/* Impact filter */}
        <section className="flex gap-1 overflow-x-auto rounded-2xl bg-secondary p-1.5 [-webkit-overflow-scrolling:touch]">
          {(
            [
              { id: "all", label: "All", count: impactCounts.all },
              { id: "high", label: "High", count: impactCounts.high },
              { id: "medium", label: "Med", count: impactCounts.medium },
              { id: "low", label: "Low", count: impactCounts.low },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setImpact(filter.id)}
              className={cn(
                "flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-all active:scale-[0.98]",
                impact === filter.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <span>{filter.label}</span>
              {!isLoading ? (
                <span
                  className={cn(
                    "tabular-nums text-[10px]",
                    impact === filter.id ? "text-foreground/70" : "text-muted-foreground/70",
                  )}
                >
                  {filter.count}
                </span>
              ) : null}
            </button>
          ))}
        </section>

        {/* Day headline */}
        <div className="flex items-end justify-between gap-3 px-0.5 pt-1">
          <div>
            <p className="font-display text-lg font-bold text-foreground">
              {isToday ? "Today" : format(selectedDay, "EEEE")}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(selectedDay, "MMMM d, yyyy")}
              {!isLoading ? ` · ${filteredDayEvents.length} events` : null}
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Local time</p>
        </div>

        {/* Event feed */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} className="h-[4.5rem] w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredDayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-secondary px-6 py-16 text-center">
            <CalendarDays className="mb-3 h-10 w-10 opacity-30" />
            <p className="font-semibold text-foreground">No events</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {impact === "all"
                ? "Nothing scheduled for this day."
                : `No ${impact}-impact releases on this day.`}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-secondary">
            <ul className="divide-y divide-border/50">
              {visibleEvents.map((item) => {
                const tone = impactTone(item.impact);
                return (
                  <li key={item.id} className="relative px-3 py-3.5 sm:px-4">
                    <div
                      className={cn(
                        "absolute inset-y-3 left-0 w-0.5 rounded-full",
                        tone === "high" && "bg-red-500",
                        tone === "medium" && "bg-amber-500",
                        tone === "low" && "bg-muted-foreground/35",
                        tone === "holiday" && "bg-sky-500",
                      )}
                      aria-hidden
                    />
                    <div className="flex items-start gap-3 pl-2">
                      <div className="w-12 shrink-0 pt-0.5 text-center">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {format(item.scheduledAtMs, "HH:mm")}
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-[10px] font-bold uppercase tracking-wide",
                            tone === "high" && "text-red-400",
                            tone === "medium" && "text-amber-400",
                            tone === "low" && "text-muted-foreground",
                            tone === "holiday" && "text-sky-400",
                          )}
                        >
                          {tone === "holiday" ? "Off" : tone}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-foreground">
                            {item.country}
                          </span>
                          <h3 className="truncate text-sm font-semibold leading-snug text-foreground">
                            {item.event}
                          </h3>
                        </div>

                        {tone !== "holiday" ? (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Actual
                              </p>
                              <p className="text-xs font-semibold tabular-nums text-foreground">
                                {formatValue(item.actual, item.unit)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Forecast
                              </p>
                              <p className="text-xs font-semibold tabular-nums text-foreground">
                                {formatValue(item.estimate, item.unit)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Previous
                              </p>
                              <p className="text-xs font-semibold tabular-nums text-foreground">
                                {formatValue(item.previous, item.unit)}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {hasMore ? (
              <div className="border-t border-border/50 p-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full rounded-xl text-sm"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Show more ({filteredDayEvents.length - visibleCount} left)
                </Button>
              </div>
            ) : filteredDayEvents.length > PAGE_SIZE ? (
              <div className="border-t border-border/50 px-3 py-2.5 text-center text-[11px] text-muted-foreground">
                Showing all {filteredDayEvents.length} events
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
};

export default News;
