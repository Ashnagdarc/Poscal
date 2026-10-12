import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { useQuery } from "convex/react";
import { useJournalTradeFacts } from "./use-journal-trade-facts";

const state = vi.hoisted(() => ({ ready: true, ensure: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: () => state.ensure }));
vi.mock("@/lib/convexJournal", () => ({ fromConvexTrade: (row: unknown) => row }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/contexts/JournalContext", () => ({ useJournal: () => ({ activeJournalId: "journal" }) }));

const activeQueries = () => vi.mocked(useQuery).mock.calls
  .filter(([, args]) => args !== "skip")
  .map(([ref]) => getFunctionName(ref));

describe("journal analytics subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ready = true;
    state.ensure.mockResolvedValue(null);
    vi.mocked(useQuery).mockImplementation((ref, args) => {
      if (args === "skip") return undefined;
      if (getFunctionName(ref).endsWith(":getStatus")) {
        return { ready: state.ready, currentVersion: 1 };
      }
      return { ready: true, days: [], years: [], returns: [] };
    });
  });

  it("performs no queries or backfill requests while disabled", () => {
    const { result } = renderHook(() => useJournalTradeFacts({
      calendarMonth: new Date(2026, 9, 1), enabled: false,
    }));
    expect(activeQueries()).toEqual([]);
    expect(state.ensure).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);
    expect(result.current.isPerformanceLoading).toBe(false);
  });

  it("subscribes only to performance when the screen does not use month reports", () => {
    renderHook(() => useJournalTradeFacts({
      calendarMonth: new Date(2026, 9, 1), includeMonth: false, includeMonthlyReturns: false,
    }));
    expect(activeQueries()).toEqual([
      "journalTradeFacts:getStatus", "journalTradeFacts:getPerformanceSummary",
    ]);
  });

  it("does not read performance before its projection is ready", () => {
    state.ready = false;
    renderHook(() => useJournalTradeFacts({ calendarMonth: new Date(2026, 9, 1) }));
    expect(activeQueries()).toEqual(["journalTradeFacts:getStatus"]);
    expect(state.ensure).toHaveBeenCalledOnce();
  });

  it("unsubscribes when leaving the analytics screen", () => {
    const { rerender } = renderHook(({ enabled }) => useJournalTradeFacts({
      calendarMonth: new Date(2026, 9, 1), enabled,
    }), { initialProps: { enabled: true } });
    vi.mocked(useQuery).mockClear();
    rerender({ enabled: false });
    expect(activeQueries()).toEqual([]);
  });
});
