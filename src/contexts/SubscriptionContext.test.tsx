import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscriptionProvider, useSubscription } from "./SubscriptionContext";

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  ConvexReactClient: class ConvexReactClient {},
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    authMode: "signed_out",
    backendAvailability: "online",
    isOffline: false,
    viewerSubscription: null,
  }),
}));

function Probe() {
  const { isPaid, isLoading, subscriptionTier } = useSubscription();
  return (
    <div>
      paid:{String(isPaid)} loading:{String(isLoading)} tier:{subscriptionTier}
    </div>
  );
}

describe("SubscriptionProvider", () => {
  it("stays on the free tier when nobody is signed in", () => {
    render(
      <SubscriptionProvider>
        <Probe />
      </SubscriptionProvider>,
    );

    expect(screen.getByText(/paid:false/)).toBeInTheDocument();
    expect(screen.getByText(/tier:free/)).toBeInTheDocument();
  });
});
