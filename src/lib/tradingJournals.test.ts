import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteTradingJournal } from "./tradingJournals";

vi.mock("@/lib/authTokenStore", () => ({
  getConvexAuthTokenMirror: () => "test-token",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deleteTradingJournal", () => {
  it("stops after one request when the API route returns the app shell", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", request);

    await expect(deleteTradingJournal("user-1", "journal-1")).rejects.toThrow(
      "Journal deletion service is unavailable",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("continues bounded cleanup until the journal is deleted", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, done: false }), {
          status: 202,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, done: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", request);

    await expect(deleteTradingJournal("user-1", "journal-1")).resolves.toEqual({
      success: true,
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
