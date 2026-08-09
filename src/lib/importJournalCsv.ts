import { validateTrades, type ValidatedTrade } from "@/lib/tradeValidation";

/** Split a CSV line respecting double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

function normalizeDirection(raw: string): "long" | "short" | null {
  const value = raw.trim().toLowerCase();
  if (value === "long" || value === "buy") return "long";
  if (value === "short" || value === "sell") return "short";
  return null;
}

function normalizeStatus(raw: string): "open" | "closed" | "cancelled" {
  const value = raw.trim().toLowerCase();
  if (value === "closed" || value === "cancelled" || value === "open") return value;
  return "open";
}

/**
 * Parse Poscal export CSV (or compatible) into row objects for validateTrades.
 */
export function parseJournalCsv(text: string): {
  rows: unknown[];
  parseErrors: string[];
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], parseErrors: ["CSV is empty."] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const pairIdx = headers.indexOf("pair");
  const directionIdx = headers.indexOf("direction");
  if (pairIdx < 0 || directionIdx < 0) {
    return {
      rows: [],
      parseErrors: ["CSV must include pair and direction columns (Poscal export format)."],
    };
  }

  const indexOf = (name: string) => headers.indexOf(name);
  const rows: unknown[] = [];
  const parseErrors: string[] = [];

  for (let lineNo = 1; lineNo < lines.length; lineNo += 1) {
    const cells = splitCsvLine(lines[lineNo]);
    const get = (name: string) => {
      const idx = indexOf(name);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };

    const direction = normalizeDirection(get("direction"));
    if (!direction) {
      parseErrors.push(`Row ${lineNo + 1}: invalid direction (use long/short or buy/sell).`);
      continue;
    }

    const entryPrice = parseOptionalNumber(get("entry_price"));
    const exitPrice = parseOptionalNumber(get("exit_price"));
    const stopLoss = parseOptionalNumber(get("stop_loss"));
    const takeProfit = parseOptionalNumber(get("take_profit"));
    const positionSize = parseOptionalNumber(get("position_size"));
    const riskPercent = parseOptionalNumber(get("risk_percent"));
    const pnl = parseOptionalNumber(get("pnl"));

    const numericFields: Array<[string, number | null]> = [
      ["entry_price", entryPrice],
      ["exit_price", exitPrice],
      ["stop_loss", stopLoss],
      ["take_profit", takeProfit],
      ["position_size", positionSize],
      ["risk_percent", riskPercent],
      ["pnl", pnl],
    ];
    const badNumber = numericFields.find(([, value]) => value !== null && Number.isNaN(value));
    if (badNumber) {
      parseErrors.push(`Row ${lineNo + 1}: invalid number for ${badNumber[0]}.`);
      continue;
    }

    rows.push({
      pair: get("pair"),
      direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      position_size: positionSize,
      risk_percent: riskPercent,
      pnl,
      status: normalizeStatus(get("status")),
      notes: get("notes") || null,
      entry_date: get("entry_date") || null,
      exit_date: get("exit_date") || null,
      tags: get("tags") || null,
      market_condition: get("market_condition") || null,
      risk_amount: parseOptionalNumber(get("risk_amount")),
      pnl_percent: parseOptionalNumber(get("pnl_percent")),
    });
  }

  return { rows, parseErrors };
}

export function parseAndValidateJournalCsv(text: string): {
  validTrades: ValidatedTrade[];
  errors: string[];
} {
  const { rows, parseErrors } = parseJournalCsv(text);
  if (rows.length === 0 && parseErrors.length > 0) {
    return { validTrades: [], errors: parseErrors };
  }
  const validated = validateTrades(rows);
  return {
    validTrades: validated.validTrades,
    errors: [...parseErrors, ...validated.errors],
  };
}
