import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscriptionProvider, useSubscription } from "./SubscriptionContext";

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
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
  it("mounts without custom AuthProvider (does not call useAuth)", () => {
    // Regression: calling useAuth here crashed with
    // "useAuth must be used within an AuthProvider" under Auth HMR / wrong nesting.
    render(
      <SubscriptionProvider>
        <Probe />
      </SubscriptionProvider>,
    );

    expect(screen.getByText(/paid:false/)).toBeInTheDocument();
    expect(screen.getByText(/tier:free/)).toBeInTheDocument();
  });
});
