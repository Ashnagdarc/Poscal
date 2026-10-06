import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  isSameDay,
  startOfDay,
  toDateKey,
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
      className="w-full max-w-full bg-transparent p-0"
      classNames={{
        months: "flex w-full flex-col",
        month: "w-full space-y-4",
        caption: "relative flex h-10 items-center justify-center px-12",
        caption_label: "text-[15px] font-semibold tracking-tight text-foreground",
        nav: "flex items-center",
        nav_button:
          "inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground opacity-100 transition hover:bg-background hover:text-foreground",
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell:
          "w-[14.285%] basis-[14.285%] px-0 pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 sm:text-[11px]",
        row: "mt-1 flex w-full sm:mt-2",
        cell:
          "relative flex w-[14.285%] basis-[14.285%] items-center justify-center p-0",
        day:
          "h-12 w-full rounded-none bg-transparent p-0 font-normal text-foreground hover:bg-transparent focus:bg-transparent sm:h-14",
        day_selected:
          "bg-transparent text-foreground hover:bg-transparent focus:bg-transparent",
        day_today: "bg-transparent text-foreground",
        day_outside: "text-muted-foreground opacity-30",
        day_disabled: "text-muted-foreground opacity-30",
      }}
      components={{
        DayContent: ({
          date,
          activeModifiers,
        }: {
          date: Date;
          activeModifiers: Record<string, boolean>;
        }) => {
          const summary = summaries.get(toDateKey(date));
          const isCurrentMonth = date.getMonth() === month.getMonth();
          const isToday = isSameDay(date, today);
          const isSelected = Boolean(activeModifiers.selected);

          const dotClass =
            summary?.tone === "positive"
              ? "bg-emerald-400"
              : summary?.tone === "negative"
                ? "bg-red-400"
                : summary?.tone === "neutral"
                  ? "bg-slate-300"
                  : "bg-transparent";

          return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition sm:h-9 sm:w-9 sm:text-sm",
                  isCurrentMonth && isToday && !isSelected
                    ? "ring-1 ring-brand/70 text-foreground"
                    : "",
                  isSelected
                    ? "bg-foreground font-semibold text-background"
                    : "hover:bg-secondary/70",
                )}
              >
                {date.getDate()}
              </span>
              <span
                className={cn(
                  "h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5",
                  isCurrentMonth ? dotClass : "bg-transparent",
                )}
              />
            </div>
          );
        },
      }}
    />
  );
};
