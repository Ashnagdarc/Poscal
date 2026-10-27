import { describe, expect, it } from "vitest";

import { apiHandlers } from "../server/apiHandlers";

describe("Openship production API routes", () => {
  it("registers every server-side endpoint shipped by the application", () => {
    expect(Object.keys(apiHandlers).sort()).toEqual([
      "/api/account-delete",
      "/api/journal-book",
      "/api/journal-entry",
      "/api/journal-images",
      "/api/paystack-webhook",
      "/api/prices",
      "/api/prices/multiple",
    ]);
  });
});
