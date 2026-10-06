import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presignR2Object } from "./r2.js";

const ORIGINAL_ENV = { ...process.env };

describe("R2 SigV4 presigning", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T17:46:00.123Z"));
    process.env.R2_ENDPOINT = "https://exampleaccount.r2.cloudflarestorage.com";
    process.env.R2_BUCKET_NAME = "poscal-journal";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...ORIGINAL_ENV };
  });

  it("emits the AWS basic ISO8601 timestamp required by SigV4", () => {
    const url = new URL(
      presignR2Object(
        "PUT",
        "journal/user/trade/before/image.webp",
        300,
      ),
    );

    expect(url.searchParams.get("X-Amz-Date")).toBe("20261006T174600Z");
    expect(url.searchParams.get("X-Amz-Date")).toMatch(/^\d{8}T\d{6}Z$/);
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("signs the intended private bucket object path and expiry", () => {
    const url = new URL(
      presignR2Object(
        "GET",
        "journal/user id/trade/after/chart 1.webp",
        900,
      ),
    );

    expect(url.origin).toBe("https://exampleaccount.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(
      "/poscal-journal/journal/user%20id/trade/after/chart%201.webp",
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
  });
});
