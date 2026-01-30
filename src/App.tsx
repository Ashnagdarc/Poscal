import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkipLink } from "@/components/SkipLink";
import Index from "./pages/Index";
import { AppUpdateModal } from "./components/AppUpdateModal";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import UpgradeBanner from '@/components/UpgradeBanner';
import { Analytics } from "@vercel/analytics/react";

// Lazy load pages that aren't immediately needed
const Welcome = lazy(() => import("./pages/Welcome"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Journal = lazy(() => import("./pages/Journal"));
const History = lazy(() => import("./pages/History"));
const Settings = lazy(() => import("./pages/Settings"));
const Signals = lazy(() => import("./pages/Signals"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const AdminUpdates = lazy(() => import("./pages/AdminUpdates"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminWebhookLogs = lazy(() => import("./pages/AdminWebhookLogs"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const AppContent = () => {
  return (
    <>
      <SkipLink />
      {/* Temporarily disable non-essential overlays to minimize startup issues */}
      {/* <UpgradeBanner /> */}
      <AppUpdateModal />
      {/* <PWAInstallPrompt /> */}
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/journal" element={<ProtectedRoute requiresPremium>{<Journal />}</ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute requiresPremium>{<History />}</ProtectedRoute>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route 
            path="/signals" 
            element={
              <ProtectedRoute requiresPremium>
                <Signals />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/users" 
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/updates" 
            element={
              <ProtectedRoute>
                <AdminUpdates />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/payments" 
            element={
              <ProtectedRoute>
                <AdminPayments />
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
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <CurrencyProvider>
                <AppContent />
              </CurrencyProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
        <Analytics />
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;