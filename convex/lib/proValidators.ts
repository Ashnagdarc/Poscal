import { v } from "convex/values";
import { docValidator } from "convex/server";
import schema from "../schema";
export const orderDoc = docValidator("proOrders", schema.tables.proOrders);
export const couponDoc = docValidator("proCoupons", schema.tables.proCoupons);
export const accessValidator = v.object({
  userId: v.id("users"),
  beta: v.boolean(),
  enabled: v.boolean(),
  paid: v.boolean(),
  pro: v.boolean(),
  expiresAtMs: v.union(v.number(), v.null()),
  limits: v.object({
    journals: v.number(),
    entriesPerMonth: v.union(v.number(), v.null()),
    screenshots: v.number(),
    storageBytes: v.number(),
  }),
  freeJournalId: v.union(v.id("tradingAccounts"), v.null()),
  canChooseFreeJournal: v.boolean(),
  lockedJournalIds: v.array(v.id("tradingAccounts")),
  usage: v.object({
    journals: v.number(),
    entries: v.number(),
    screenshots: v.number(),
    storageBytes: v.number(),
  }),
  autoRenew: v.object({
    enabled: v.boolean(),
    plan: v.union(v.literal("monthly"), v.literal("yearly"), v.null()),
    amount: v.union(v.number(), v.null()),
    nextChargeAtMs: v.union(v.number(), v.null()),
    last4: v.union(v.string(), v.null()),
    brand: v.union(v.string(), v.null()),
  }),
});
export const clientOrderValidator = v.object({
  id: v.id("proOrders"),
  reference: v.string(),
  status: schema.tables.proOrders.validator.fields.status,
  plan: schema.tables.proOrders.validator.fields.plan,
  amount: v.number(),
  currency: v.literal("NGN"),
  checkoutUrl: v.union(v.string(), v.null()),
  accessCode: v.union(v.string(), v.null()),
  returnTo: v.string(),
  expiresAtMs: v.union(v.number(), v.null()),
  reviewReason: v.union(v.string(), v.null()),
  createdAtMs: v.number(),
});
