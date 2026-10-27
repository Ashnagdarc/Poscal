import accountDelete from "../api/account-delete.ts";
import journalBook from "../api/journal-book.ts";
import journalEntry from "../api/journal-entry.ts";
import journalImages from "../api/journal-images.ts";
import paystackWebhook from "../api/paystack-webhook.ts";
import prices from "../api/prices.ts";
import pricesMultiple from "../api/prices/multiple.ts";
import type { ApiHandler } from "./vercelAdapter.ts";

export const apiHandlers: Record<string, ApiHandler> = {
  "/api/account-delete": accountDelete as ApiHandler,
  "/api/journal-book": journalBook as ApiHandler,
  "/api/journal-entry": journalEntry as ApiHandler,
  "/api/journal-images": journalImages as ApiHandler,
  "/api/paystack-webhook": paystackWebhook as ApiHandler,
  "/api/prices": prices as ApiHandler,
  "/api/prices/multiple": pricesMultiple as ApiHandler,
};
