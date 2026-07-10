import { query } from "./_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const [profile, account, trade, price] = await Promise.all([
      ctx.db.query("profiles").first(),
      ctx.db.query("tradingAccounts").first(),
      ctx.db.query("tradingJournal").first(),
      ctx.db.query("priceSnapshots").first(),
    ]);

    return {
      ok: true,
      migrationStage: "schema_ready",
      hasAnyProfile: profile !== null,
      hasAnyTradingAccount: account !== null,
      hasAnyTrade: trade !== null,
      hasAnyPriceSnapshot: price !== null,
      checkedAtMs: Date.now(),
    };
  },
});
