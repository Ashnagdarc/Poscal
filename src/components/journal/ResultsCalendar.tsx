import VCalendar10, {
  type VCalendarEvent,
} from "@/components/ui/v-calendar-10";
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

export const ResultsCalendar = ({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  summaries,
  today,
}: ResultsCalendarProps) => {
  const events = Object.fromEntries(
    Array.from(summaries.values()).map((day) => [
      day.dateKey,
      {
        type: day.tone,
        label: journalCalendarLabel(day),
      } satisfies VCalendarEvent,
    ]),
  );

  return (
    <div className="relative">
      <VCalendar10
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
        events={events}
        classNames={{
          day_today:
            summaries.has(toDateKey(today))
              ? "bg-transparent text-foreground"
              : "bg-transparent text-foreground [&>span]:ring-1 [&>span]:ring-brand/70",
        }}
      />

      <div
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-[10px] text-muted-foreground sm:text-[11px]"
        aria-label="Calendar color guide"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          Win
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-500" />
          Loss
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-slate-500" />
          Breakeven
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400" />
          Journal only
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand" />
          Open trade
        </span>
      </div>
    </div>
  );
};
