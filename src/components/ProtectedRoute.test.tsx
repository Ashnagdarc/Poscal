import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

const mockGetPaidLock = vi.fn();
const mockUseAuth = vi.fn();
const mockUseSubscription = vi.fn();
const mockUseAdmin = vi.fn();
const mockIsClientEmailVerificationRequired = vi.fn();

vi.mock("@/lib/api", () => ({
  featureFlagApi: {
    getPaidLock: (...args: unknown[]) => mockGetPaidLock(...args),
  },
}));

vi.mock("@/lib/emailVerificationClient", () => ({
  isClientEmailVerificationRequired: () => mockIsClientEmailVerificationRequired(),
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
        <Route path="/verify-email" element={<div>Verify Email Page</div>} />
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
    mockIsClientEmailVerificationRequired.mockReset();
    // Default: soft mode
    mockIsClientEmailVerificationRequired.mockReturnValue(false);
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com", email_verified: true },
      loading: false,
    });
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

  it("allows unverified users when email verification is not required", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com", email_verified: false },
      loading: false,
    });
    mockIsClientEmailVerificationRequired.mockReturnValue(false);
    mockGetPaidLock.mockResolvedValue(false);

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
    expect(screen.queryByText("Verify Email Page")).not.toBeInTheDocument();
  });

  it("redirects unverified users when hard email verification is required", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com", email_verified: false },
      loading: false,
    });
    mockIsClientEmailVerificationRequired.mockReturnValue(true);
    mockGetPaidLock.mockResolvedValue(false);

    renderAt("/journal");

    expect(await screen.findByText("Verify Email Page")).toBeInTheDocument();
  });

  it("fails open (no verify redirect) when client hard-verify env is unset", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com", email_verified: false },
      loading: false,
    });
    mockIsClientEmailVerificationRequired.mockReturnValue(false);
    mockGetPaidLock.mockResolvedValue(false);

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });

  it("fails open when paid lock request hangs", async () => {
    vi.useFakeTimers();
    mockGetPaidLock.mockImplementation(() => new Promise(() => {}));

    renderAt("/journal");

    expect(screen.getByText("Journal Content")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByText("Journal Content")).toBeInTheDocument();
    expect(screen.queryByText("Upgrade Page")).not.toBeInTheDocument();
  });

  it("fails open when paid lock request rejects", async () => {
    mockGetPaidLock.mockRejectedValue(new Error("network"));

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });

  it("redirects free users only after paid lock is confirmed on", async () => {
    mockGetPaidLock.mockResolvedValue(true);

    renderAt("/journal");

    expect(await screen.findByText("Upgrade Page")).toBeInTheDocument();
  });

  it("allows free users when paid lock is confirmed off", async () => {
    mockGetPaidLock.mockResolvedValue(false);

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });

  it("allows paid users regardless of paid lock", async () => {
    mockUseSubscription.mockReturnValue({ isPaid: true, isTrial: false, isLoading: false });
    mockGetPaidLock.mockResolvedValue(true);

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });
});
