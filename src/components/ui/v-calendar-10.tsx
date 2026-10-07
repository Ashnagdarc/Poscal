"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/v-calendar-10-utils/calendar";
import { cn } from "@/lib/utils";

export type VCalendarEventType =
  | "win"
  | "loss"
  | "breakeven"
  | "no_trade"
  | "open";

export type VCalendarEvent = {
  type: VCalendarEventType;
  label?: string;
};

type VCalendar10Props = Omit<
  React.ComponentProps<typeof Calendar>,
  "components" | "mode" | "selected" | "onSelect"
> & {
  events?: Record<string, VCalendarEvent>;
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
};

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const eventClass: Record<VCalendarEventType, string> = {
  win: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20",
  loss: "bg-red-500 text-white shadow-sm shadow-red-500/20",
  breakeven: "bg-slate-500 text-white",
  no_trade: "bg-amber-400 text-black shadow-sm shadow-amber-400/20",
  open: "bg-brand text-background shadow-sm shadow-brand/20",
};

export default function VCalendar10({
  events = {},
  selected,
  onSelect,
  className,
  classNames,
  ...props
}: VCalendar10Props) {
  const EventDayContent = React.useCallback(
    ({ date }: { date: Date }) => {
      const event = events[dayKey(date)];
      const isSelected = Boolean(
        selected
        && selected.getFullYear() === date.getFullYear()
        && selected.getMonth() === date.getMonth()
        && selected.getDate() === date.getDate(),
      );

      return (
        <span
          title={event?.label}
          className={cn(
            "flex size-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-150 sm:size-10",
            event ? eventClass[event.type] : "text-foreground hover:bg-secondary",
            isSelected && "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background",
          )}
        >
          {date.getDate()}
        </span>
      );
    },
    [events, selected],
  );

  return (
    <Calendar
      {...props}
      mode="single"
      selected={selected}
      onSelect={onSelect}
      className={cn("w-full p-0", className)}
      classNames={{
        months: "flex w-full flex-col",
        month: "w-full space-y-3",
        caption: "relative flex h-10 items-center justify-center px-12",
        caption_label: "text-[15px] font-semibold tracking-tight text-foreground",
        nav: "flex items-center",
        nav_button:
          "inline-flex size-8 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground opacity-100 transition hover:bg-background hover:text-foreground",
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell:
          "w-[14.285%] basis-[14.285%] px-0 pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 sm:text-[11px]",
        row: "mt-1 flex w-full",
        cell: "relative flex h-12 w-[14.285%] basis-[14.285%] items-center justify-center p-0 sm:h-14",
        day:
          "flex h-12 w-full items-center justify-center rounded-none bg-transparent p-0 text-foreground hover:bg-transparent focus:bg-transparent sm:h-14",
        day_selected:
          "bg-transparent text-foreground hover:bg-transparent focus:bg-transparent",
        day_today: "bg-transparent text-foreground",
        day_outside: "text-muted-foreground opacity-25",
        day_disabled: "text-muted-foreground opacity-25",
        ...classNames,
      }}
      components={{ DayContent: EventDayContent }}
    />
  );
}
