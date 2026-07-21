import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatProgressDateKey } from "@/lib/progressSessions";

const parseDateKey = (dateKey: string) => new Date(`${dateKey}T12:00:00`);

const formatSessionDate = (dateKey: string) =>
  parseDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const shiftDateKey = (dateKey: string, deltaDays: number) => {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + deltaDays);
  return formatProgressDateKey(date);
};

interface SessionDatePickerProps {
  dateKey: string;
  onDateChange: (dateKey: string) => void;
}

export const SessionDatePicker = ({ dateKey, onDateChange }: SessionDatePickerProps) => {
  const selectedDate = parseDateKey(dateKey);
  const todayKey = formatProgressDateKey(new Date());
  const isToday = dateKey === todayKey;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-xl"
        onClick={() => onDateChange(shiftDateKey(dateKey, -1))}
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 min-w-0 flex-1 rounded-xl border-border bg-background px-3 font-semibold",
              isToday && "border-brand/40",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{formatSessionDate(dateKey)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-2xl p-0" align="center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              onDateChange(formatProgressDateKey(date));
            }}
            initialFocus
            className="rounded-2xl"
          />
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full rounded-xl text-sm"
              onClick={() => onDateChange(todayKey)}
            >
              Jump to today
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-xl"
        onClick={() => onDateChange(shiftDateKey(dateKey, 1))}
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
