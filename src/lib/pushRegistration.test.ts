import { describe, expect, it } from "vitest";
import {
  isBrowserSubscriptionRegistered,
  shouldRotatePushSubscription,
} from "@/lib/pushRegistration";

describe("push registration state", () => {
  it("recognizes a browser endpoint that is already registered", () => {
    expect(
      isBrowserSubscriptionRegistered("https://push.example/device-1", [
        { endpoint: "https://push.example/device-1" },
      ]),
    ).toBe(true);
  });

  it("does not confuse another device with the current browser", () => {
    expect(
      isBrowserSubscriptionRegistered("https://push.example/device-2", [
        { endpoint: "https://push.example/device-1" },
      ]),
    ).toBe(false);
  });

  it("rotates legacy cross-account endpoint conflicts", () => {
    expect(
      shouldRotatePushSubscription(
        new Error("Push subscription endpoint is already registered"),
      ),
    ).toBe(true);
    expect(
      shouldRotatePushSubscription(
        new Error("Push subscription credentials do not match this device"),
      ),
    ).toBe(true);
    expect(shouldRotatePushSubscription(new Error("Not authenticated"))).toBe(false);
  });
});
