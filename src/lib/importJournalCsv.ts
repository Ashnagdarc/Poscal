import { validateTrades, type ValidatedTrade } from "@/lib/tradeValidation";

export type JournalImportSource = "poscal" | "mt5";

type ParsedImport = {
  rows: unknown[];
  parseErrors: string[];
  source: JournalImportSource | null;
};

type IndexedRow = { cells: string[]; rowNumber: number };

type Mt5Deal = {
  positionId: string;
  entry: "in" | "out" | "inout" | "unknown";
  direction: "long" | "short";
  volume: number | null;
  price: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  commission: number;
  swap: number;
  fee: number;
  profit: number;
  time: string | null;
  comment: string;
  rowNumber: number;
};

const MT5_NON_TRADE_TYPES = new Set([
  "balance",
  "credit",
  "charge",
  "correction",
  "bonus",
  "dividend",
  "tax",
  "deposit",
  "withdrawal",
]);

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function findColumn(
  headers: string[],
  aliases: string[],
  occurrence = 0,
): number {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  let seen = 0;
  for (let index = 0; index < headers.length; index += 1) {
    if (!normalizedAliases.has(headers[index])) continue;
    if (seen === occurrence) return index;
    seen += 1;
  }
  return -1;
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let inQuotes = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (inQuotes && line[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && line[index] === delimiter) count += 1;
  }
  return count;
}

function detectDelimiter(line: string): string {
  return (
    [",", "\t", ";"]
      .map((delimiter) => ({
        delimiter,
        count: countOutsideQuotes(line, delimiter),
      }))
      .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ","
  );
}

/** Split a delimited line while respecting double-quoted fields. */
export function splitCsvLine(line: string, delimiter = ","): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else inQuotes = false;
      } else current += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

function parseOptionalNumber(raw: string): number | null {
  let value = raw
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/[₦€£$%]/g, "")
    .replace(/\s+/g, "")
    .replace(/[’']/g, "");
  if (!value || value === "-" || value === "—") return null;
  const negative = value.startsWith("(") && value.endsWith(")");
  if (negative) value = value.slice(1, -1);
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    value =
      lastComma > lastDot
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/,/g, "");
  } else if (lastComma >= 0) value = value.replace(",", ".");
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return negative ? -parsed : parsed;
}

function normalizeDirection(raw: string): "long" | "short" | null {
  const value = raw.trim().toLowerCase();
  if (value === "long" || value.startsWith("buy")) return "long";
  if (value === "short" || value.startsWith("sell")) return "short";
  return null;
}

function normalizeStatus(raw: string): "open" | "closed" | "cancelled" {
  const value = raw.trim().toLowerCase();
  if (value === "closed" || value === "cancelled" || value === "open")
    return value;
  return "open";
}

function normalizeMt5Date(raw: string): string | null {
  const value = raw.trim();
  if (!value || value === "-" || value === "—") return null;
  const match = value.match(
    /^(\d{4})[./-](\d{2})[./-](\d{2})(?:\s+|T)(\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) return value;
  const [, year, month, day, hour, minute, second = "00"] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function getCell(cells: string[], index: number): string {
  return index >= 0 ? (cells[index] ?? "").trim() : "";
}

function validateNumericFields(
  values: Array<[string, number | null]>,
  rowNumber: number,
): string | null {
  const invalid = values.find(
    ([, value]) => value !== null && Number.isNaN(value),
  );
  return invalid ? `Row ${rowNumber}: invalid number for ${invalid[0]}.` : null;
}

function parseDelimitedText(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => splitCsvLine(line, delimiter));
}

function findHeaderIndex(rows: string[][]): number {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return (
      findColumn(headers, ["symbol", "pair", "instrument"]) >= 0 &&
      findColumn(headers, ["type", "direction", "side"]) >= 0
    );
  });
}

function tableScore(rows: string[][], headerIndex: number): number {
  const headers = rows[headerIndex].map(normalizeHeader);
  let score = 0;
  if (findColumn(headers, ["symbol", "pair", "instrument"]) >= 0) score += 3;
  if (findColumn(headers, ["type", "direction", "side"]) >= 0) score += 3;
  if (findColumn(headers, ["profit", "pnl", "pl"]) >= 0) score += 4;
  if (findColumn(headers, ["deal", "dealticket"]) >= 0) score += 2;
  if (findColumn(headers, ["position", "positionid"]) >= 0) score += 2;
  if (
    findColumn(headers, ["state"]) >= 0 &&
    findColumn(headers, ["profit"]) < 0
  )
    score -= 4;
  return score;
}

function parseHtmlTables(text: string): string[][] {
  if (typeof DOMParser === "undefined") return [];
  const document = new DOMParser().parseFromString(text, "text/html");
  const candidates = Array.from(document.querySelectorAll("table"))
    .map((table) => {
      const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th, td")).map(
          (cell) => cell.textContent?.replace(/\s+/g, " ").trim() ?? "",
        ),
      );
      const headerIndex = findHeaderIndex(rows);
      return {
        rows,
        headerIndex,
        score: headerIndex >= 0 ? tableScore(rows, headerIndex) : -1,
      };
    })
    .filter((candidate) => candidate.headerIndex >= 0)
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best ? best.rows.slice(best.headerIndex) : [];
}

function parsePoscalRows(rows: string[][], headerIndex: number): ParsedImport {
  const headers = rows[headerIndex].map(normalizeHeader);
  const indexOf = (name: string) => findColumn(headers, [name]);
  const parsedRows: unknown[] = [];
  const parseErrors: string[] = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const cells = rows[index];
    const rowNumber = index + 1;
    const get = (name: string) => getCell(cells, indexOf(name));
    if (cells.every((cell) => !cell.trim())) continue;
    const direction = normalizeDirection(get("direction"));
    if (!direction) {
      parseErrors.push(
        `Row ${rowNumber}: invalid direction (use long/short or buy/sell).`,
      );
      continue;
    }
    const entryPrice = parseOptionalNumber(get("entry_price"));
    const exitPrice = parseOptionalNumber(get("exit_price"));
    const stopLoss = parseOptionalNumber(get("stop_loss"));
    const takeProfit = parseOptionalNumber(get("take_profit"));
    const positionSize = parseOptionalNumber(get("position_size"));
    const riskPercent = parseOptionalNumber(get("risk_percent"));
    const riskAmount = parseOptionalNumber(get("risk_amount"));
    const pnl = parseOptionalNumber(get("pnl"));
    const pnlPercent = parseOptionalNumber(get("pnl_percent"));
    const numericError = validateNumericFields(
      [
        ["entry_price", entryPrice],
        ["exit_price", exitPrice],
        ["stop_loss", stopLoss],
        ["take_profit", takeProfit],
        ["position_size", positionSize],
        ["risk_percent", riskPercent],
        ["risk_amount", riskAmount],
        ["pnl", pnl],
        ["pnl_percent", pnlPercent],
      ],
      rowNumber,
    );
    if (numericError) {
      parseErrors.push(numericError);
      continue;
    }
    parsedRows.push({
      pair: get("pair"),
      direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      position_size: positionSize,
      risk_percent: riskPercent,
      risk_amount: riskAmount,
      pnl,
      pnl_percent: pnlPercent,
      status: normalizeStatus(get("status")),
      notes: get("notes") || null,
      entry_date: get("entry_date") || null,
      exit_date: get("exit_date") || null,
      tags: get("tags") || null,
      market_condition: get("market_condition") || null,
    });
  }
  return { rows: parsedRows, parseErrors, source: "poscal" };
}

function mt5EntryKind(raw: string): Mt5Deal["entry"] {
  const value = normalizeHeader(raw);
  if (["in", "entryin", "open", "0"].includes(value)) return "in";
  if (["out", "entryout", "close", "outby", "1", "3"].includes(value))
    return "out";
  if (["inout", "reverse", "2"].includes(value)) return "inout";
  return "unknown";
}

function weightedAverage(deals: Mt5Deal[]): number | null {
  const priced = deals.filter(
    (deal): deal is Mt5Deal & { price: number } => deal.price !== null,
  );
  if (priced.length === 0) return null;
  const weighted = priced.filter(
    (deal): deal is Mt5Deal & { price: number; volume: number } =>
      deal.volume !== null && deal.volume > 0,
  );
  if (weighted.length === 0) return priced[0].price;
  const totalVolume = weighted.reduce((sum, deal) => sum + deal.volume, 0);
  return (
    weighted.reduce((sum, deal) => sum + deal.price * deal.volume, 0) /
    totalVolume
  );
}

function getMt5Indexes(headers: string[]) {
  const namedCloseTime = findColumn(headers, ["closetime", "exittime"]);
  const namedClosePrice = findColumn(headers, ["closeprice", "exitprice"]);
  const type = findColumn(headers, ["type", "direction", "side"]);
  const explicitEntryKind = findColumn(headers, [
    "entry",
    "dealentry",
    "inout",
  ]);
  const directionColumn = findColumn(headers, ["direction"]);
  return {
    symbol: findColumn(headers, ["symbol", "instrument", "pair"]),
    type,
    volume: findColumn(headers, ["volume", "lots", "lot", "size"]),
    openTime: findColumn(headers, ["opentime", "entrytime", "time"]),
    closeTime:
      namedCloseTime >= 0 ? namedCloseTime : findColumn(headers, ["time"], 1),
    openPrice: findColumn(headers, ["openprice", "entryprice", "price"]),
    closePrice:
      namedClosePrice >= 0
        ? namedClosePrice
        : findColumn(headers, ["price"], 1),
    stopLoss: findColumn(headers, ["sl", "stoploss"]),
    takeProfit: findColumn(headers, ["tp", "takeprofit"]),
    profit: findColumn(headers, ["profit", "pnl", "pl"]),
    commission: findColumn(headers, ["commission"]),
    swap: findColumn(headers, ["swap"]),
    fee: findColumn(headers, ["fee"]),
    comment: findColumn(headers, ["comment", "comments", "notes"]),
    positionId: findColumn(headers, [
      "position",
      "positionid",
      "positionticket",
    ]),
    entryKind:
      explicitEntryKind >= 0
        ? explicitEntryKind
        : type >= 0 && headers[type] === "type" && directionColumn >= 0
          ? directionColumn
          : -1,
  };
}

function parseMt5Deals(
  rows: IndexedRow[],
  indexes: ReturnType<typeof getMt5Indexes>,
): ParsedImport {
  const deals: Array<Mt5Deal & { symbol: string }> = [];
  const parseErrors: string[] = [];
  const openPositions = new Map<string, string[]>();
  let generatedPositionCount = 0;
  for (const { cells, rowNumber } of rows) {
    const typeRaw = getCell(cells, indexes.type);
    const direction = normalizeDirection(typeRaw);
    if (!direction) continue;
    const symbol = getCell(cells, indexes.symbol);
    const entry = mt5EntryKind(getCell(cells, indexes.entryKind));
    if (!symbol) {
      parseErrors.push(`Row ${rowNumber}: MT5 deal is missing a symbol.`);
      continue;
    }
    let positionId = getCell(cells, indexes.positionId);
    if (!positionId && entry === "in") {
      generatedPositionCount += 1;
      positionId = `matched-${generatedPositionCount}`;
      openPositions.set(symbol, [
        ...(openPositions.get(symbol) ?? []),
        positionId,
      ]);
    } else if (!positionId && entry === "out") {
      const candidates = openPositions.get(symbol) ?? [];
      positionId = candidates.shift() ?? "";
      openPositions.set(symbol, candidates);
    }
    if (!positionId) {
      parseErrors.push(
        `Row ${rowNumber}: could not match this MT5 deal to a position.`,
      );
      continue;
    }
    const volume = parseOptionalNumber(getCell(cells, indexes.volume));
    const price = parseOptionalNumber(getCell(cells, indexes.openPrice));
    const stopLoss = parseOptionalNumber(getCell(cells, indexes.stopLoss));
    const takeProfit = parseOptionalNumber(getCell(cells, indexes.takeProfit));
    const commission = parseOptionalNumber(getCell(cells, indexes.commission));
    const swap = parseOptionalNumber(getCell(cells, indexes.swap));
    const fee = parseOptionalNumber(getCell(cells, indexes.fee));
    const profit = parseOptionalNumber(getCell(cells, indexes.profit));
    const numericError = validateNumericFields(
      [
        ["volume", volume],
        ["price", price],
        ["stop loss", stopLoss],
        ["take profit", takeProfit],
        ["commission", commission],
        ["swap", swap],
        ["fee", fee],
        ["profit", profit],
      ],
      rowNumber,
    );
    if (numericError) {
      parseErrors.push(numericError);
      continue;
    }
    deals.push({
      symbol,
      positionId,
      entry,
      direction,
      volume,
      price,
      stopLoss,
      takeProfit,
      commission: commission ?? 0,
      swap: swap ?? 0,
      fee: fee ?? 0,
      profit: profit ?? 0,
      time: normalizeMt5Date(getCell(cells, indexes.openTime)),
      comment: getCell(cells, indexes.comment),
      rowNumber,
    });
  }

  const grouped = new Map<string, Array<Mt5Deal & { symbol: string }>>();
  for (const deal of deals) {
    const key = `${deal.positionId}:${deal.symbol}`;
    grouped.set(key, [...(grouped.get(key) ?? []), deal]);
  }
  const parsedRows = Array.from(grouped.values()).flatMap((positionDeals) => {
    const sorted = [...positionDeals].sort((a, b) => a.rowNumber - b.rowNumber);
    const explicitEntries = sorted.filter((deal) => deal.entry === "in");
    const explicitExits = sorted.filter((deal) => deal.entry === "out");
    const entries =
      explicitEntries.length > 0 ? explicitEntries : sorted.slice(0, 1);
    const exits = explicitExits.length > 0 ? explicitExits : sorted.slice(1);
    const entry = entries[0];
    if (!entry) return [];
    const comments = Array.from(
      new Set(sorted.map((deal) => deal.comment).filter(Boolean)),
    );
    const financialResult = sorted.reduce(
      (sum, deal) => sum + deal.profit + deal.commission + deal.swap + deal.fee,
      0,
    );
    return [
      {
        pair: entry.symbol,
        direction: entry.direction,
        entry_price: weightedAverage(entries),
        exit_price: weightedAverage(exits),
        stop_loss: entries.find((deal) => deal.stopLoss)?.stopLoss ?? null,
        take_profit:
          entries.find((deal) => deal.takeProfit)?.takeProfit ?? null,
        position_size:
          entries.reduce((sum, deal) => sum + (deal.volume ?? 0), 0) || null,
        pnl: financialResult,
        status: exits.length > 0 ? "closed" : "open",
        notes: comments.join(" · ") || null,
        entry_date: entries[0]?.time ?? null,
        exit_date: exits.at(-1)?.time ?? null,
        tags: "MT5",
      },
    ];
  });
  return { rows: parsedRows, parseErrors, source: "mt5" };
}

function parseMt5Rows(rows: string[][], headerIndex: number): ParsedImport {
  const headers = rows[headerIndex].map(normalizeHeader);
  const indexes = getMt5Indexes(headers);
  const dataRows = rows.slice(headerIndex + 1).map((cells, offset) => ({
    cells,
    rowNumber: headerIndex + offset + 2,
  }));
  if (indexes.entryKind >= 0) {
    return parseMt5Deals(dataRows, indexes);
  }
  const parsedRows: unknown[] = [];
  const parseErrors: string[] = [];
  for (const { cells, rowNumber } of dataRows) {
    const typeRaw = getCell(cells, indexes.type);
    const direction = normalizeDirection(typeRaw);
    if (!direction) {
      if (!MT5_NON_TRADE_TYPES.has(normalizeHeader(typeRaw)) && typeRaw) {
        parseErrors.push(
          `Row ${rowNumber}: unsupported MT5 trade type "${typeRaw}".`,
        );
      }
      continue;
    }
    const symbol = getCell(cells, indexes.symbol);
    if (!symbol) continue;
    const entryPrice = parseOptionalNumber(getCell(cells, indexes.openPrice));
    const exitPrice = parseOptionalNumber(getCell(cells, indexes.closePrice));
    const stopLoss = parseOptionalNumber(getCell(cells, indexes.stopLoss));
    const takeProfit = parseOptionalNumber(getCell(cells, indexes.takeProfit));
    const positionSize = parseOptionalNumber(getCell(cells, indexes.volume));
    const profit = parseOptionalNumber(getCell(cells, indexes.profit));
    const commission = parseOptionalNumber(getCell(cells, indexes.commission));
    const swap = parseOptionalNumber(getCell(cells, indexes.swap));
    const fee = parseOptionalNumber(getCell(cells, indexes.fee));
    const numericError = validateNumericFields(
      [
        ["open price", entryPrice],
        ["close price", exitPrice],
        ["stop loss", stopLoss],
        ["take profit", takeProfit],
        ["volume", positionSize],
        ["profit", profit],
        ["commission", commission],
        ["swap", swap],
        ["fee", fee],
      ],
      rowNumber,
    );
    if (numericError) {
      parseErrors.push(numericError);
      continue;
    }
    const entryDate = normalizeMt5Date(getCell(cells, indexes.openTime));
    const exitDate = normalizeMt5Date(getCell(cells, indexes.closeTime));
    const hasExit = Boolean(exitDate || exitPrice !== null || profit !== null);
    parsedRows.push({
      pair: symbol,
      direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      position_size: positionSize,
      pnl:
        profit === null && commission === null && swap === null && fee === null
          ? null
          : (profit ?? 0) + (commission ?? 0) + (swap ?? 0) + (fee ?? 0),
      status: hasExit ? "closed" : "open",
      notes: getCell(cells, indexes.comment) || null,
      entry_date: entryDate,
      exit_date: exitDate,
      tags: "MT5",
    });
  }
  return { rows: parsedRows, parseErrors, source: "mt5" };
}

/** Parse a Poscal export or common MetaTrader 5 position/deal history file. */
export function parseJournalImport(
  text: string,
  options: { fileName?: string } = {},
): ParsedImport {
  const looksLikeHtml =
    /\.html?$/i.test(options.fileName ?? "") ||
    /<(?:!doctype|html|table)\b/i.test(text);
  const rows = looksLikeHtml ? parseHtmlTables(text) : parseDelimitedText(text);
  if (rows.length === 0) {
    return {
      rows: [],
      parseErrors: [
        looksLikeHtml
          ? "No MT5 trade-history table was found in this HTML report."
          : "Import file is empty.",
      ],
      source: null,
    };
  }
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) {
    return {
      rows: [],
      parseErrors: [
        "Could not find trade columns. Use an MT5 position/deal history report or a Poscal CSV export.",
      ],
      source: null,
    };
  }
  const headers = rows[headerIndex].map(normalizeHeader);
  const isPoscal =
    findColumn(headers, ["pair"]) >= 0 &&
    findColumn(headers, ["direction"]) >= 0 &&
    findColumn(headers, ["entryprice"]) >= 0;
  return isPoscal
    ? parsePoscalRows(rows, headerIndex)
    : parseMt5Rows(rows, headerIndex);
}

export function parseAndValidateJournalImport(
  text: string,
  options: { fileName?: string } = {},
): {
  validTrades: ValidatedTrade[];
  errors: string[];
  source: JournalImportSource | null;
} {
  const { rows, parseErrors, source } = parseJournalImport(text, options);
  if (rows.length === 0)
    return { validTrades: [], errors: parseErrors, source };
  const validated = validateTrades(rows);
  return {
    validTrades: validated.validTrades,
    errors: [...parseErrors, ...validated.errors],
    source,
  };
}

/** Backwards-compatible Poscal CSV entry point. */
export function parseAndValidateJournalCsv(text: string): {
  validTrades: ValidatedTrade[];
  errors: string[];
} {
  const { validTrades, errors } = parseAndValidateJournalImport(text);
  return { validTrades, errors };
}
