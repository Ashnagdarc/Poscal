import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

const mockUseAuth = vi.fn();
const mockUseAdmin = vi.fn();
const mockIsClientEmailVerificationRequired = vi.fn();
const mockUseQuery = vi.fn();

vi.mock("@/lib/emailVerificationClient", () => ({
  isClientEmailVerificationRequired: () => mockIsClientEmailVerificationRequired(),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    authSettings: {
      getVerificationPolicy: "authSettings.getVerificationPolicy",
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
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
            <ProtectedRoute>
              <div>Journal Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/verify-email" element={<div>Verify Email Page</div>} />
        <Route path="/settings" element={<div>Settings Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockIsClientEmailVerificationRequired.mockReset();
    mockUseQuery.mockReset();
    // Default: soft mode
    mockIsClientEmailVerificationRequired.mockReturnValue(false);
    mockUseQuery.mockReturnValue({ requireEmailVerification: false });
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com", email_verified: true },
      loading: false,
    });
    mockUseAdmin.mockReturnValue({ isAdmin: false, loading: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redirects unauthenticated users to sign in", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderAt("/journal");

    expect(await screen.findByText("Sign In Page")).toBeInTheDocument();
  });

  it("allows unverified users when email verification is not required", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com", email_verified: false },
      loading: false,
    });
    mockIsClientEmailVerificationRequired.mockReturnValue(false);

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
    expect(screen.queryByText("Verify Email Page")).not.toBeInTheDocument();
  });

  it("redirects unverified users when hard email verification is required", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com", email_verified: false },
      loading: false,
    });
    mockUseQuery.mockReturnValue({ requireEmailVerification: true });
    mockIsClientEmailVerificationRequired.mockReturnValue(true);

    renderAt("/journal");

    expect(await screen.findByText("Verify Email Page")).toBeInTheDocument();
  });

  it("fails open (no verify redirect) when client hard-verify env is unset", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "u@test.com", email_verified: false },
      loading: false,
    });
    mockIsClientEmailVerificationRequired.mockReturnValue(false);

    renderAt("/journal");

    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });

  it("keeps the journal readable for a signed-in Free user", async () => {
    renderAt("/journal");
    expect(await screen.findByText("Journal Content")).toBeInTheDocument();
  });
});
