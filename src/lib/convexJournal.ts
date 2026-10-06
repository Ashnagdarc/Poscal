import { tradesApi } from "@/lib/api";
import { getAuthenticatedConvexHttpClient, isConvexEnabled } from "@/lib/convexClient";
import { api } from "../../convex/_generated/api";

export interface JournalTrade {
  id: string;
  journal_id?: string | null;
  pair: string;
  direction: "buy" | "sell" | "long" | "short";
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  risk_percent: number | null;
  risk_amount?: number | null;
  pnl: number | null;
  pnl_percent?: number | null;
  status: "open" | "closed" | "cancelled";
  notes: string | null;
  entry_date: string | null;
  exit_date?: string | null;
  created_at: string;
  journal_type?: "structured" | "notes";
  rich_content?: unknown;
  entry_reason?: string | null;
  during_trade_notes?: string | null;
  post_trade_review?: string | null;
  lessons_learned?: string | null;
  journal_status?: "empty" | "draft" | "complete";
  journal_preview?: string | null;
  journal_updated_at?: string | null;
  images?: Array<{ url: string; caption?: string }>;
  links?: Array<{ url: string; title?: string }>;
  screenshots?: string[];
  market_condition?: string | null;
  tags?: string | null;
}

const toIsoString = (value?: number | null) => {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
};

const parseNumberish = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const fromConvexTrade = (row: any): JournalTrade => ({
  id: row._id,
  journal_id: row.journalId ?? null,
  pair: row.pair,
  direction: row.direction,
  entry_price: row.entryPrice ?? null,
  exit_price: row.exitPrice ?? null,
  stop_loss: row.stopLoss ?? null,
  take_profit: row.takeProfit ?? null,
  position_size: row.positionSize ?? null,
  risk_percent: row.riskPercent ?? null,
  risk_amount: row.riskAmount ?? null,
  pnl: row.pnl ?? null,
  pnl_percent: row.pnlPercent ?? null,
  status: row.status,
  notes: row.notes ?? null,
  entry_date: toIsoString(row.entryDateMs),
  exit_date: toIsoString(row.exitDateMs),
  created_at: new Date(row.createdAtMs).toISOString(),
  journal_type: (row.journalType as "structured" | "notes" | null) ?? "structured",
  rich_content: row.richContent ?? null,
  journal_status: row.journalStatus ?? "empty",
  journal_preview: row.journalPreview ?? null,
  journal_updated_at: toIsoString(row.journalUpdatedAtMs),
  images: Array.isArray(row.images) ? row.images : [],
  links: Array.isArray(row.links) ? row.links : [],
  screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
  market_condition: row.marketCondition ?? null,
  tags: row.tags ?? null,
});

const toConvexTradeInput = (trade: Record<string, any>) => ({
  journalId: trade.journal_id ?? trade.journalId ?? null,
  externalId: trade.externalId ?? null,
  pair: trade.pair || trade.symbol || "JOURNAL",
  direction:
    trade.direction === "sell" || trade.direction === "short"
      ? trade.direction
      : trade.direction === "long"
        ? "long"
        : "buy",
  entryPrice: parseNumberish(trade.entry_price),
  exitPrice: parseNumberish(trade.exit_price),
  stopLoss: parseNumberish(trade.stop_loss),
  takeProfit: parseNumberish(trade.take_profit),
  riskPercent: parseNumberish(trade.risk_percent),
  riskAmount: parseNumberish(trade.risk_amount),
  positionSize: parseNumberish(trade.position_size),
  pnl: parseNumberish(trade.pnl ?? trade.profit_loss),
  pnlPercent: parseNumberish(trade.pnl_percent ?? trade.profit_loss_percentage),
  status: trade.status ?? "open",
  notes: trade.notes ?? null,
  journalType: trade.journal_type ?? null,
  richContent: trade.rich_content ?? null,
  images: trade.images ?? null,
  links: trade.links ?? null,
  screenshots: trade.screenshot_urls ?? trade.screenshots ?? null,
  marketCondition: trade.market_condition ?? null,
  tags: trade.tags ?? null,
  entryDateMs: trade.entry_date ? new Date(trade.entry_date).getTime() : trade.trade_date ? new Date(trade.trade_date).getTime() : null,
  exitDateMs: trade.exit_date ? new Date(trade.exit_date).getTime() : null,
});

const toConvexTradePatch = (updates: Record<string, any>) => {
  const patch: Record<string, any> = {};

  if (updates.pair !== undefined || updates.symbol !== undefined) {
    patch.pair = updates.pair || updates.symbol || "JOURNAL";
  }
  if (updates.direction !== undefined) {
    patch.direction = updates.direction;
  }
  if ("entry_price" in updates) {
    patch.entryPrice = parseNumberish(updates.entry_price);
  }
  if ("exit_price" in updates) {
    patch.exitPrice = parseNumberish(updates.exit_price);
  }
  if ("stop_loss" in updates) {
    patch.stopLoss = parseNumberish(updates.stop_loss);
  }
  if ("take_profit" in updates) {
    patch.takeProfit = parseNumberish(updates.take_profit);
  }
  if ("risk_percent" in updates) {
    patch.riskPercent = parseNumberish(updates.risk_percent);
  }
  if ("risk_amount" in updates) {
    patch.riskAmount = parseNumberish(updates.risk_amount);
  }
  if ("position_size" in updates) {
    patch.positionSize = parseNumberish(updates.position_size);
  }
  if ("pnl" in updates || "profit_loss" in updates) {
    patch.pnl = parseNumberish(updates.pnl ?? updates.profit_loss);
  }
  if ("pnl_percent" in updates || "profit_loss_percentage" in updates) {
    patch.pnlPercent = parseNumberish(updates.pnl_percent ?? updates.profit_loss_percentage);
  }
  if ("status" in updates) {
    patch.status = updates.status;
  }
  if ("notes" in updates) {
    patch.notes = updates.notes ?? null;
  }
  if ("journal_type" in updates) {
    patch.journalType = updates.journal_type ?? null;
  }
  if ("rich_content" in updates) {
    patch.richContent = updates.rich_content ?? null;
  }
  if ("images" in updates) {
    patch.images = updates.images ?? null;
  }
  if ("links" in updates) {
    patch.links = updates.links ?? null;
  }
  if ("screenshot_urls" in updates || "screenshots" in updates) {
    patch.screenshots = updates.screenshot_urls ?? updates.screenshots ?? null;
  }
  if ("market_condition" in updates) {
    patch.marketCondition = updates.market_condition ?? null;
  }
  if ("tags" in updates) {
    patch.tags = updates.tags ?? null;
  }
  if ("entry_date" in updates) {
    patch.entryDateMs = updates.entry_date ? new Date(updates.entry_date).getTime() : null;
  }
  if ("exit_date" in updates) {
    patch.exitDateMs = updates.exit_date ? new Date(updates.exit_date).getTime() : null;
  }

  return patch;
};

/** Matches Convex `listForUser` max; UI should warn when a fetch hits this ceiling. */
export const JOURNAL_FETCH_LIMIT = 500;

export type JournalListResult = {
  trades: JournalTrade[];
  truncated: boolean;
};

export const listJournalEntriesWithMeta = async (
  _userId: string,
  status?: string,
  journalId?: string | null,
): Promise<JournalListResult> => {
  if (isConvexEnabled()) {
    const client = getAuthenticatedConvexHttpClient();
    const rows = await client.query(api.tradingJournal.listForUser, {
      journalId: (journalId as any) ?? null,
      status: status ?? null,
      limit: JOURNAL_FETCH_LIMIT,
    });
    const trades = rows.map(fromConvexTrade);
    return {
      trades,
      truncated: trades.length >= JOURNAL_FETCH_LIMIT,
    };
  }

  const trades = await tradesApi.getAll(status ? { status } : undefined);
  return {
    trades,
    truncated: trades.length >= JOURNAL_FETCH_LIMIT,
  };
};

export const listJournalEntries = async (
  _userId: string,
  status?: string,
  journalId?: string | null,
): Promise<JournalTrade[]> => {
  const { trades } = await listJournalEntriesWithMeta(_userId, status, journalId);
  return trades;
};

export const createJournalEntry = async (_userId: string, trade: Record<string, any>): Promise<JournalTrade> => {
  if (isConvexEnabled()) {
    const client = getAuthenticatedConvexHttpClient();
    const row = await client.mutation(api.tradingJournal.createEntry, toConvexTradeInput(trade));
    return fromConvexTrade(row);
  }

  return await tradesApi.create(trade);
};

export const updateJournalEntry = async (_userId: string, id: string, updates: Record<string, any>): Promise<JournalTrade> => {
  if (isConvexEnabled()) {
    const client = getAuthenticatedConvexHttpClient();
    const row = await client.mutation(api.tradingJournal.updateEntry, {
      id: id as any,
      ...toConvexTradePatch(updates),
    });
    return fromConvexTrade(row);
  }

  return await tradesApi.update(id, updates);
};

export const getJournalEntry = async (
  _userId: string,
  id: string,
): Promise<JournalTrade | null> => {
  if (isConvexEnabled()) {
    const client = getAuthenticatedConvexHttpClient();
    const result = await client.query(api.tradingJournal.getNotebookByTrade, {
      id: id as any,
    });
    if (!result?.trade) return null;

    const trade = fromConvexTrade(result.trade);
    return {
      ...trade,
      entry_reason: result.notebook?.entryReason ?? null,
      during_trade_notes: result.notebook?.duringTradeNotes ?? null,
      post_trade_review: result.notebook?.postTradeReview ?? null,
      lessons_learned: result.notebook?.lessonsLearned ?? null,
    };
  }

  return await tradesApi.getOne(id);
};

export type NotebookPatch = {
  entry_reason?: string | null;
  during_trade_notes?: string | null;
  post_trade_review?: string | null;
  lessons_learned?: string | null;
};

export const updateTradeNotebook = async (
  _userId: string,
  id: string,
  updates: NotebookPatch,
): Promise<JournalTrade> => {
  if (isConvexEnabled()) {
    const client = getAuthenticatedConvexHttpClient();
    const result = await client.mutation(api.tradingJournal.updateNotebook, {
      id: id as any,
      entryReason: updates.entry_reason,
      duringTradeNotes: updates.during_trade_notes,
      postTradeReview: updates.post_trade_review,
      lessonsLearned: updates.lessons_learned,
    });
    if (!result?.trade) throw new Error("Journal entry not found");

    const trade = fromConvexTrade(result.trade);
    return {
      ...trade,
      entry_reason: result.notebook?.entryReason ?? null,
      during_trade_notes: result.notebook?.duringTradeNotes ?? null,
      post_trade_review: result.notebook?.postTradeReview ?? null,
      lessons_learned: result.notebook?.lessonsLearned ?? null,
    };
  }

  return await tradesApi.update(id, updates);
};

export const deleteJournalEntry = async (_userId: string, id: string): Promise<void> => {
  if (isConvexEnabled()) {
    const client = getAuthenticatedConvexHttpClient();
    await client.mutation(api.tradingJournal.deleteEntry, {
      id: id as any,
    });
    return;
  }

  await tradesApi.delete(id);
};

/** Server `saveMany` rejects batches larger than this. */
export const JOURNAL_IMPORT_BATCH_SIZE = 100;

const hashImportRow = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Deterministic fallback for older runtimes.
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const importJournalEntries = async (_userId: string, trades: Record<string, any>[]) => {
  if (isConvexEnabled()) {
    const client = getAuthenticatedConvexHttpClient();
    const items = await Promise.all(
      trades.map(async (trade, index) => {
        const input = toConvexTradeInput(trade);
        const fingerprint = await hashImportRow(JSON.stringify({ index, ...input, externalId: null }));
        return {
          ...input,
          externalId: input.externalId ?? `csv:${fingerprint}`,
        };
      }),
    );
    for (let i = 0; i < items.length; i += JOURNAL_IMPORT_BATCH_SIZE) {
      const chunk = items.slice(i, i + JOURNAL_IMPORT_BATCH_SIZE);
      await client.mutation(api.tradingJournal.saveMany, { items: chunk });
    }
    return;
  }

  for (const trade of trades) {
    await tradesApi.create(trade);
  }
};
