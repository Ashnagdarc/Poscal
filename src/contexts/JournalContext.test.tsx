import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JournalProvider, useJournal } from "./JournalContext";
import { listTradingJournals } from "@/lib/tradingJournals";
import { cacheOfflineJournals, loadOfflineJournals } from "@/lib/offlineStore";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    authMode: "online_authenticated",
  }),
}));

vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => ({
    subscriptionTier: "free",
    limits: { journals: 1 },
    hasPro: false,
    freeJournalId: null,
    isLoading: false,
  }),
}));

vi.mock("@/contexts/CurrencyContext", () => ({
  ACCOUNT_CURRENCIES: [],
  useCurrency: () => ({ setCurrency: vi.fn() }),
}));

vi.mock("@/lib/tradingJournals", () => ({
  listTradingJournals: vi.fn(),
  createTradingJournal: vi.fn(),
  deleteTradingJournal: vi.fn(),
  attachOrphanJournalData: vi.fn(),
  readStoredActiveJournalId: vi.fn(() => null),
  writeStoredActiveJournalId: vi.fn(),
}));

vi.mock("@/lib/offlineStore", () => ({
  cacheOfflineJournals: vi.fn(),
  loadOfflineJournals: vi.fn(),
}));

function Probe() {
  const { isLoading, loadError, needsOnboarding, journals } = useJournal();
  return (
    <div>
      loading:{String(isLoading)} error:{String(loadError)} onboarding:{String(needsOnboarding)} journals:{journals.length}
    </div>
  );
}

function renderProvider() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <JournalProvider>
        <Probe />
      </JournalProvider>
    </QueryClientProvider>,
  );
}

describe("JournalProvider loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadOfflineJournals).mockResolvedValue([]);
    vi.mocked(cacheOfflineJournals).mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not turn a failed live read into first-journal onboarding", async () => {
    vi.mocked(listTradingJournals).mockRejectedValue(
      new Error("Your request couldn't be completed. Try again later."),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByText(/loading:false/)).toHaveTextContent("error:true");
    });
    expect(screen.getByText(/loading:false/)).toHaveTextContent("onboarding:false");
  });

  it("shows onboarding only after an authoritative empty response", async () => {
    vi.mocked(listTradingJournals).mockResolvedValue([]);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByText(/loading:false/)).toHaveTextContent("error:false");
    });
    expect(screen.getByText(/loading:false/)).toHaveTextContent("onboarding:true");
  });
});
