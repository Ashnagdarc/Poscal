import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));

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
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  profiles: defineTable({
    externalUserId: v.string(),
    email: v.string(),
    fullName: nullableString,
    avatarUrl: nullableString,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_external_user_id", ["externalUserId"]),

  userSettings: defineTable({
    userId: v.string(),
    defaultRiskPercent: nullableNumber,
    accountCurrency: nullableString,
    theme: nullableString,
    hapticsEnabled: v.optional(v.boolean()),
    updatedAtMs: v.number(),
  }).index("by_user", ["userId"]),

  brokerProfiles: defineTable({
    userId: v.string(),
    name: v.string(),
    brokerId: v.string(),
    accountCurrency: nullableString,
    notes: nullableString,
    updatedAtMs: v.number(),
    createdAtMs: v.number(),
  }).index("by_user", ["userId"]),

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
});
