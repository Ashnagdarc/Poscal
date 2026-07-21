import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  formatResultDayTooltip,
  parseDateKey,
  resultToneClassName,
  startOfDay,
  type ResultHeatmapDay,
  type ResultDayTone,
} from "@/lib/historyResults";

interface HeatmapWeekColumn {
  key: string;
  monthLabel: string | null;
  isMonthStart: boolean;
  days: Array<ResultHeatmapDay | null>;
}

const Y_AXIS_LABELS = [
  { row: 0, label: "Mon", short: "M" },
  { row: 2, label: "Wed", short: "W" },
  { row: 4, label: "Fri", short: "F" },
  { row: 6, label: "Sun", short: "S" },
] as const;

const toWeekKey = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  const dow = date.getDay();
  const monday = new Date(date);
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
  return monday.toISOString().slice(0, 10);
};

const dateKeyFromDate = (date: Date) => date.toISOString().slice(0, 10);

const buildHeatmapWeekColumns = (days: ResultHeatmapDay[]): HeatmapWeekColumn[] => {
  if (!days.length) return [];

  const dayMap = new Map(days.map((day) => [day.dateKey, day]));
  const firstDate = parseDateKey(days[0].dateKey);
  const lastDate = parseDateKey(days[days.length - 1].dateKey);

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
    const weekDays: Array<ResultHeatmapDay | null> = [];

    for (let index = 0; index < 7; index += 1) {
      const current = new Date(cursor);
      const dateKey = current.toISOString().slice(0, 10);
      const inRange = current >= firstDate && current <= lastDate;
      weekDays.push(inRange ? (dayMap.get(dateKey) ?? { dateKey, tone: "none", label: "", tradeCount: 0 }) : null);
      cursor.setDate(cursor.getDate() + 1);
    }

    const month = weekStart.getMonth();
    const isMonthStart = month !== lastMonth;
    const monthLabel = isMonthStart
      ? weekStart.toLocaleDateString("en-US", { month: "short" })
      : null;
    lastMonth = month;

    columns.push({
      key: dateKeyFromDate(weekStart),
      monthLabel,
      isMonthStart,
      days: weekDays,
    });
  }

  return columns;
};

interface ResultsHeatmapProps {
  days: ResultHeatmapDay[];
  selectedDateKey?: string;
  onSelectDay: (dateKey: string) => void;
}

export const ResultsHeatmap = ({
  days,
  selectedDateKey,
  onSelectDay,
}: ResultsHeatmapProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = today.toISOString().slice(0, 10);
  const weekColumns = useMemo(() => buildHeatmapWeekColumns(days), [days]);

  const selectedWeekKey = useMemo(() => {
    if (!selectedDateKey) return todayKey;
    return toWeekKey(selectedDateKey);
  }, [selectedDateKey, todayKey]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(`[data-week-key="${selectedWeekKey}"]`);
    target?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedWeekKey, weekColumns.length]);

  if (!weekColumns.length) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground">
        Mark a few calculation results to build your heatmap
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
                  const hasResult = day.tone === "positive" || day.tone === "negative" || day.tone === "neutral";

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      title={formatResultDayTooltip(day, today)}
                      aria-label={formatResultDayTooltip(day, today)}
                      aria-pressed={isSelected}
                      onClick={() => onSelectDay(day.dateKey)}
                      disabled={!hasResult && day.tone !== "missed"}
                      className={cn(
                        "h-[13px] w-full rounded-[4px] transition-all duration-150 sm:h-4 sm:rounded-[5px] md:h-[18px] md:rounded-md",
                        resultToneClassName(day.tone as ResultDayTone),
                        isSelected && "scale-110 ring-2 ring-brand ring-offset-1 ring-offset-background",
                        !isSelected && isToday && "ring-1 ring-foreground/35",
                        hasResult && "hover:scale-105 cursor-pointer",
                        !hasResult && day.tone !== "missed" && "opacity-50",
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
        Tap a colored square to filter results · scroll for earlier weeks
      </p>
    </div>
  );
};
