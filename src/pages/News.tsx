import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";

type ImpactFilter = "all" | "high" | "medium" | "low";

const getWeekMeta = (date: Date) => {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  const weekStart = startOfISOWeek(date);
  const weekEnd = addDays(weekStart, 6);
  return {
    weekParam: `${year}-W${String(week).padStart(2, "0")}`,
    label: `Week ${week}`,
    rangeLabel: `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`,
    fromMs: startOfDay(weekStart).getTime(),
    toMs: endOfDay(weekEnd).getTime(),
    days: Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
  };
};

const impactTone = (impact: string) => {
  const value = impact.toLowerCase();
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
};

const News = () => {
  const [impact, setImpact] = useState<ImpactFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const week = useMemo(() => getWeekMeta(calendarAnchor), [calendarAnchor]);
  const isCurrentWeek = useMemo(() => {
    return getWeekMeta(new Date()).weekParam === week.weekParam;
  }, [week.weekParam]);

  const events = useQuery(api.news.listEvents, {
    fromMs: week.fromMs,
    toMs: week.toMs,
    impact: impact === "all" ? null : impact,
    country: null,
  });
  const ingestState = useQuery(api.news.getIngestState, {});

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  };

  const grouped = useMemo(() => {
    const rows = events ?? [];
    return week.days.map((day) => ({
      day,
      items: rows.filter((event) => isSameDay(event.scheduledAtMs, day)),
    }));
  }, [events, week.days]);

  const isLoading = events === undefined;

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

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-4 sm:px-6 md:max-w-3xl">
        <section className="overflow-hidden rounded-2xl bg-secondary p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground">Economic calendar</h2>
              <p className="mt-1 text-xs text-muted-foreground">{week.rangeLabel}</p>
            </div>
            {!isCurrentWeek ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 rounded-lg px-2 text-xs"
                onClick={() => setCalendarAnchor(new Date())}
              >
                This week
              </Button>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              aria-label="Previous week"
              onClick={() => setCalendarAnchor((value) => addWeeks(value, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">{week.label}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">{week.weekParam}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              aria-label="Next week"
              onClick={() => setCalendarAnchor((value) => addWeeks(value, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="rounded-2xl bg-secondary p-2">
          <div className="flex gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
            {(
              [
                { id: "all", label: "All" },
                { id: "high", label: "High" },
                { id: "medium", label: "Medium" },
                { id: "low", label: "Low" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setImpact(filter.id)}
                className={cn(
                  "h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition-all active:scale-[0.98] sm:px-4 sm:text-sm",
                  impact === filter.id
                    ? "bg-background text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : (events?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-secondary px-6 py-14 text-center">
            <CalendarDays className="mb-3 h-12 w-12 opacity-30" />
            <p className="font-semibold text-foreground">No events this week</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Try another week, or wait for the next calendar ingest.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ day, items }) => {
              if (items.length === 0) return null;
              const isToday = isSameDay(day, new Date());
              return (
                <section key={day.toISOString()} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {format(day, "EEEE, MMM d")}
                    </h3>
                    {isToday ? (
                      <Badge className="rounded-md bg-brand text-[10px] text-brand-foreground hover:bg-brand">
                        Today
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const tone = impactTone(item.impact);
                      return (
                        <article
                          key={item.id}
                          className="rounded-2xl bg-secondary p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-lg text-[10px] font-semibold uppercase tracking-wide",
                                    tone === "high" && "border-red-500/40 text-red-400",
                                    tone === "medium" && "border-amber-500/40 text-amber-400",
                                    tone === "low" && "border-border text-muted-foreground",
                                    item.impact.toLowerCase() === "holiday" &&
                                      "border-sky-500/40 text-sky-400",
                                  )}
                                >
                                  {item.impact}
                                </Badge>
                                <span className="rounded-md bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground">
                                  {item.country}
                                </span>
                                <span className="text-[11px] tabular-nums text-muted-foreground">
                                  {format(item.scheduledAtMs, "HH:mm")} UTC
                                </span>
                              </div>
                              <h4 className="text-base font-semibold leading-snug text-foreground">
                                {item.event}
                              </h4>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-xl bg-background px-2 py-2">
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Actual
                                  </p>
                                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                                    {item.actual ?? "—"}
                                    {item.actual && item.unit ? item.unit : ""}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-background px-2 py-2">
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Forecast
                                  </p>
                                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                                    {item.estimate ?? "—"}
                                    {item.estimate && item.unit ? item.unit : ""}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-background px-2 py-2">
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Previous
                                  </p>
                                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                                    {item.previous ?? "—"}
                                    {item.previous && item.unit ? item.unit : ""}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default News;
