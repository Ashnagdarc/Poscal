import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  isSameDay,
  startOfDay,
  toDateKey,
} from "@/lib/historyResults";
import {
  journalCalendarLabel,
  type JournalCalendarDay,
} from "@/lib/journalCalendar";

interface ResultsCalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDate?: Date;
  onSelectDate: (date: Date | undefined) => void;
  summaries: Map<string, JournalCalendarDay>;
  today: Date;
}

const hasClosedResult = (summary: JournalCalendarDay | undefined) =>
  summary?.tone === "win"
  || summary?.tone === "loss"
  || summary?.tone === "breakeven";

export const ResultsCalendar = ({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  summaries,
  today,
}: ResultsCalendarProps) => {
  const dayModifiers = {
    profitable: (date: Date) => summaries.get(toDateKey(date))?.tone === "win",
    losing: (date: Date) => summaries.get(toDateKey(date))?.tone === "loss",
    breakeven: (date: Date) => summaries.get(toDateKey(date))?.tone === "breakeven",
    noResults: (date: Date) => {
      const day = startOfDay(date);
      if (day >= today) return false;
      return !hasClosedResult(summaries.get(toDateKey(day)));
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
        caption_label: "text-sm font-semibold text-foreground",
        nav: "flex items-center",
        nav_button:
          "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background p-0 text-muted-foreground opacity-100 transition hover:bg-secondary hover:text-foreground",
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell:
          "w-[14.28%] basis-[14.28%] px-0 text-center text-[10px] font-medium text-muted-foreground sm:text-[11px]",
        row: "mt-1 flex w-full sm:mt-2",
        cell: "relative w-[14.28%] basis-[14.28%] p-0.5 sm:p-1",
        day: "h-11 w-full rounded-lg p-0 text-foreground hover:bg-secondary/80 sm:h-14 sm:rounded-xl",
        day_selected:
          "bg-transparent text-foreground ring-2 ring-brand ring-offset-1 ring-offset-background hover:bg-transparent",
        day_today: "bg-transparent text-foreground",
        day_outside: "opacity-25",
      }}
      modifiersClassNames={{
        profitable: "!bg-emerald-500/30 !text-foreground",
        losing: "!bg-red-500/30 !text-foreground",
        breakeven: "!bg-slate-500/20 !text-foreground",
        noResults: "!bg-background/60",
      }}
      components={{
        DayContent: ({
          date,
          activeModifiers,
        }: {
          date: Date;
          activeModifiers: Record<string, boolean>;
        }) => {
          const dateKey = toDateKey(date);
          const summary = summaries.get(dateKey);
          const isFuture = startOfDay(date) > today;
          const resultExists = hasClosedResult(summary);
          const isNoResults = Boolean(activeModifiers.noResults) && !resultExists;
          const isCurrentMonth = date.getMonth() === month.getMonth();

          const toneClass = summary?.tone === "win"
            ? "border border-emerald-500/55 bg-emerald-500/30"
            : summary?.tone === "loss"
              ? "border border-red-500/55 bg-red-500/30"
              : summary?.tone === "breakeven"
                ? "border border-slate-400/50 bg-slate-500/20"
                : isNoResults
                  ? "border border-border/50 bg-background/40"
                  : isSameDay(date, today)
                    ? "border border-border bg-secondary/70"
                    : "";

          return (
            <div
              title={summary ? journalCalendarLabel(summary) : undefined}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg sm:gap-1 sm:rounded-xl",
                isCurrentMonth && toneClass,
              )}
            >
              <span className="text-xs font-semibold leading-none sm:text-sm">
                {date.getDate()}
              </span>

              {isCurrentMonth && resultExists ? (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2",
                    summary?.tone === "win" && "bg-emerald-400",
                    summary?.tone === "loss" && "bg-red-400",
                    summary?.tone === "breakeven" && "bg-slate-300",
                  )}
                />
              ) : null}

              {isCurrentMonth && !resultExists && isNoResults ? (
                <span className="text-[9px] font-semibold leading-none text-muted-foreground/80 sm:text-[10px]">
                  x
                </span>
              ) : null}

              {isCurrentMonth
                && !resultExists
                && !isNoResults
                && !isFuture
                && isSameDay(date, today) ? (
                  <span className="hidden text-[9px] font-medium leading-none text-muted-foreground sm:inline">
                    Today
                  </span>
                ) : null}
            </div>
          );
        },
      }}
    />
  );
};

export const ResultsLegend = () => (
  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
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
