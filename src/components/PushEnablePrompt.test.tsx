import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { PushEnablePrompt } from "./PushEnablePrompt";

const mockAuth = vi.fn();
const mockPush = vi.fn();
const mockSubscribe = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuth(),
}));

vi.mock("@/hooks/use-push-notifications", () => ({
  usePushNotifications: () => mockPush(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPrompt(path = "/journal") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PushEnablePrompt />
    </MemoryRouter>,
  );
}

describe("PushEnablePrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSubscribe.mockReset();
    mockSubscribe.mockResolvedValue(true);
    mockAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });
    mockPush.mockReturnValue({
      checked: true,
      isSupported: true,
      isConfigured: true,
      isSubscribed: false,
      permission: "default",
      loading: false,
      lastError: null,
      subscribe: mockSubscribe,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks a signed-in user to turn notifications on", async () => {
    renderPrompt();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Turn on push notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable notifications" })).toBeInTheDocument();
  });

  it("stays closed after Not now until the next visit", async () => {
    renderPrompt();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("turns push on from the dialog", async () => {
    renderPrompt();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    fireEvent.click(screen.getByRole("button", { name: "Enable notifications" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSubscribe).toHaveBeenCalledOnce();
  });

  it("does not show on the welcome screen", async () => {
    renderPrompt("/welcome");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});