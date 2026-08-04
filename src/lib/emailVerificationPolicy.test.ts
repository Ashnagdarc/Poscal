import { afterEach, describe, expect, it } from "vitest";

/**
 * Mirror of convex/lib/emailVerificationPolicy.ts parse rules for unit tests
 * (Convex server modules are not run through vite path aliases in unit tests).
 */
function isEmailVerificationRequiredFromEnv(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

describe("REQUIRE_EMAIL_VERIFICATION env parsing", () => {
  afterEach(() => {
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
  });

  it("defaults to off when unset", () => {
    expect(isEmailVerificationRequiredFromEnv(undefined)).toBe(false);
  });

  it("treats falsey strings as off", () => {
    for (const v of ["", "0", "false", "FALSE", "no", "off", "  false  "]) {
      expect(isEmailVerificationRequiredFromEnv(v)).toBe(false);
    }
  });

  it("treats truthy strings as on", () => {
    for (const v of ["1", "true", "TRUE", "yes", "on"]) {
      expect(isEmailVerificationRequiredFromEnv(v)).toBe(true);
    }
  });
});
