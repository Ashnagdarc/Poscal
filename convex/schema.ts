import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));
const nullableAny = v.optional(v.union(v.any(), v.null()));

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: nullableString,
    fullName: nullableString,
    image: nullableString,
    avatarUrl: nullableString,
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    subscriptionTier: v.optional(v.string()),
    subscriptionExpiresAtMs: nullableNumber,
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  profiles: defineTable({
    externalUserId: v.string(),
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
    externalId: nullableString,
    pair: v.string(),
    direction: v.union(v.literal("buy"), v.literal("sell"), v.literal("long"), v.literal("short")),
    entryPrice: nullableNumber,
    exitPrice: nullableNumber,
    stopLoss: nullableNumber,
    takeProfit: nullableNumber,
    riskPercent: nullableNumber,
    riskAmount: nullableNumber,
    positionSize: nullableNumber,
    pnl: nullableNumber,
    pnlPercent: nullableNumber,
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("cancelled")),
    notes: nullableString,
    journalType: nullableString,
    richContent: nullableAny,
    images: nullableAny,
    links: nullableAny,
    screenshots: nullableAny,
    marketCondition: nullableString,
    tags: nullableString,
    entryDateMs: nullableNumber,
    exitDateMs: nullableNumber,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_user_created", ["userId", "createdAtMs"])
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

  signals: defineTable({
    externalId: nullableString,
    currencyPair: v.string(),
    symbol: nullableString,
    orderType: v.optional(v.union(
      v.literal("buy"),
      v.literal("sell"),
      v.literal("buy_limit"),
      v.literal("sell_limit"),
      v.literal("buy_stop"),
      v.literal("sell_stop"),
      v.null(),
    )),
    direction: v.union(v.literal("buy"), v.literal("sell")),
    marketExecution: nullableString,
    entryPrice: nullableNumber,
    stopLoss: v.number(),
    takeProfit1: v.number(),
    takeProfit2: nullableNumber,
    takeProfit3: nullableNumber,
    takeProfit: nullableNumber,
    pipsToSl: v.number(),
    pipsToTp1: v.number(),
    pipsToTp2: nullableNumber,
    pipsToTp3: nullableNumber,
    analysis: nullableString,
    timeframe: nullableString,
    expiresAtMs: nullableNumber,
    status: v.union(v.literal("active"), v.literal("hit_tp"), v.literal("hit_sl"), v.literal("cancelled"), v.literal("closed"), v.literal("expired")),
    result: v.optional(v.union(v.literal("win"), v.literal("loss"), v.literal("breakeven"), v.null())),
    tp1Hit: v.boolean(),
    tp2Hit: v.boolean(),
    tp3Hit: v.boolean(),
    notes: nullableString,
    tradingViewUrl: v.optional(v.union(v.string(), v.null())),
    chartImageUrl: nullableString,
    confidenceScore: nullableNumber,
    takenCount: v.number(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    closedAtMs: nullableNumber,
  })
    .index("by_created", ["createdAtMs"])
    .index("by_status_created", ["status", "createdAtMs"])
    .index("by_pair_created", ["currencyPair", "createdAtMs"]),

  appSettings: defineTable({
    key: v.string(),
    valueBoolean: v.optional(v.boolean()),
    valueString: nullableString,
    valueNumber: nullableNumber,
    updatedAtMs: v.number(),
    updatedByUserId: nullableString,
  }).index("by_key", ["key"]),

  appUpdates: defineTable({
    title: v.string(),
    description: v.string(),
    isActive: v.boolean(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    createdByUserId: nullableString,
  }).index("by_created", ["createdAtMs"]),

  pushSubscriptions: defineTable({
    userId: nullableString,
    endpoint: v.string(),
    p256dhKey: v.string(),
    authKey: v.string(),
    isActive: v.boolean(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    lastVerifiedAtMs: nullableNumber,
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  ingestorHealth: defineTable({
    key: v.string(),
    recent401Count: v.number(),
    last401AtMs: nullableNumber,
    lastFlushAtMs: nullableNumber,
    backendReachable: v.boolean(),
    updatedAtMs: v.number(),
  }).index("by_key", ["key"]),

  paymentRecords: defineTable({
    userId: v.string(),
    reference: v.string(),
    tier: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    expiresAtMs: nullableNumber,
    paidAtMs: v.number(),
    metadata: nullableAny,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_user_paid", ["userId", "paidAtMs"])
    .index("by_reference", ["reference"]),

  notificationQueue: defineTable({
    userId: nullableString,
    channel: v.union(v.literal("push"), v.literal("email"), v.literal("in_app")),
    title: v.string(),
    body: v.string(),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("sent"), v.literal("failed")),
    recipientEmail: nullableString,
    tag: nullableString,
    data: nullableAny,
    scheduledForMs: nullableNumber,
    processingStartedAtMs: nullableNumber,
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
