import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { MaintenanceRoutes } from "./MaintenanceApp";

// Replace only animation/haptics, keeping calculator controls and sizing real.
vi.mock("@/components/ui/animated-number", () => ({
  AnimatedNumber: ({ value }: { value: number }) => <span>{value.toFixed(2)}</span>,
}));
vi.mock("@/hooks/use-haptics", () => ({ useHaptics: () => ({ lightTap: () => {} }) }));

afterEach(() => vi.unstubAllGlobals());

function open(path: string) {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Backend unavailable")));
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CurrencyProvider>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MaintenanceRoutes />
        </MemoryRouter>
      </CurrencyProvider>
    </QueryClientProvider>,
  );
}

it("calculates without account providers or a working server and cannot save a journal", async () => {
  localStorage.setItem("maintenance-existing-session", "keep-session");
  open("/calculator?journalLog=1");
  expect(screen.getByRole("heading", { name: "Poscal is under maintenance" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Journaling temporarily unavailable" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Account balance/ }));
  for (const digit of "10000") fireEvent.click(screen.getByRole("button", { name: digit }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: /Stop loss/i }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Stop loss in pips" }), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Set 20 pips" }));
  await waitFor(() => expect(screen.getAllByText("0.50").length).toBeGreaterThan(0));
  expect(localStorage.getItem("maintenance-existing-session")).toBe("keep-session");
  const calls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
  expect(calls.every((url) => url === "/broker-profiles.json")).toBe(true);
});

it.each(["/signin", "/signup", "/forgot-password", "/verify-email", "/journal", "/journal/trade/example", "/journal/day/2026-11-14", "/calculator/history", "/profile", "/admin/users", "/pro"])("blocks account route %s without authentication requests", (path) => {
  open(path);
  expect(screen.getByRole("heading", { name: "Account access is paused." })).toBeVisible();
  expect(screen.getByRole("link", { name: "Use the calculator" })).toHaveAttribute("href", "/calculator");
  expect(fetch).not.toHaveBeenCalled();
});
