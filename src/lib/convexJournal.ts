import { tradesApi } from "@/lib/api";
import { convexClient } from "@/lib/convexClient";
import { api } from "../../convex/_generated/api";

export interface JournalTrade {
  id: string;
  pair: string;
  direction: "buy" | "sell" | "long" | "short";
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  risk_percent: number | null;
  pnl: number | null;
  pnl_percent?: number | null;
  status: "open" | "closed" | "cancelled";
  notes: string | null;
  entry_date: string | null;
  exit_date?: string | null;
  created_at: string;
  journal_type?: "structured" | "notes";
  rich_content?: unknown;
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

const fromConvexTrade = (row: any): JournalTrade => ({
  id: row._id,
  pair: row.pair,
  direction: row.direction,
  entry_price: row.entryPrice ?? null,
  exit_price: row.exitPrice ?? null,
  stop_loss: row.stopLoss ?? null,
  take_profit: row.takeProfit ?? null,
  position_size: row.positionSize ?? null,
  risk_percent: row.riskPercent ?? null,
  pnl: row.pnl ?? null,
  pnl_percent: row.pnlPercent ?? null,
  status: row.status,
  notes: row.notes ?? null,
  entry_date: toIsoString(row.entryDateMs),
  exit_date: toIsoString(row.exitDateMs),
  created_at: new Date(row.createdAtMs).toISOString(),
  journal_type: (row.journalType as "structured" | "notes" | null) ?? "structured",
  rich_content: row.richContent ?? null,
  images: Array.isArray(row.images) ? row.images : [],
  links: Array.isArray(row.links) ? row.links : [],
  screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
  market_condition: row.marketCondition ?? null,
  tags: row.tags ?? null,
});

const toConvexTradeInput = (userId: string, trade: Record<string, any>) => ({
  userId,
  externalId: trade.externalId ?? null,
  pair: trade.pair || trade.symbol || "JOURNAL",
  direction: trade.direction === "sell" || trade.direction === "short" ? trade.direction : "buy",
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

const toConvexTradePatch = (userId: string, updates: Record<string, any>) => {
  const patch: Record<string, any> = { userId };

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

export const listJournalEntries = async (userId: string, status?: string): Promise<JournalTrade[]> => {
  if (convexClient) {
    const rows = await convexClient.query(api.tradingJournal.listForUser, {
      userId,
      status: status ?? null,
      limit: 300,
    });
    return rows.map(fromConvexTrade);
  }

  return await tradesApi.getAll(status ? { status } : undefined);
};

export const createJournalEntry = async (userId: string, trade: Record<string, any>): Promise<JournalTrade> => {
  if (convexClient) {
    const row = await convexClient.mutation(api.tradingJournal.createEntry, toConvexTradeInput(userId, trade));
    return fromConvexTrade(row);
  }

  return await tradesApi.create(trade);
};

export const updateJournalEntry = async (userId: string, id: string, updates: Record<string, any>): Promise<JournalTrade> => {
  if (convexClient) {
    const row = await convexClient.mutation(api.tradingJournal.updateEntry, {
      id: id as any,
      ...toConvexTradePatch(userId, updates),
    });
    return fromConvexTrade(row);
  }

  return await tradesApi.update(id, updates);
};

export const deleteJournalEntry = async (userId: string, id: string): Promise<void> => {
  if (convexClient) {
    await convexClient.mutation(api.tradingJournal.deleteEntry, {
      id: id as any,
      userId,
    });
    return;
  }

  await tradesApi.delete(id);
};

export const importJournalEntries = async (userId: string, trades: Record<string, any>[]) => {
  if (convexClient) {
    await convexClient.mutation(api.tradingJournal.saveMany, {
      items: trades.map((trade) => toConvexTradeInput(userId, trade)),
    });
    return;
  }

  for (const trade of trades) {
    await tradesApi.create(trade);
  }
};
