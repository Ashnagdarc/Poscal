import type { JournalTrade } from "@/lib/convexJournal";

const CSV_HEADERS = [
  "pair",
  "direction",
  "entry_price",
  "exit_price",
  "stop_loss",
  "take_profit",
  "position_size",
  "risk_percent",
  "risk_amount",
  "pnl",
  "pnl_percent",
  "status",
  "notes",
  "tags",
  "market_condition",
  "entry_date",
  "exit_date",
  "created_at",
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  return csvEscape(String(value));
}

/** Map buy/sell → long/short for import-schema symmetry. */
function normalizeDirection(direction: JournalTrade["direction"]): string {
  if (direction === "buy") return "long";
  if (direction === "sell") return "short";
  return direction;
}

export function tradesToCsv(trades: JournalTrade[]): string {
  const lines = [CSV_HEADERS.join(",")];

  for (const trade of trades) {
    const row = [
      cell(trade.pair),
      cell(normalizeDirection(trade.direction)),
      cell(trade.entry_price),
      cell(trade.exit_price),
      cell(trade.stop_loss),
      cell(trade.take_profit),
      cell(trade.position_size),
      cell(trade.risk_percent),
      cell(trade.risk_amount),
      cell(trade.pnl),
      cell(trade.pnl_percent),
      cell(trade.status),
      cell(trade.notes),
      cell(trade.tags),
      cell(trade.market_condition),
      cell(trade.entry_date),
      cell(trade.exit_date),
      cell(trade.created_at),
    ];
    lines.push(row.join(","));
  }

  return `${lines.join("\n")}\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildExportFilename(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `poscal-trades-${yyyy}-${mm}-${dd}.csv`;
}
