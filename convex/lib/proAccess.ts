import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  FREE_LIMITS,
  PRO_LIMITS,
  PRO_LOCK_KEY,
  utcMonth,
} from "../../shared/proPolicy";

export async function getProAccess(
  ctx: QueryCtx,
  userId: Id<"users">,
  now = Date.now(),
) {
  const setting = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", PRO_LOCK_KEY))
    .unique();
  const account = await ctx.db
    .query("proAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const enabled = setting?.valueBoolean === true;
  const paid =
    account?.paymentMode === process.env.PRO_PAYMENT_MODE &&
    (account?.expiresAtMs ?? 0) > now;
  const pro = !enabled || paid;
  const journals = await getActiveJournals(ctx, userId);
  const active = journals;
  const chosen = active.find((j) => j._id === account?.freeJournalId);
  const oldest = [...active].sort(
    (a, b) =>
      a.createdAtMs - b.createdAtMs || a._creationTime - b._creationTime,
  )[0];
  const freeJournalId = chosen?._id ?? oldest?._id ?? null;
  const usage = await ctx.db
    .query("proUsage")
    .withIndex("by_user_month", (q) =>
      q.eq("userId", userId).eq("month", utcMonth(now)),
    )
    .unique();
  const storage = await ctx.db
    .query("userStorageUsage")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return {
    userId,
    beta: !enabled,
    enabled,
    paid,
    pro,
    expiresAtMs: account?.expiresAtMs ?? null,
    limits: pro ? PRO_LIMITS : FREE_LIMITS,
    freeJournalId,
    canChooseFreeJournal: !account?.freeJournalChosen,
    lockedJournalIds: pro
      ? []
      : journals.filter((j) => j._id !== freeJournalId).map((j) => j._id),
    usage: {
      journals: active.length,
      entries: usage?.entriesCreated ?? 0,
      screenshots: storage?.attachmentCount ?? 0,
      storageBytes: storage?.usedBytes ?? 0,
    },
  };
}

/** Two indexed ranges include legacy unset statuses without scanning archives. */
export async function getActiveJournals(ctx: QueryCtx, userId: Id<"users">) {
  const [before, after] = await Promise.all([
    ctx.db
      .query("tradingAccounts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).lt("status", "archived"),
      )
      .take(100),
    ctx.db
      .query("tradingAccounts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).gt("status", "archived"),
      )
      .take(100),
  ]);
  return [...before, ...after];
}

export async function assertEditableJournal(
  ctx: QueryCtx,
  userId: Id<"users">,
  journalId?: Id<"tradingAccounts"> | null,
) {
  const access = await getProAccess(ctx, userId);
  if (journalId) {
    const journal = await ctx.db.get(journalId);
    if (!journal || journal.userId !== userId)
      throw new Error("Journal not found");
    if (
      journal.status === "archived" ||
      (!access.pro && journalId !== access.freeJournalId)
    ) {
      throw new Error(
        "PRO_REQUIRED: This journal is read-only. Your data is safe. Open Poscal Pro to unlock it.",
      );
    }
  } else if (!access.pro) {
    throw new Error("Choose your editable journal before adding an entry");
  }
  return access;
}

/** Counts creations, including drafts; deletion never replenishes the allowance. */
export async function consumeEntryAllowance(
  ctx: MutationCtx,
  userId: Id<"users">,
  journalId?: Id<"tradingAccounts"> | null,
  count = 1,
) {
  const access = await assertEditableJournal(ctx, userId, journalId);
  const month = utcMonth(Date.now());
  const usage = await ctx.db
    .query("proUsage")
    .withIndex("by_user_month", (q) =>
      q.eq("userId", userId).eq("month", month),
    )
    .unique();
  if (
    !access.pro &&
    (usage?.entriesCreated ?? 0) + count > FREE_LIMITS.entriesPerMonth
  )
    throw new Error(
      "PRO_REQUIRED: Monthly entry allowance reached. Your existing entries remain available.",
    );
  // Beta creations do not consume the first paid-launch month's free allowance.
  if (!access.enabled) return;
  if (usage)
    await ctx.db.patch(usage._id, {
      entriesCreated: usage.entriesCreated + count,
    });
  else
    await ctx.db.insert("proUsage", { userId, month, entriesCreated: count });
}
