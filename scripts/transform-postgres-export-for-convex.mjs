#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";

const inputDir = process.argv[2] || "exports/convex";
const outputDir = process.argv[3] || "exports/convex-ready";

const toMs = (value) => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readJsonl = async (file) => {
  const fullPath = path.join(inputDir, file);
  if (!fs.existsSync(fullPath)) return [];

  const rows = [];
  const stream = fs.createReadStream(fullPath);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of lines) {
    if (line.trim()) rows.push(JSON.parse(line));
  }

  return rows;
};

const writeJsonl = (file, rows) => {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, file),
    rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
  );
};

const users = await readJsonl("users.raw.jsonl");
const profiles = await readJsonl("profiles.raw.jsonl");
const roles = await readJsonl("user_roles.raw.jsonl");
const accounts = await readJsonl("trading_accounts.raw.jsonl");
const trades = await readJsonl("trading_journal.raw.jsonl");
const prices = await readJsonl("price_cache.raw.jsonl");
const pushQueue = await readJsonl("push_notification_queue.raw.jsonl");
const emailQueue = await readJsonl("email_queue.raw.jsonl");

const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
const roleByUserId = new Map(roles.map((role) => [role.user_id, role.role]));

writeJsonl("profiles.jsonl", users.map((user) => {
  const profile = profileById.get(user.id);
  return {
    externalUserId: user.id,
    email: user.email ?? profile?.email,
    fullName: user.full_name ?? profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    role: user.is_admin ? "admin" : roleByUserId.get(user.id) ?? "user",
    paymentStatus: user.subscription_tier && user.subscription_tier !== "free" ? "paid" : "free",
    subscriptionTier: user.subscription_tier ?? "free",
    subscriptionExpiresAtMs: toMs(user.subscription_expires_at),
    createdAtMs: toMs(user.created_at) ?? Date.now(),
    updatedAtMs: toMs(user.updated_at) ?? Date.now(),
  };
}).filter((row) => row.email));

writeJsonl("tradingAccounts.jsonl", accounts.map((account) => ({
  userId: account.user_id,
  externalId: account.id,
  name: account.account_name ?? "Trading Account",
  broker: account.platform ?? null,
  currency: account.currency ?? "USD",
  balance: toNumber(account.current_balance) ?? 0,
  startingBalance: toNumber(account.initial_balance),
  status: account.is_active === false ? "inactive" : "active",
  createdAtMs: toMs(account.created_at) ?? Date.now(),
  updatedAtMs: toMs(account.updated_at) ?? Date.now(),
})));

writeJsonl("tradingJournal.jsonl", trades.map((trade) => ({
  userId: trade.user_id,
  accountId: trade.account_id ?? null,
  externalId: trade.id,
  pair: trade.symbol ?? "UNKNOWN",
  direction: trade.direction === "short" || trade.direction === "sell" ? "short" : "long",
  entryPrice: toNumber(trade.entry_price),
  exitPrice: toNumber(trade.exit_price),
  stopLossPips: null,
  takeProfitPips: null,
  riskPercent: null,
  riskAmount: null,
  positionSize: toNumber(trade.position_size),
  pnl: toNumber(trade.profit_loss),
  notes: trade.notes ?? null,
  openedAtMs: toMs(trade.trade_date),
  closedAtMs: trade.status === "closed" ? toMs(trade.updated_at) : null,
  createdAtMs: toMs(trade.created_at) ?? Date.now(),
  updatedAtMs: toMs(trade.updated_at) ?? Date.now(),
})));

writeJsonl("priceSnapshots.jsonl", prices.map((price) => ({
  symbol: price.symbol,
  bidPrice: toNumber(price.bid_price),
  askPrice: toNumber(price.ask_price),
  midPrice: toNumber(price.mid_price) ?? toNumber(price.ask_price) ?? toNumber(price.bid_price) ?? 0,
  source: "postgres_price_cache",
  isEstimatedBidAsk: true,
  providerTimestampMs: toNumber(price.timestamp),
  updatedAtMs: toMs(price.updated_at) ?? Date.now(),
})));

writeJsonl("notificationQueue.jsonl", [
  ...pushQueue.map((notification) => ({
    userId: notification.user_id ?? null,
    channel: "push",
    title: notification.title,
    body: notification.body,
    status: notification.status === "sent" ? "sent" : notification.status === "failed" ? "failed" : "pending",
    scheduledForMs: toMs(notification.scheduled_for),
    attempts: toNumber(notification.attempts) ?? 0,
    errorMessage: notification.error_message ?? null,
    createdAtMs: toMs(notification.created_at) ?? Date.now(),
    updatedAtMs: toMs(notification.updated_at) ?? Date.now(),
  })),
  ...emailQueue.map((email) => ({
    userId: email.user_id ?? null,
    channel: "email",
    title: email.subject ?? email.email_type ?? "Email",
    body: email.text_content ?? email.html_content ?? "",
    status: email.status === "sent" ? "sent" : email.status === "failed" ? "failed" : "pending",
    scheduledForMs: toMs(email.scheduled_for),
    attempts: toNumber(email.attempts) ?? 0,
    errorMessage: email.error_message ?? null,
    createdAtMs: toMs(email.created_at) ?? Date.now(),
    updatedAtMs: toMs(email.updated_at) ?? Date.now(),
  })),
]);

console.log(`[transform] wrote Convex-ready JSONL files to ${outputDir}`);
