import { describe, expect, it } from "vitest";
import { parseActionError } from "@/lib/actionError";

describe("parseActionError", () => {
  it("maps unsupported pair messages to actionable copy", () => {
    const info = parseActionError(
      new Error("Unsupported trade pair: XAUUS. Did you mean XAU/USD?"),
      { title: "Couldn't save trade" },
    );
    expect(info.title).toBe("Symbol not recognized");
    expect(info.whatToDo).toMatch(/XAU\/USD/);
    expect(info.code).toBe("PAIR");
  });

  it("maps auth failures", () => {
    const info = parseActionError(new Error("Uncaught Error: Not authenticated"));
    expect(info.title).toBe("Sign in required");
  });

  it("falls back without leaking stack noise", () => {
    const info = parseActionError(new Error("[CONVEX M(foo)] Server Error\nat foo.ts:1"), {
      title: "Save failed",
      fallbackMessage: "Could not save.",
    });
    expect(info.message).toBe("Could not save.");
    expect(info.code).toBe("UNKNOWN");
  });
});
