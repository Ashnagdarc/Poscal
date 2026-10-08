import { ProPaywallProvider } from "@/contexts/ProPaywallContext";
import { ProLaunchPrompt } from "@/components/ProLaunchPrompt";
import { ConsentBanner } from "@/components/ConsentBanner";
import { CONSENT_CHANGED_EVENT, hasConsent } from "@/lib/consent";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, useEffect, useRef, useState } from "react";
import { ActionErrorProvider } from "@/contexts/ActionErrorContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { FontProvider } from "@/contexts/FontContext";
import { JournalProvider } from "@/contexts/JournalContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkipLink } from "@/components/SkipLink";
import Index from "./pages/Index";
import { Analytics } from "@vercel/analytics/react";
import { BottomNav } from "@/components/BottomNav";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { PushNotificationsProvider } from "@/hooks/use-push-notifications";

const Welcome = lazyWithRetry(() => import("./pages/Welcome"));
const SignIn = lazyWithRetry(() => import("./pages/SignIn"));
const SignUp = lazyWithRetry(() => import("./pages/SignUp"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const VerifyEmail = lazyWithRetry(() => import("./pages/VerifyEmail"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const Journal = lazyWithRetry(() => import("./pages/Journal"));
const TradeNotebook = lazyWithRetry(() => import("./pages/TradeNotebook"));
const DayJournal = lazyWithRetry(() => import("./pages/DayJournal"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const News = lazyWithRetry(() => import("./pages/News"));
const Pro = lazyWithRetry(() => import("./pages/Pro"));
const AdminBilling = lazyWithRetry(() => import("./pages/AdminBilling"));
const UserManagement = lazyWithRetry(() => import("./pages/UserManagement"));
const AdminUpdates = lazyWithRetry(() => import("./pages/AdminUpdates"));
const AdminIngestorHealth = lazyWithRetry(() => import("./pages/AdminIngestorHealth"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

// Shell overlays use Dialog/Button — keep them out of the entry graph so public
// routes (e.g. /welcome) do not download Dialog just for optional modals.
const AppUpdateModal = lazyWithRetry(() =>
  import("./components/AppUpdateModal").then((m) => ({ default: m.AppUpdateModal })),
);
const PWAInstallPrompt = lazyWithRetry(() =>
  import("./components/PWAInstallPrompt").then((m) => ({ default: m.PWAInstallPrompt })),
);
const PushEnablePrompt = lazyWithRetry(() =>
  import("./components/PushEnablePrompt").then((m) => ({ default: m.PushEnablePrompt })),
);

const queryClient = new QueryClient();

const ConsentAwareAnalytics = () => {
  const [enabled, setEnabled] = useState(() => hasConsent("analytics"));

  useEffect(() => {
    const refresh = () => setEnabled(hasConsent("analytics"));
    window.addEventListener(CONSENT_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, refresh);
  }, []);

  if (!enabled) return null;

  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          for (const key of ["reference", "trxref", "access_code", "token", "returnTo", "redirectPath"]) {
            url.searchParams.delete(key);
          }
          return { ...event, url: url.toString() };
        } catch {
          return event;
        }
      }}
    />
  );
};

const AppContent = () => {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hideBottomNavOn = [
    "/signin",
    "/signup",
    "/forgot-password",
    "/verify-email",
    "/welcome",
    "/terms",
    "/privacy",
  ];
  const shouldShowBottomNav =
    !hideBottomNavOn.includes(location.pathname)
    && !location.pathname.startsWith("/journal/trade/")
    && !location.pathname.startsWith("/journal/day/");

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <SkipLink />
      <PWAUpdateBanner />
      <Suspense fallback={null}>
        <AppUpdateModal />
        <PWAInstallPrompt />
        <PushEnablePrompt />
      </Suspense>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]"
      >
        <Suspense
          fallback={
            <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-background">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              <p className="font-display text-sm text-muted-foreground">Loading Poscal…</p>
            </div>
          }
        >
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/calculator" element={<Index />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/journal" element={<ProtectedRoute>{<Journal />}</ProtectedRoute>} />
          <Route
            path="/journal/trade/:tradeId"
            element={<ProtectedRoute>{<TradeNotebook />}</ProtectedRoute>}
          />
          <Route
            path="/journal/day/:dateKey"
            element={<ProtectedRoute>{<DayJournal />}</ProtectedRoute>}
          />
          <Route
            path="/history"
            element={<ProtectedRoute>{<Navigate to="/journal" replace />}</ProtectedRoute>}
          />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/pricing" element={<Pro />} />
          <Route path="/pro" element={<Pro />} />
          <Route path="/pro/return" element={<Pro />} />
          <Route path="/admin/billing" element={<ProtectedRoute requiresAdmin><AdminBilling /></ProtectedRoute>} />
          <Route path="/upgrade" element={<Pro />} />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <News />
              </ProtectedRoute>
            }
          />
          <Route path="/news" element={<Navigate to="/calendar" replace />} />
          <Route path="/signals" element={<Navigate to="/calendar" replace />} />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiresAdmin>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/updates"
            element={
              <ProtectedRoute requiresAdmin>
                <AdminUpdates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ingestor-health"
            element={
              <ProtectedRoute requiresAdmin>
                <AdminIngestorHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>
      {shouldShowBottomNav ? <BottomNav persistent /> : null}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <ActionErrorProvider>
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <PushNotificationsProvider>
                <SubscriptionProvider>
                  <FontProvider>
                    <CurrencyProvider>
                      <JournalProvider>
                        <ProPaywallProvider>
                          <ProLaunchPrompt />
                          <AppContent />
                        </ProPaywallProvider>
                      </JournalProvider>
                    </CurrencyProvider>
                  </FontProvider>
                </SubscriptionProvider>
              </PushNotificationsProvider>
            </AuthProvider>
          </BrowserRouter>
          <ConsentAwareAnalytics />
          <ConsentBanner />
        </ActionErrorProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
