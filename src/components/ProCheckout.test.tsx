import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { ProCheckout } from "./ProCheckout";
const mocks = vi.hoisted(() => ({
  beta: false,
  order: null as any,
  start: vi.fn(),
  verify: vi.fn(),
  query: vi.fn(),
  resume: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "trader" } }),
}));
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => ({ isPaid: false, expiresAt: null }),
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: any) =>
    getFunctionName(reference).includes("publicConfiguration")
      ? { beta: mocks.beta, ready: true, monthly: 250000, yearly: 2500000 }
      : mocks.order,
  useAction: (reference: any) =>
    getFunctionName(reference).includes("startCheckout")
      ? mocks.start
      : mocks.verify,
  useConvex: () => ({ query: mocks.query }),
  usePaginatedQuery: () => ({ results: [], status: "Exhausted" }),
}));
vi.mock("@paystack/inline-js", () => ({
  default: class {
    resumeTransaction = mocks.resume;
  },
}));
const mount = () =>
  render(
    <MemoryRouter>
      <ProCheckout returnTo="/journal?tab=notebook" />
    </MemoryRouter>,
  );
beforeEach(() => {
  mocks.beta = false;
  mocks.order = null;
  mocks.start.mockReset();
  mocks.query.mockReset();
  mocks.resume.mockReset();
  mocks.verify.mockReset().mockResolvedValue(null);
});
describe("Pro checkout", () => {
  it("shows included beta access and never offers a payment button", () => {
    mocks.beta = true;
    mount();
    expect(screen.getByText("Included during beta")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pay ₦/ }),
    ).not.toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("sends only one checkout request for rapid repeated clicks", async () => {
    let finish!: (reference: string) => void;
    mocks.start.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mocks.query.mockResolvedValue({
      reference: "ppro_saved",
      status: "pending",
      accessCode: "saved-code",
    });
    mount();
    const button = screen.getByRole("button", { name: "Pay ₦2,500" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    finish("ppro_saved");
    await waitFor(() =>
      expect(mocks.resume).toHaveBeenCalledWith(
        "saved-code",
        expect.any(Object),
      ),
    );
  });
  it("a popup success callback requests verification but does not claim activation", async () => {
    mocks.order = {
      reference: "ppro_saved",
      status: "pending",
      accessCode: "saved-code",
      checkoutUrl: "https://checkout.paystack.com/saved",
      returnTo: "/journal",
    };
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Resume secure checkout" }),
    );
    await waitFor(() => expect(mocks.resume).toHaveBeenCalled());
    mocks.resume.mock.calls[0][1].onSuccess();
    expect(mocks.verify).toHaveBeenCalledWith({ reference: "ppro_saved" });
    expect(screen.getByText("Checkout in progress")).toBeInTheDocument();
    expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
  });
  it("keeps a payment needing review from starting another checkout", () => {
    mocks.order = {
      reference: "ppro_saved",
      status: "review",
      returnTo: "/journal",
    };
    mount();
    expect(
      screen.getByRole("button", { name: "Resume secure checkout" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/If you have already been debited/),
    ).toBeInTheDocument();
  });
});
