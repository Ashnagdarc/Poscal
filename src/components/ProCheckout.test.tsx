import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { ProCheckout } from "./ProCheckout";
const mocks = vi.hoisted(() => ({
  beta: false,
  paid: false,
  subscriptionLoading: false,
  fullName: "Daniel Samuel",
  expiresAt: null as Date | null,
  order: null as any,
  start: vi.fn(),
  verify: vi.fn(),
  setAutoRenew: vi.fn(),
  query: vi.fn(),
  resume: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "trader", full_name: mocks.fullName } }),
}));
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => ({
    isPaid: mocks.paid,
    isLoading: mocks.subscriptionLoading,
    expiresAt: mocks.expiresAt,
    autoRenew: {
      enabled: false,
      plan: null,
      nextChargeAt: null,
      last4: null,
      brand: null,
    },
  }),
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
  useMutation: () => mocks.setAutoRenew,
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
  mocks.paid = false;
  mocks.subscriptionLoading = false;
  mocks.fullName = "Daniel Samuel";
  mocks.expiresAt = null;
  mocks.order = null;
  mocks.start.mockReset();
  mocks.query.mockReset();
  mocks.resume.mockReset();
  mocks.verify.mockReset().mockResolvedValue(null);
  mocks.setAutoRenew.mockReset().mockResolvedValue(null);
});
describe("Pro checkout", () => {
  it("greets an active member with status instead of a purchase pitch", () => {
    mocks.paid = true;
    mocks.expiresAt = new Date("2027-10-08T12:00:00Z");
    mount();
    expect(screen.getByRole("heading", { name: /Hey boss, Daniel\./ })).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("8 Oct 2027")).toBeInTheDocument();
    expect(screen.queryByText("Choose a plan")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Extend access" }));
    expect(screen.getByText("Choose a plan")).toBeInTheDocument();
  });
  it("waits for membership status before showing checkout", () => {
    mocks.subscriptionLoading = true;
    mount();
    expect(screen.getByLabelText("Loading plans")).toBeInTheDocument();
    expect(screen.queryByText("Choose a plan")).not.toBeInTheDocument();
  });
  it("uses a friendly fallback when the member has no profile name", () => {
    mocks.paid = true;
    mocks.fullName = "";
    mount();
    expect(screen.getByRole("heading", { name: /Hey boss\./ })).toBeInTheDocument();
  });
  it("keeps active status visible while a renewal payment needs review", () => {
    mocks.paid = true;
    mocks.order = { reference: "ppro_pending", status: "review", plan: "yearly", amount: 2500000 };
    mount();
    expect(screen.getByRole("heading", { name: /Hey boss, Daniel\./ })).toBeInTheDocument();
    expect(screen.queryByText("Choose a plan")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review payment" }));
    expect(screen.getByText("Payment needs checking")).toBeInTheDocument();
  });
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
    const button = screen.getByRole("button", {
      name: "Continue with Annual · ₦25,000",
    });
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
  it("keeps both billing choices obvious and updates the checkout action", () => {
    mount();
    expect(
      screen.getByRole("radio", { name: /Annual.*₦25,000/ }),
    ).toBeChecked();
    const monthly = screen.getByRole("radio", {
      name: /Monthly.*₦2,500/,
    });
    expect(monthly).not.toBeChecked();
    fireEvent.click(monthly);
    expect(monthly).toBeChecked();
    expect(
      screen.getByRole("button", {
        name: "Continue with Monthly · ₦2,500",
      }),
    ).toBeInTheDocument();
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
