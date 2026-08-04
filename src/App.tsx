import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense } from "react";
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

const Welcome = lazyWithRetry(() => import("./pages/Welcome"));
const SignIn = lazyWithRetry(() => import("./pages/SignIn"));
const SignUp = lazyWithRetry(() => import("./pages/SignUp"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const VerifyEmail = lazyWithRetry(() => import("./pages/VerifyEmail"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const Journal = lazyWithRetry(() => import("./pages/Journal"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const News = lazyWithRetry(() => import("./pages/News"));
const Upgrade = lazyWithRetry(() => import("./pages/Upgrade"));
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

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const hideBottomNavOn = [
    "/signin",
    "/signup",
    "/forgot-password",
    "/verify-email",
    "/welcome",
    "/terms",
    "/privacy",
  ];
  const shouldShowBottomNav = !hideBottomNavOn.includes(location.pathname);

  return (
    <>
      <SkipLink />
      <PWAUpdateBanner />
      <Suspense fallback={null}>
        <AppUpdateModal />
        <PWAInstallPrompt />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
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
          <Route path="/journal" element={<ProtectedRoute requiresPremium>{<Journal />}</ProtectedRoute>} />
          <Route
            path="/history"
            element={<ProtectedRoute requiresPremium>{<Navigate to="/journal" replace />}</ProtectedRoute>}
          />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/pricing" element={<Upgrade />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute requiresPremium>
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
      {shouldShowBottomNav && <BottomNav persistent />}
      {/* Spacer so last CTAs clear the floating island + iOS safe area (MC-002 / EB-002). */}
      {shouldShowBottomNav ? (
        <div
          aria-hidden="true"
          className="pointer-events-none h-[calc(5.75rem+env(safe-area-inset-bottom))] shrink-0"
        />
      ) : null}
    </>
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
              <SubscriptionProvider>
                <FontProvider>
                  <CurrencyProvider>
                    <JournalProvider>
                      <AppContent />
                    </JournalProvider>
                  </CurrencyProvider>
                </FontProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </BrowserRouter>
          <Analytics />
        </ActionErrorProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
