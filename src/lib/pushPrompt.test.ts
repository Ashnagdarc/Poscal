import { describe, expect, it } from "vitest";

import { shouldShowPushEnablePrompt } from "@/lib/pushPrompt";

const ready = {
  pathname: "/journal",
  isAuthenticated: true,
  authLoading: false,
  checked: true,
  isSupported: true,
  isConfigured: true,
  isSubscribed: false,
  dismissedThisVisit: false,
};

describe("shouldShowPushEnablePrompt", () => {
  it("shows for a signed-in user who has not turned push on", () => {
    expect(shouldShowPushEnablePrompt(ready)).toBe(true);
  });

  it("stays hidden once push is on, before the check finishes, or after dismiss", () => {
    expect(shouldShowPushEnablePrompt({ ...ready, isSubscribed: true })).toBe(false);
    expect(shouldShowPushEnablePrompt({ ...ready, checked: false })).toBe(false);
    expect(shouldShowPushEnablePrompt({ ...ready, dismissedThisVisit: true })).toBe(false);
    expect(shouldShowPushEnablePrompt({ ...ready, isAuthenticated: false })).toBe(false);
  });

  it("does not cover sign-in or the welcome screen", () => {
    expect(shouldShowPushEnablePrompt({ ...ready, pathname: "/signin" })).toBe(false);
    expect(shouldShowPushEnablePrompt({ ...ready, pathname: "/welcome" })).toBe(false);
    expect(shouldShowPushEnablePrompt({ ...ready, pathname: "/" })).toBe(true);
  });
});
