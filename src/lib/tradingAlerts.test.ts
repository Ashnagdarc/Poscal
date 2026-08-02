import { describe, expect, it } from "vitest";
import {
  CLOSED_TRADE_ALERT_SCAN_LIMIT,
  evaluateEquityMilestone,
  evaluateRiskAlert,
  evaluateTradeCountMilestone,
  parseDefaultRiskPercent,
  TRADE_COUNT_MILESTONES,
} from "@/lib/tradingAlerts";

describe("tradingAlerts", () => {
  it("keeps closed-trade alert scan cap above highest trade-count milestone", () => {
    expect(CLOSED_TRADE_ALERT_SCAN_LIMIT).toBeGreaterThanOrEqual(
      Math.max(...TRADE_COUNT_MILESTONES),
    );
  });

  it("flags risk above default", () => {
    expect(evaluateRiskAlert(1, 1)).toBeNull();
    expect(evaluateRiskAlert(2.5, 1)).toMatchObject({
      kind: "risk",
      riskPercent: 2.5,
      defaultRiskPercent: 1,
    });
    expect(evaluateRiskAlert(null, 1)).toBeNull();
  });

  it("fires trade-count milestones only on exact thresholds", () => {
    expect(evaluateTradeCountMilestone(9)).toBeNull();
    expect(evaluateTradeCountMilestone(10)?.milestoneKey).toBe("trades-10");
    expect(evaluateTradeCountMilestone(25)?.title).toBe("Trade milestone");
    expect(evaluateTradeCountMilestone(11)).toBeNull();
  });

  it("fires equity milestones on threshold cross", () => {
    // start 10k: previous +400 (4%) → next +600 (6%) crosses 5%
    const alert = evaluateEquityMilestone(10_000, 400, 600);
    expect(alert?.milestoneKey).toBe("equity-5");

    // already above 5% — no re-fire for 5%, but can cross 10%
    expect(evaluateEquityMilestone(10_000, 600, 700)).toBeNull();
    expect(evaluateEquityMilestone(10_000, 900, 1100)?.milestoneKey).toBe("equity-10");
  });

  it("parses default risk from storage", () => {
    expect(parseDefaultRiskPercent("2")).toBe(2);
    expect(parseDefaultRiskPercent(null)).toBe(1);
    expect(parseDefaultRiskPercent("nope")).toBe(1);
  });
});
