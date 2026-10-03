import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import {
  addDays,
  endOfDay,
  format,
  formatDistanceToNow,
  isSameDay,
  startOfDay,
  startOfISOWeek,
} from "date-fns";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../convex/_generated/api";
import {
  currencyLabel,
  dayKind,
  impactSummary,
  impactTone,
  isForexFactoryDetailUrl,
  type ImpactTone,
  releaseVerdict,
  shortRelative,
  splitDayReleases,
  formatZoneClock,
  toneLabel,
  type DayKind,
} from "@/lib/calendarRelease";
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
  detailUrl?: string | null;
};

const EARLIER_PAGE = 8;
const FETCH_INTERVAL_MS = 2 * 60 * 1000;

/** Three days, centered on the selection, so the strip is the same width on every phone. */
const visibleDaysFor = (selected: Date) =>
  [-1, 0, 1].map((offset) => addDays(selected, offset));

const loadedRangeFor = (selected: Date) => {
  const weekStart = startOfISOWeek(selected);
  return {
    fromMs: startOfDay(addDays(weekStart, -1)).getTime(),
    toMs: endOfDay(addDays(weekStart, 7)).getTime(),
  };
};

const formatValue = (value: string | null, unit: string | null) => {
  if (!value) return "—";
  return unit ? `${value}${unit}` : value;
};

const timerParts = (label: string) => {
  if (label.startsWith("In ")) return { kicker: "In", value: label.slice(3) };
  if (label.endsWith(" ago")) return { kicker: "Ago", value: label.slice(0, -4) };
  return { kicker: null, value: label };
};

const dotClass = (tone: ImpactTone, muted: boolean) => {
  if (muted) return "bg-muted-foreground/40";
  switch (tone) {
    case "high":
      return "bg-destructive";
    case "medium":
      return "bg-amber-500";
    case "holiday":
      return "bg-sky-500";
    case "low":
      return "bg-muted-foreground/50";
    default: {
      const exhaustive: never = tone;
      return exhaustive;
    }
  }
};

const ReleaseFigures = ({ event, className }: { event: CalendarEvent; className?: string }) => {
  const tone = impactTone(event.impact);
  const verdict = releaseVerdict(event.actual, event.estimate);
  const detailUrl = isForexFactoryDetailUrl(event.detailUrl) ? event.detailUrl : null;

  if (tone === "holiday") {
    return (
      <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
        {impactSummary(tone)}
      </p>
    );
  }

  const figures = [
    { label: "Actual", value: formatValue(event.actual, event.unit), primary: true },
    { label: "Forecast", value: formatValue(event.estimate, event.unit), primary: false },
    { label: "Previous", value: formatValue(event.previous, event.unit), primary: false },
  ] as const;

  return (
    <div className={cn("space-y-2", className)}>
      <dl className="grid grid-cols-3 gap-2">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {figure.label}
            </dt>
            <dd
              className={cn(
                "mt-0.5 break-words tabular-nums text-foreground",
                figure.primary ? "text-base font-semibold" : "text-sm font-medium text-foreground/80",
              )}
            >
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">{impactSummary(tone)}</p>
        {verdict ? <p className="text-xs font-medium text-foreground">{verdict}</p> : null}
      </div>
      {detailUrl ? (
        <a
          href={detailUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand"
        >
          More on Forex Factory
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      ) : null}
    </div>
  );
};

const News = () => {
  const [impact, setImpact] = useState<ImpactFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [earlierCount, setEarlierCount] = useState(EARLIER_PAGE);
  const pulling = useRef(false);
  const refreshCalendar = useAction(api.news.refreshCalendar);

  const range = useMemo(() => loadedRangeFor(selectedDay), [selectedDay]);
  const visibleDays = useMemo(() => visibleDaysFor(selectedDay), [selectedDay]);

  const events = useQuery(api.news.listEvents, {
    fromMs: range.fromMs,
    toMs: range.toMs,
    impact: null,
    country: null,
  });
  const ingestState = useQuery(api.news.getIngestState, {});

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const pull = async () => {
      if (pulling.current) return;
      pulling.current = true;
      try {
        await refreshCalendar({ force: false });
        setNowMs(Date.now());
      } catch {
        // The last events stay on screen. The ingest row records a delayed update.
      } finally {
        pulling.current = false;
      }
    };

    void pull();
    const timer = window.setInterval(() => void pull(), FETCH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshCalendar]);

  useEffect(() => {
    setExpandedId(null);
    setEarlierCount(EARLIER_PAGE);
  }, [selectedDay, impact]);

  const handleRefresh = async () => {
    if (pulling.current) return;
    pulling.current = true;
    setRefreshing(true);
    try {
      await refreshCalendar({ force: true });
      setNowMs(Date.now());
    } catch {
      // Same as the automatic pull: keep the current list.
    } finally {
      pulling.current = false;
      setRefreshing(false);
    }
  };

  const dayCounts = useMemo(() => {
    const rows = events ?? [];
    return visibleDays.map((day) => ({
      day,
      count: rows.filter((event) => isSameDay(event.scheduledAtMs, day)).length,
    }));
  }, [events, visibleDays]);

  const filteredDayEvents = useMemo(() => {
    const rows = ((events ?? []) as CalendarEvent[]).filter((event) =>
      isSameDay(event.scheduledAtMs, selectedDay),
    );
    if (impact === "all") return rows;
    return rows.filter((event) => {
      const tone = impactTone(event.impact);
      if (impact === "low") return tone === "low" || tone === "holiday";
      return tone === impact;
    });
  }, [events, impact, selectedDay]);

  const selectedKind: DayKind = dayKind(selectedDay.getTime(), nowMs);
  const { current, earlier } = useMemo(
    () => splitDayReleases(filteredDayEvents, nowMs, selectedKind),
    [filteredDayEvents, nowMs, selectedKind],
  );

  const impactCounts = useMemo(() => {
    const rows = ((events ?? []) as CalendarEvent[]).filter((event) =>
      isSameDay(event.scheduledAtMs, selectedDay),
    );
    return {
      all: rows.length,
      high: rows.filter((row) => impactTone(row.impact) === "high").length,
      medium: rows.filter((row) => impactTone(row.impact) === "medium").length,
      low: rows.filter((row) => {
        const tone = impactTone(row.impact);
        return tone === "low" || tone === "holiday";
      }).length,
    };
  }, [events, selectedDay]);

  const featured =
    current.find((event) => event.scheduledAtMs > nowMs) ??
    [...current].reverse().find((event) => event.scheduledAtMs <= nowMs) ??
    null;
  const featuredTimer = featured ? timerParts(shortRelative(featured.scheduledAtMs, nowMs)) : null;
  const alsoCurrent = featured ? current.filter((event) => event.id !== featured.id) : current;
  const visibleEarlier = earlier.slice(0, earlierCount);
  const hiddenEarlier = Math.max(earlier.length - visibleEarlier.length, 0);
  const isLoading = events === undefined;
  const isToday = selectedKind === "today";
  const currentHeading = selectedKind === "future" ? "Scheduled" : "Recent";

  const shiftDay = (delta: number) => {
    setSelectedDay((day) => startOfDay(addDays(day, delta)));
  };

  const goToToday = () => {
    setSelectedDay(startOfDay(new Date()));
  };

  return (
    <div className="flex min-h-full w-full min-w-0 flex-col overflow-x-clip bg-background">
      <PageHeader
        title="News"
        subtitle="Recent releases"
        className="px-4 sm:px-6 lg:px-8"
        containerClassName="lg:max-w-5xl"
        icon={<CalendarDays className="h-5 w-5" />}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl"
            aria-label="Refresh calendar"
            onClick={handleRefresh}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        }
      />

      <main
        id="main-content"
        className="mx-auto w-full min-w-0 max-w-2xl flex-1 space-y-5 px-4 pb-8 sm:px-6 md:max-w-3xl lg:max-w-5xl lg:px-8"
      >
        <p className="text-xs text-muted-foreground">
          Forex Factory
          {ingestState?.lastIngestAtMs
            ? ` · updated ${formatDistanceToNow(ingestState.lastIngestAtMs, { addSuffix: true })}`
            : ""}
          {ingestState?.hasError ? " · update delayed" : ""}
        </p>

        <section className="space-y-3">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl"
              aria-label="Previous day"
              onClick={() => shiftDay(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate font-display text-base font-semibold text-foreground">
                {isToday ? "Today" : format(selectedDay, "EEEE")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {format(visibleDays[0], "MMM d")} – {format(visibleDays[2], "MMM d")}
              </p>
            </div>
            <div className="flex shrink-0 items-center">
              {!isToday ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 rounded-xl px-2.5 text-xs"
                  onClick={goToToday}
                >
                  Today
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-xl"
                aria-label="Next day"
                onClick={() => shiftDay(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {dayCounts.map(({ day, count }) => {
              const selected = isSameDay(day, selectedDay);
              const today = isSameDay(day, nowMs);
              const passed = dayKind(day.getTime(), nowMs) === "past";
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(startOfDay(day))}
                  className={cn(
                    "flex min-h-16 min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2 transition-colors",
                    selected
                      ? "bg-brand text-brand-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                    !selected && passed && "text-muted-foreground/60",
                    !selected && today && "ring-1 ring-brand/40",
                  )}
                  aria-pressed={selected}
                  aria-current={today ? "date" : undefined}
                  aria-label={format(day, "EEEE, MMMM d")}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "font-display text-lg font-semibold tabular-nums",
                      selected ? "text-brand-foreground" : "text-foreground",
                      !selected && passed && "text-muted-foreground/70",
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
                          : "bg-brand"
                        : "bg-transparent",
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </section>

        <div
          className="grid grid-cols-4 gap-1 rounded-2xl bg-secondary p-1"
          role="group"
          aria-label="Filter by impact"
        >
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
                "flex h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold",
                impact === filter.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
              aria-pressed={impact === filter.id}
            >
              <span className="truncate">{filter.label}</span>
              {!isLoading ? (
                <span className="tabular-nums text-[10px] text-muted-foreground">{filter.count}</span>
              ) : null}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-56 w-full rounded-3xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : filteredDayEvents.length === 0 ? (
          <div className="px-2 py-16 text-center">
            <p className="font-medium text-foreground">No releases</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              {impact === "all"
                ? "Nothing is scheduled for this day."
                : `No ${impact} impact releases on this day.`}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {current.length > 0 ? (
              <section className="space-y-3" aria-label={currentHeading}>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      {currentHeading}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {isToday
                        ? "Upcoming and just released"
                        : format(selectedDay, "EEEE, MMMM d")}
                    </p>
                  </div>
                  <p className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Local time
                  </p>
                </div>

                {featured ? (
                  <article className="rounded-3xl bg-secondary px-4 py-4 sm:px-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                        {isToday ? "Recent" : "Scheduled"}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {featured.scheduledAtMs > nowMs ? "Up next" : "Just released"}
                      </p>
                    </div>
                    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-start gap-x-3 sm:gap-x-4">
                      <div className="border-r border-border/70 pr-3">
                        {featuredTimer?.kicker ? (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {featuredTimer.kicker}
                          </p>
                        ) : null}
                        <p className="font-display text-2xl font-semibold leading-none tracking-tight text-foreground">
                          {featuredTimer?.value}
                        </p>
                        <p className="mt-3 text-sm font-semibold tabular-nums text-foreground">
                          {format(featured.scheduledAtMs, "HH:mm")}
                        </p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {formatZoneClock(featured.scheduledAtMs, "America/New_York")} ET
                        </p>
                      </div>
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-semibold leading-snug text-foreground sm:text-lg">
                          {featured.event}
                        </h3>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{featured.country}</span>
                          <span className="mx-1.5 text-border" aria-hidden>
                            ·
                          </span>
                          {currencyLabel(featured.country)}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              dotClass(impactTone(featured.impact), false),
                            )}
                            aria-hidden
                          />
                          {toneLabel(impactTone(featured.impact))}
                        </p>
                      </div>
                    </div>
                    <ReleaseFigures
                      event={featured}
                      className="mt-4 border-t border-border/60 pt-3"
                    />
                  </article>
                ) : null}

                {alsoCurrent.length > 0 ? (
                  <ul>
                    {alsoCurrent.map((item) => {
                      const tone = impactTone(item.impact);
                      const open = expandedId === item.id;
                      const recent = item.scheduledAtMs <= nowMs;
                      return (
                        <li
                          key={item.id}
                          className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-3 border-b border-border/60 py-3"
                        >
                          <button
                            type="button"
                            className="col-span-2 grid grid-cols-subgrid items-start text-left"
                            aria-expanded={open}
                            onClick={() => setExpandedId(open ? null : item.id)}
                          >
                            <span className="border-r border-border/60 pr-3">
                              <span className="block text-sm font-semibold tabular-nums text-foreground">
                                {format(item.scheduledAtMs, "HH:mm")}
                              </span>
                              <span className="mt-0.5 block text-xs font-medium text-brand">
                                {recent ? "Recent" : shortRelative(item.scheduledAtMs, nowMs)}
                              </span>
                            </span>
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">{item.country}</span>
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className={cn("h-1.5 w-1.5 rounded-full", dotClass(tone, false))}
                                    aria-hidden
                                  />
                                  {toneLabel(tone)}
                                </span>
                              </span>
                              <span className="mt-1 block break-words text-sm font-medium leading-snug text-foreground">
                                {item.event}
                              </span>
                            </span>
                          </button>
                          {open ? (
                            <div className="col-start-2 pb-1">
                              <ReleaseFigures event={item} className="pt-1" />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            ) : (
              <div className="px-1">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {isToday ? "Recent" : "Passed"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isToday
                    ? "Nothing current left today. Earlier releases are faded below."
                    : "This day has passed. Earlier releases stay faded."}
                </p>
              </div>
            )}

            {earlier.length > 0 ? (
              <section className="space-y-1" aria-label="Earlier releases">
                <div className="px-0.5">
                  <h2 className="text-sm font-medium text-muted-foreground">Earlier</h2>
                  <p className="text-xs text-muted-foreground/80">Passed releases, faded</p>
                </div>
                <ul>
                  {visibleEarlier.map((item) => {
                    const tone = impactTone(item.impact);
                    return (
                      <li
                        key={item.id}
                        aria-disabled="true"
                        className="pointer-events-none grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-3 border-t border-border/40 py-3 opacity-50"
                      >
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {format(item.scheduledAtMs, "HH:mm")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm leading-snug text-muted-foreground">
                            <span className="mr-2 text-xs font-semibold">{item.country}</span>
                            {item.event}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {toneLabel(tone)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {hiddenEarlier > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full rounded-xl text-sm text-muted-foreground"
                    onClick={() => setEarlierCount((count) => count + EARLIER_PAGE)}
                  >
                    Show {hiddenEarlier} more passed
                  </Button>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
};

export default News;
