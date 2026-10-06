import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));
const nullableBoolean = v.optional(v.union(v.boolean(), v.null()));
const nullableAny = v.optional(v.union(v.any(), v.null()));

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: nullableString,
    fullName: nullableString,
    image: nullableString,
    avatarUrl: nullableString,
    avatarStorageId: v.optional(v.id("_storage")),
    /** Set when generateUploadUrl is called; consumed by saveAvatar (MC-017). */
    pendingAvatarUploadAtMs: nullableNumber,
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
    avatarStorageId: v.optional(v.id("_storage")),
    role: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    subscriptionTier: v.optional(v.string()),
    subscriptionExpiresAtMs: nullableNumber,
    journalOnboardedAtMs: nullableNumber,
    journalTourCompletedAtMs: nullableNumber,
    newsAlertsEnabled: v.optional(v.boolean()),
    timezone: nullableString,
    defaultRiskPercent: nullableNumber,
    tradingRiskAlertsEnabled: v.optional(v.boolean()),
    tradingMilestoneAlertsEnabled: v.optional(v.boolean()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_external_user_id", ["externalUserId"])
    .index("by_payment_expires", ["paymentStatus", "subscriptionExpiresAtMs"]),

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
    /** Incremented whenever a manual trade changes; used to validate analytics snapshots. */
    statsVersion: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_external_id", ["externalId"]),

  tradingJournal: defineTable({
    userId: v.string(),
    journalId: v.optional(v.union(v.id("tradingAccounts"), v.null())),
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
    journalTitle: nullableString,
    richContent: nullableAny,
    journalStatus: v.optional(v.union(
      v.literal("empty"),
      v.literal("draft"),
      v.literal("complete"),
    )),
    journalPreview: nullableString,
    journalUpdatedAtMs: nullableNumber,
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
    .index("by_user_journal_created", ["userId", "journalId", "createdAtMs"])
    .index("by_user_status_created", ["userId", "status", "createdAtMs"])
    .index("by_user_journal_status_created", ["userId", "journalId", "status", "createdAtMs"])
    .index("by_external_id", ["externalId"])
    .index("by_user_external", ["userId", "externalId"]),

  tradeNotebooks: defineTable({
    userId: v.string(),
    journalId: v.id("tradingAccounts"),
    tradeId: v.id("tradingJournal"),
    entryReason: nullableString,
    duringTradeNotes: nullableString,
    postTradeReview: nullableString,
    lessonsLearned: nullableString,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_trade", ["tradeId"])
    .index("by_user_updated", ["userId", "updatedAtMs"]),

  tradeJournalAttachments: defineTable({
    userId: v.string(),
    journalId: v.id("tradingAccounts"),
    tradeId: v.id("tradingJournal"),
    role: v.union(v.literal("before"), v.literal("after")),
    storageProvider: v.literal("r2"),
    objectKey: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    width: nullableNumber,
    height: nullableNumber,
    sortOrder: v.number(),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("deleted")),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_trade_role", ["tradeId", "role", "sortOrder"])
    .index("by_user_created", ["userId", "createdAtMs"])
    .index("by_user_status_created", ["userId", "status", "createdAtMs"])
    .index("by_status_created", ["status", "createdAtMs"]),

  userStorageUsage: defineTable({
    userId: v.string(),
    usedBytes: v.number(),
    attachmentCount: v.number(),
    reservedBytes: v.optional(v.number()),
    reservedCount: v.optional(v.number()),
    updatedAtMs: v.number(),
  }).index("by_user", ["userId"]),

  journalTradeFacts: defineTable({
    userId: v.string(),
    journalId: v.id("tradingAccounts"),
    tradeId: v.id("tradingJournal"),
    analyticsAtMs: v.number(),
    pair: v.string(),
    tags: nullableString,
    pnl: v.number(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_trade", ["tradeId"])
    .index("by_user_journal_date", ["userId", "journalId", "analyticsAtMs"]),

  journalTradeFactsBackfills: defineTable({
    userId: v.string(),
    journalId: v.id("tradingAccounts"),
    sourceVersion: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    cursor: nullableString,
    processedTrades: v.number(),
    startedAtMs: v.number(),
    updatedAtMs: v.number(),
  }).index("by_user_journal", ["userId", "journalId"]),

  journalTradeStats: defineTable({
    userId: v.string(),
    journalId: v.id("tradingAccounts"),
    sourceVersion: v.number(),
    totalTrades: v.number(),
    openTrades: v.number(),
    closedTrades: v.number(),
    cancelledTrades: v.number(),
    closedWithPnl: v.number(),
    wins: v.number(),
    losses: v.number(),
    breakeven: v.number(),
    totalPnl: v.number(),
    grossProfit: v.number(),
    grossLoss: v.number(),
    winPnlSum: v.number(),
    lossAbsSum: v.number(),
    bestTrade: nullableNumber,
    worstTrade: nullableNumber,
    rCount: v.number(),
    rSum: v.number(),
    maxConsecutiveWins: v.number(),
    maxConsecutiveLosses: v.number(),
    maxDrawdown: v.number(),
    processedTrades: v.number(),
    updatedAtMs: v.number(),
  }).index("by_user_journal", ["userId", "journalId"]),

  journalTradeStatsBackfills: defineTable({
    userId: v.string(),
    journalId: v.id("tradingAccounts"),
    sourceVersion: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    cursor: nullableString,
    totalTrades: v.number(),
    openTrades: v.number(),
    closedTrades: v.number(),
    cancelledTrades: v.number(),
    closedWithPnl: v.number(),
    wins: v.number(),
    losses: v.number(),
    breakeven: v.number(),
    totalPnl: v.number(),
    grossProfit: v.number(),
    grossLoss: v.number(),
    winPnlSum: v.number(),
    lossAbsSum: v.number(),
    bestTrade: nullableNumber,
    worstTrade: nullableNumber,
    rCount: v.number(),
    rSum: v.number(),
    currentWinStreak: v.number(),
    currentLossStreak: v.number(),
    maxConsecutiveWins: v.number(),
    maxConsecutiveLosses: v.number(),
    runningPnl: v.number(),
    peakPnl: v.number(),
    maxDrawdown: v.number(),
    processedTrades: v.number(),
    startedAtMs: v.number(),
    updatedAtMs: v.number(),
  }).index("by_user_journal", ["userId", "journalId"]),

  progressSessions: defineTable({
    userId: v.string(),
    journalId: v.optional(v.union(v.id("tradingAccounts"), v.null())),
    dateKey: v.string(),
    phase: v.union(v.literal("pre_market"), v.literal("post_market")),
    preMarketNotes: nullableString,
    postMarketNotes: nullableString,
    tasks: v.array(v.object({
      id: v.string(),
      label: v.string(),
      phase: v.union(v.literal("pre_market"), v.literal("session"), v.literal("post_market")),
      completed: v.boolean(),
    })),
    sessionStarted: v.boolean(),
    journalCreated: v.boolean(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_user_date", ["userId", "dateKey"])
    .index("by_user_journal_date", ["userId", "journalId", "dateKey"]),

  calculatorHistory: defineTable({
    userId: nullableString,
    journalId: v.optional(v.union(v.id("tradingAccounts"), v.null())),
    accountCurrency: nullableString,
    clientId: nullableString,
    pair: nullableString,
    direction: v.optional(v.union(v.literal("buy"), v.literal("sell"), v.null())),
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
    entryPrice: nullableNumber,
    stopLossPrice: nullableNumber,
    takeProfitPrice: nullableNumber,
    accountBalance: v.number(),
    riskPercent: v.number(),
    stopLossPips: nullableNumber,
    takeProfitPips: nullableNumber,
    riskAmount: v.number(),
    positionSize: nullableNumber,
    units: nullableNumber,
    pipValue: nullableNumber,
    spreadPips: nullableNumber,
    priceSource: nullableString,
    lotSize: nullableNumber,
    actualRisk: nullableNumber,
    rewardToRisk: nullableNumber,
    potentialProfit: nullableNumber,
    source: v.optional(v.union(v.literal("manual"), v.literal("signal"), v.null())),
    signalId: nullableString,
    status: v.optional(v.union(
      v.literal("open"),
      v.literal("win"),
      v.literal("loss"),
      v.literal("breakeven"),
      v.literal("cancelled"),
      v.null(),
    )),
    pnlAmount: nullableNumber,
    resultR: nullableNumber,
    note: nullableString,
    screenshotUrls: v.optional(v.union(v.array(v.string()), v.null())),
    screenshotStorageIds: v.optional(v.union(v.array(v.id("_storage")), v.null())),
    openedAtMs: nullableNumber,
    closedAtMs: nullableNumber,
    createdAtMs: v.number(),
    updatedAtMs: nullableNumber,
  })
    .index("by_user_created", ["userId", "createdAtMs"])
    .index("by_user_journal_created", ["userId", "journalId", "createdAtMs"])
    .index("by_user_client", ["userId", "clientId"]),

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

  marketSnapshots: defineTable({
    key: v.string(),
    label: v.string(),
    kind: v.string(),
    rate: nullableNumber,
    bid: nullableNumber,
    ask: nullableNumber,
    changePercent: nullableNumber,
    meta: nullableAny,
    updatedAtMs: v.number(),
  }).index("by_key", ["key"]),

  economicEvents: defineTable({
    externalId: v.string(),
    country: v.string(),
    event: v.string(),
    impact: v.string(),
    scheduledAtMs: v.number(),
    actual: nullableString,
    estimate: nullableString,
    previous: nullableString,
    unit: nullableString,
    /** Official Forex Factory event page. Only linked for current releases. */
    detailUrl: nullableString,
    ingestedAtMs: v.number(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_scheduled", ["scheduledAtMs"])
    .index("by_impact_scheduled", ["impact", "scheduledAtMs"]),

  newsIngestState: defineTable({
    key: v.string(),
    lastIngestAtMs: nullableNumber,
    lastNewsCount: nullableNumber,
    lastError: nullableString,
    updatedAtMs: v.number(),
  }).index("by_key", ["key"]),

  appSettings: defineTable({
    key: v.string(),
    // Nullable so unused typed slots can be cleared (e.g. setAppFont sets valueBoolean: null).
    valueBoolean: nullableBoolean,
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
    .index("by_user_active", ["userId", "isActive"])
    .index("by_endpoint", ["endpoint"])
    .index("by_active", ["isActive"]),

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
    .index("by_user_created", ["userId", "createdAtMs"])
    .index("by_tag", ["tag"]),

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

  appAuthRateLimits: defineTable({
    key: v.string(),
    action: v.string(),
    email: v.string(),
    count: v.number(),
    windowStartMs: v.number(),
    updatedAtMs: v.number(),
  }).index("by_key", ["key"]),
});
