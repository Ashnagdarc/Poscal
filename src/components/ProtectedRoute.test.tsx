import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

const mockGetPaidLock = vi.fn();
const mockUseAuth = vi.fn();
const mockUseSubscription = vi.fn();
const mockUseAdmin = vi.fn();

vi.mock("@/lib/api", () => ({
  featureFlagApi: {
    getPaidLock: (...args: unknown[]) => mockGetPaidLock(...args),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock("@/hooks/use-admin", () => ({
  useAdmin: () => mockUseAdmin(),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/journal"
          element={
            <ProtectedRoute requiresPremium>
              <div>Journal Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/upgrade" element={<div>Upgrade Page</div>} />
        <Route path="/settings" element={<div>Settings Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockGetPaidLock.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, loading: false });
    mockUseSubscription.mockReturnValue({ isPaid: false, isTrial: false, isLoading: false });
    mockUseAdmin.mockReturnValue({ isAdmin: false, loading: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redirects unauthenticated users to sign in", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockGetPaidLock.mockResolvedValue(false);

    renderAt("/journal");

    expect(await screen.findByText("Sign In Page")).toBeInTheDocument();
  });

  it("allows unpaid users when paid lock is disabled", async () => {
    mockGetPaidLock.mockResolvedValue(false);

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });

  it("redirects unpaid users to upgrade when paid lock is enabled", async () => {
    mockGetPaidLock.mockResolvedValue(true);

    renderAt("/journal");

    expect(await screen.findByText("Upgrade Page")).toBeInTheDocument();
  });

  it("fails open when paid lock fetch errors", async () => {
    mockGetPaidLock.mockRejectedValue(new Error("flag down"));

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });

  it("fails open when paid lock fetch times out", async () => {
    vi.useFakeTimers();
    mockGetPaidLock.mockImplementation(() => new Promise(() => undefined));

    renderAt("/journal");

    expect(screen.getByText("Journal Content")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByText("Journal Content")).toBeInTheDocument();
  });

  it("allows paid users when paid lock is enabled", async () => {
    mockUseSubscription.mockReturnValue({ isPaid: true, isTrial: false, isLoading: false });
    mockGetPaidLock.mockResolvedValue(true);

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });
});
