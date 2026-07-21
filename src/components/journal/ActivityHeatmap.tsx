import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  formatProgressDateKey,
  type HeatmapDay,
  type HeatmapTone,
} from "@/lib/progressSessions";

interface HeatmapWeekColumn {
  key: string;
  monthLabel: string | null;
  isMonthStart: boolean;
  days: Array<HeatmapDay | null>;
}

const Y_AXIS_LABELS = [
  { row: 0, label: "Mon", short: "M" },
  { row: 2, label: "Wed", short: "W" },
  { row: 4, label: "Fri", short: "F" },
  { row: 6, label: "Sun", short: "S" },
] as const;

const parseDateKey = (dateKey: string) => new Date(`${dateKey}T12:00:00`);

const formatHeatmapTooltip = (day: HeatmapDay) => {
  const date = parseDateKey(day.dateKey);
  const label = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const toneLabels: Record<HeatmapTone, string> = {
    none: "No activity",
    journal: "Journal logged",
    tasks_partial: "Tasks in progress",
    tasks_complete: "Tasks completed",
    profit: "Profitable day",
    breakeven: "Breakeven day",
    loss: "Losing day",
  };

  return `${label} · ${toneLabels[day.tone]}`;
};

const buildHeatmapWeekColumns = (days: HeatmapDay[]): HeatmapWeekColumn[] => {
  if (!days.length) return [];

  const dayMap = new Map(days.map((day) => [day.dateKey, day]));
  const firstDate = parseDateKey(days[0].dateKey);
  const lastDate = parseDateKey(days[days.length - 1].dateKey);
  firstDate.setHours(12, 0, 0, 0);
  lastDate.setHours(12, 0, 0, 0);

  const gridStart = new Date(firstDate);
  const startDow = gridStart.getDay();
  gridStart.setDate(gridStart.getDate() - (startDow === 0 ? 6 : startDow - 1));

  const gridEnd = new Date(lastDate);
  const endDow = gridEnd.getDay();
  if (endDow !== 0) {
    gridEnd.setDate(gridEnd.getDate() + (7 - endDow));
  }

  const columns: HeatmapWeekColumn[] = [];
  const cursor = new Date(gridStart);
  let lastMonth = -1;

  while (cursor <= gridEnd) {
    const weekStart = new Date(cursor);
    const weekDays: Array<HeatmapDay | null> = [];

    for (let index = 0; index < 7; index += 1) {
      const current = new Date(cursor);
      const dateKey = formatProgressDateKey(current);
      const inRange = current >= firstDate && current <= lastDate;
      weekDays.push(inRange ? (dayMap.get(dateKey) ?? { dateKey, tone: "none" }) : null);
      cursor.setDate(cursor.getDate() + 1);
    }

    const month = weekStart.getMonth();
    const isMonthStart = month !== lastMonth;
    const monthLabel = isMonthStart
      ? weekStart.toLocaleDateString("en-US", { month: "short" })
      : null;
    lastMonth = month;

    columns.push({
      key: formatProgressDateKey(weekStart),
      monthLabel,
      isMonthStart,
      days: weekDays,
    });
  }

  return columns;
};

const toneClassName = (tone: HeatmapTone) => {
  switch (tone) {
    case "journal":
      return "bg-orange-500 hover:bg-orange-400";
    case "tasks_partial":
      return "bg-orange-400/90 hover:bg-orange-300";
    case "tasks_complete":
      return "bg-emerald-500 hover:bg-emerald-400";
    case "profit":
      return "bg-emerald-500 hover:bg-emerald-400";
    case "breakeven":
      return "bg-slate-400 hover:bg-slate-300";
    case "loss":
      return "bg-red-500 hover:bg-red-400";
    case "none":
      return "bg-secondary/80 hover:bg-secondary border border-border/60";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
};

interface ActivityHeatmapProps {
  days: HeatmapDay[];
  selectedDateKey: string;
  onSelectDay: (dateKey: string) => void;
}

export const ActivityHeatmap = ({
  days,
  selectedDateKey,
  onSelectDay,
}: ActivityHeatmapProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayKey = formatProgressDateKey(new Date());
  const weekColumns = useMemo(() => buildHeatmapWeekColumns(days), [days]);

  const selectedWeekKey = useMemo(() => {
    const selected = parseDateKey(selectedDateKey);
    const dow = selected.getDay();
    const monday = new Date(selected);
    monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
    return formatProgressDateKey(monday);
  }, [selectedDateKey]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(`[data-week-key="${selectedWeekKey}"]`);
    target?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedWeekKey, weekColumns.length]);

  if (!weekColumns.length) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground">
        Log your first session to start building activity
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
      >
        <div className="inline-flex min-w-full gap-3 px-0.5 sm:gap-4">
          <div className="flex shrink-0 flex-col justify-end gap-[5px] pb-0.5 sm:gap-1.5">
            <div className="h-5 shrink-0 sm:h-6" aria-hidden />
            {Array.from({ length: 7 }, (_, rowIndex) => {
              const axisLabel = Y_AXIS_LABELS.find((item) => item.row === rowIndex);
              return (
                <div
                  key={`y-${rowIndex}`}
                  className="flex h-[13px] items-center sm:h-4 md:h-[18px]"
                >
                  {axisLabel ? (
                    <span className="w-8 text-[10px] font-medium text-muted-foreground sm:w-9 sm:text-[11px]">
                      <span className="sm:hidden">{axisLabel.short}</span>
                      <span className="hidden sm:inline">{axisLabel.label}</span>
                    </span>
                  ) : (
                    <span className="w-8 sm:w-9" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex min-w-max flex-1 gap-[5px] sm:min-w-0 sm:gap-1.5">
            {weekColumns.map((week) => (
              <div
                key={week.key}
                data-week-key={week.key}
                className={cn(
                  "flex min-w-[13px] flex-1 flex-col gap-[5px] sm:min-w-0 sm:gap-1.5",
                  week.isMonthStart && week.key !== weekColumns[0]?.key && "border-l border-border/70 pl-[5px] sm:pl-1.5",
                )}
              >
                <div className="flex h-5 items-end sm:h-6">
                  {week.monthLabel ? (
                    <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {week.monthLabel}
                    </span>
                  ) : null}
                </div>

                {week.days.map((day, dayIndex) => {
                  if (!day) {
                    return (
                      <div
                        key={`${week.key}-empty-${dayIndex}`}
                        className="h-[13px] w-full sm:h-4 md:h-[18px]"
                        aria-hidden
                      />
                    );
                  }

                  const isSelected = selectedDateKey === day.dateKey;
                  const isToday = todayKey === day.dateKey;
                  const isWeekend = dayIndex >= 5;

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      title={formatHeatmapTooltip(day)}
                      aria-label={formatHeatmapTooltip(day)}
                      aria-pressed={isSelected}
                      onClick={() => onSelectDay(day.dateKey)}
                      className={cn(
                        "h-[13px] w-full rounded-[4px] transition-all duration-150 sm:h-4 sm:rounded-[5px] md:h-[18px] md:rounded-md",
                        toneClassName(day.tone),
                        isWeekend && day.tone === "none" && "opacity-70",
                        isSelected && "scale-110 ring-2 ring-brand ring-offset-1 ring-offset-background",
                        !isSelected && isToday && "ring-1 ring-foreground/35",
                        "hover:scale-105",
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground sm:text-xs">
        Tap a square to jump to that day · scroll for earlier weeks
      </p>
    </div>
  );
};
