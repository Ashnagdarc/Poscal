import { afterEach, describe, expect, it } from "vitest";

import { isOptionalBackgroundWorkPaused } from "./backgroundWork";

const originalValue = process.env.POSCAL_OPTIONAL_BACKGROUND_WORK_PAUSED;

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env.POSCAL_OPTIONAL_BACKGROUND_WORK_PAUSED;
  } else {
    process.env.POSCAL_OPTIONAL_BACKGROUND_WORK_PAUSED = originalValue;
  }
});

describe("optional background work switch", () => {
  it.each(["1", "true", "TRUE", " yes ", "on"])(
    "pauses for %j",
    (value) => {
      expect(isOptionalBackgroundWorkPaused(value)).toBe(true);
    },
  );

  it.each([undefined, "", "0", "false", "off", "unexpected"])(
    "stays enabled for %j",
    (value) => {
      expect(isOptionalBackgroundWorkPaused(value)).toBe(false);
    },
  );

  it("reads the deployment environment by default", () => {
    process.env.POSCAL_OPTIONAL_BACKGROUND_WORK_PAUSED = "true";
    expect(isOptionalBackgroundWorkPaused()).toBe(true);
  });
});
