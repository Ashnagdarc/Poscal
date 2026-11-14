import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Wrench, ArrowRight, Calculator as CalculatorIcon } from "lucide-react";
import { Calculator } from "@/components/Calculator";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { MAINTENANCE_MESSAGE } from "@/lib/maintenance";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import { ConsentBanner } from "@/components/ConsentBanner";

const queryClient = new QueryClient();

export function MaintenanceNotice() {
  return (
    <section aria-label="Service status" role="status" className="border-b border-brand/20 bg-brand/10 px-6 py-5">
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <Wrench aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Poscal is under maintenance</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{MAINTENANCE_MESSAGE}</p>
        </div>
      </div>
    </section>
  );
}

export function AccountMaintenancePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col items-start px-6 py-16">
      <div className="mb-6 rounded-2xl bg-brand/10 p-4 text-brand"><Wrench aria-hidden="true" className="h-7 w-7" /></div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">Temporary service interruption</p>
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Account access is paused.</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">{MAINTENANCE_MESSAGE}</p>
      <Link to="/calculator" className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl bg-brand px-5 font-semibold text-brand-foreground">
        <CalculatorIcon aria-hidden="true" className="h-5 w-5" /> Use the calculator <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
      <p className="mt-6 text-sm text-muted-foreground">Thank you for your patience while we work on the issue.</p>
    </main>
  );
}

export function MaintenanceRoutes() {
  return (
    <Routes>
      <Route path="/" element={<><MaintenanceNotice /><Calculator accountMaintenance /></>} />
      <Route path="/calculator" element={<><MaintenanceNotice /><Calculator accountMaintenance /></>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<AccountMaintenancePage />} />
    </Routes>
  );
}

export default function MaintenanceApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CurrencyProvider>
          <div className="h-full overflow-y-auto bg-background text-foreground">
            <PWAUpdateBanner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <MaintenanceRoutes />
            </BrowserRouter>
            <Toaster />
            <ConsentBanner />
          </div>
        </CurrencyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
