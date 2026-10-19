import { describe, expect, it } from "vitest";
import {
  isBrowserSubscriptionRegistered,
  pushSetupErrorMessage,
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

describe("push setup errors", () => {
  it("names a service worker failure instead of a Poscal timeout", () => {
    expect(pushSetupErrorMessage(new Error("Service worker did not become active"))).toMatch(
      /service worker did not activate/i,
    );
    expect(pushSetupErrorMessage(new Error("Service Worker ready timeout"))).not.toMatch(
      /contacting Poscal/i,
    );
  });

  it("keeps a real server timeout distinct", () => {
    expect(pushSetupErrorMessage(new Error("Server request timeout"))).toMatch(
      /contacting Poscal/i,
    );
  });
});
