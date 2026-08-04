import { describe, expect, it } from "vitest";
import {
  isMissingAccountAuthError,
  mapPasswordResetRequestError,
  toSafeAuthErrorMessage,
} from "./authErrorMessages";

describe("toSafeAuthErrorMessage", () => {
  it("maps password policy failures", () => {
    expect(toSafeAuthErrorMessage(new Error("Password must be at least 10 characters."), "x")).toBe(
      "Password must be at least 10 characters and include a letter and a number.",
    );
  });

  it("maps Resend / mail not configured", () => {
    expect(
      toSafeAuthErrorMessage(
        new Error("Password reset email is not configured. Set RESEND_API_KEY"),
        "fallback",
      ),
    ).toBe(
      "Email could not be sent. Please try again later, or ask an admin if mail is configured.",
    );
  });

  it("maps quota / rate language", () => {
    expect(
      toSafeAuthErrorMessage(new Error("Could not send (quota exceeded)"), "fallback"),
    ).toBe("Too many attempts. Please wait and try again.");
  });

  it("strips Convex request noise", () => {
    expect(
      toSafeAuthErrorMessage(
        new Error("Something failed\n at foo.ts:1\nRequest ID: abc"),
        "safe",
      ),
    ).toBe("safe");
  });
});

describe("mapPasswordResetRequestError", () => {
  it("soft-succeeds for missing accounts (no enumeration)", () => {
    expect(mapPasswordResetRequestError(new Error("Account not found"))).toBeNull();
    expect(isMissingAccountAuthError(new Error("Could not find account"))).toBe(true);
  });

  it("surfaces real mail failures", () => {
    expect(
      mapPasswordResetRequestError(new Error("Could not send password reset email")),
    ).toMatch(/email could not be sent/i);
  });
});
