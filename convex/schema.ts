import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));

export default defineSchema({
  profiles: defineTable({
    externalUserId: nullableString,
    email: v.string(),
    fullName: nullableString,
    avatarUrl: nullableString,
    role: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    subscriptionTier: v.optional(v.string()),
    subscriptionExpiresAtMs: nullableNumber,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_external_user_id", ["externalUserId"]),

  tradingAccounts: defineTable({
    userId: v.string(),
    externalId: nullableString,
    name: v.string(),
    broker: nullableString,
    currency: v.string(),
    balance: v.number(),
    startingBalance: nullableNumber,
    status: v.optional(v.string()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_external_id", ["externalId"]),

  tradingJournal: defineTable({
    userId: v.string(),
    accountId: nullableString,
    externalId: nullableString,
    pair: v.string(),
    direction: v.union(v.literal("buy"), v.literal("sell"), v.literal("long"), v.literal("short")),
    entryPrice: nullableNumber,
    exitPrice: nullableNumber,
    stopLossPips: nullableNumber,
    takeProfitPips: nullableNumber,
    riskPercent: nullableNumber,
    riskAmount: nullableNumber,
    positionSize: nullableNumber,
    pnl: nullableNumber,
    notes: nullableString,
    openedAtMs: nullableNumber,
    closedAtMs: nullableNumber,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_user_created", ["userId", "createdAtMs"])
    .index("by_account_created", ["accountId", "createdAtMs"])
    .index("by_external_id", ["externalId"]),

  calculatorHistory: defineTable({
    userId: nullableString,
    clientId: nullableString,
    pair: v.string(),
    direction: v.union(v.literal("buy"), v.literal("sell")),
    accountBalance: v.number(),
    riskPercent: v.number(),
    stopLossPips: v.number(),
    takeProfitPips: nullableNumber,
    riskAmount: v.number(),
    positionSize: v.number(),
    units: v.number(),
    pipValue: v.number(),
    spreadPips: nullableNumber,
    priceSource: v.string(),
    createdAtMs: v.number(),
  })
    .index("by_user_created", ["userId", "createdAtMs"])
    .index("by_user_client", ["userId", "clientId"])
    .index("by_pair_created", ["pair", "createdAtMs"]),

  priceSnapshots: defineTable({
    symbol: v.string(),
    bidPrice: nullableNumber,
    askPrice: nullableNumber,
    midPrice: v.number(),
    source: v.string(),
    isEstimatedBidAsk: v.boolean(),
    providerTimestampMs: nullableNumber,
    updatedAtMs: v.number(),
  }).index("by_symbol", ["symbol"]),

  notificationQueue: defineTable({
    userId: nullableString,
    channel: v.union(v.literal("push"), v.literal("email"), v.literal("in_app")),
    title: v.string(),
    body: v.string(),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    scheduledForMs: nullableNumber,
    attempts: v.number(),
    errorMessage: nullableString,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_status_scheduled", ["status", "scheduledForMs"])
    .index("by_user_created", ["userId", "createdAtMs"]),

  migrationCheckpoints: defineTable({
    source: v.string(),
    tableName: v.string(),
    externalId: nullableString,
    status: v.union(v.literal("pending"), v.literal("imported"), v.literal("failed"), v.literal("skipped")),
    message: nullableString,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_source_table", ["source", "tableName"])
    .index("by_status", ["status"]),
});
