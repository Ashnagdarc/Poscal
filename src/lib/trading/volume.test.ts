import { describe, expect, it } from "vitest";
import { normalizeVolumeDown } from "@/lib/trading/volume";

describe("normalizeVolumeDown", () => {
  it("does not lose a lot step to floating-point noise", () => {
    expect(normalizeVolumeDown(0.19999999999999998, 0.01)).toBe(0.2);
    expect(normalizeVolumeDown(0.49999999999999994, 0.01)).toBe(0.5);
  });

  it("still rounds materially smaller positions down", () => {
    expect(normalizeVolumeDown(0.1999, 0.01)).toBe(0.19);
    expect(normalizeVolumeDown(0.619, 0.01)).toBe(0.61);
  });

  it("supports non-decimal-tenth steps", () => {
    expect(normalizeVolumeDown(1.4999999999999998, 0.25)).toBe(1.5);
    expect(normalizeVolumeDown(1.49, 0.25)).toBe(1.25);
  });
});
