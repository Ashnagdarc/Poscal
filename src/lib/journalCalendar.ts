export type JournalCalendarTone =
  | "win"
  | "loss"
  | "breakeven"
  | "no_trade"
  | "open";

export type JournalCalendarDay = {
  dateKey: string;
  journaled: boolean;
  tradeCount: number;
  closedTradeCount: number;
  openTradeCount: number;
  cancelledCount: number;
  pnl: number;
  wins: number;
  losses: number;
  breakeven: number;
  tone: JournalCalendarTone;
};

export const journalCalendarLabel = (day: JournalCalendarDay) => {
  switch (day.tone) {
    case "win":
      return day.pnl > 0 ? `Won +$${day.pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "Winning day";
    case "loss":
      return `Lost -$${Math.abs(day.pnl).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    case "breakeven":
      return "Breakeven";
    case "open":
      return day.openTradeCount === 1 ? "Open trade" : `${day.openTradeCount} open trades`;
    case "no_trade":
      return "Journaled, no completed trade";
    default: {
      const exhaustive: never = day.tone;
      return exhaustive;
    }
  }
};
