import { Calendar } from "@/components/ui/calendar";
import {
  isSameDay,
  startOfDay,
  type ResultDaySummary,
} from "@/lib/historyResults";

interface ResultsCalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDate?: Date;
  onSelectDate: (date: Date | undefined) => void;
  summaries: Map<string, ResultDaySummary>;
  today: Date;
}

export const ResultsCalendar = ({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  summaries,
  today,
}: ResultsCalendarProps) => {
  const dayModifiers = {
    positive: (date: Date) => summaries.get(date.toISOString().slice(0, 10))?.tone === "positive",
    negative: (date: Date) => summaries.get(date.toISOString().slice(0, 10))?.tone === "negative",
    neutral: (date: Date) => summaries.get(date.toISOString().slice(0, 10))?.tone === "neutral",
    missed: (date: Date) => {
      const day = startOfDay(date);
      if (day >= today) return false;
      return !summaries.has(day.toISOString().slice(0, 10));
    },
  };

  return (
    <Calendar
      month={month}
      onMonthChange={onMonthChange}
      selected={selectedDate}
      onSelect={(date) => {
        if (!date) {
          onSelectDate(undefined);
          return;
        }

        if (selectedDate && isSameDay(selectedDate, date)) {
          onSelectDate(undefined);
          return;
        }

        onSelectDate(startOfDay(date));
      }}
      modifiers={dayModifiers}
      className="w-full max-w-full rounded-2xl bg-background p-2 sm:p-3"
      classNames={{
        months: "flex w-full flex-col",
        month: "w-full space-y-2 sm:space-y-3",
        caption: "relative flex items-center justify-center px-8 pb-1 pt-1",
        caption_label: "text-sm font-semibold",
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell:
          "w-[14.28%] basis-[14.28%] px-0 text-center text-[10px] font-medium text-muted-foreground sm:text-[11px]",
        row: "mt-1 flex w-full sm:mt-2",
        cell: "relative w-[14.28%] basis-[14.28%] p-0.5 sm:p-1",
        day: "h-11 w-full rounded-lg p-0 text-foreground hover:bg-secondary/80 sm:h-14 sm:rounded-xl",
        day_selected: "bg-brand/15 text-foreground ring-1 ring-brand/40 hover:bg-brand/20",
        day_today: "bg-secondary text-foreground ring-1 ring-border",
        day_outside: "opacity-30",
      }}
      modifiersClassNames={{
        positive: "border border-emerald-500/35 bg-emerald-500/12",
        negative: "border border-red-500/35 bg-red-500/12",
        neutral: "border border-slate-500/35 bg-slate-500/12",
        missed: "border border-border/70 bg-background/60",
      }}
      components={{
        DayContent: ({ date, activeModifiers }: { date: Date; activeModifiers: Record<string, boolean> }) => {
          const dateKey = date.toISOString().slice(0, 10);
          const summary = summaries.get(dateKey);
          const isFuture = startOfDay(date) > today;
          const isMissed = activeModifiers.missed;
          const isCurrentMonth = date.getMonth() === month.getMonth();

          return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg sm:gap-1 sm:rounded-xl">
              <span className="text-xs font-semibold leading-none sm:text-sm">
                {date.getDate()}
              </span>
              {isCurrentMonth && summary && (
                <>
                  <span
                    className={`h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5 ${
                      summary.tone === "positive"
                        ? "bg-emerald-400"
                        : summary.tone === "negative"
                          ? "bg-red-400"
                          : "bg-slate-300"
                    }`}
                  />
                  <span className="hidden text-[9px] font-medium leading-none text-muted-foreground sm:inline">
                    {summary.label}
                  </span>
                </>
              )}
              {isCurrentMonth && !summary && isMissed && (
                <span className="text-[9px] font-semibold leading-none text-muted-foreground/80 sm:text-[10px]">
                  x
                </span>
              )}
              {isCurrentMonth && !summary && !isMissed && !isFuture && isSameDay(date, today) && (
                <span className="hidden text-[9px] font-medium leading-none text-muted-foreground sm:inline">
                  Today
                </span>
              )}
            </div>
          );
        },
      }}
    />
  );
};

export const ResultsLegend = () => (
  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
    <div className="flex items-center gap-2 rounded-xl bg-background px-2.5 py-2 sm:px-3">
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
      <span>Profitable</span>
    </div>
    <div className="flex items-center gap-2 rounded-xl bg-background px-2.5 py-2 sm:px-3">
      <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
      <span>Losing</span>
    </div>
    <div className="flex items-center gap-2 rounded-xl bg-background px-2.5 py-2 sm:px-3">
      <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
      <span>Breakeven</span>
    </div>
    <div className="flex items-center gap-2 rounded-xl bg-background px-2.5 py-2 sm:px-3">
      <span className="text-[11px] font-semibold leading-none">x</span>
      <span>No results</span>
    </div>
  </div>
);
