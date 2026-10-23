import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FREE_LIMITS, PRO_LIMITS } from "../../shared/proPolicy";
import { useAuth } from "@/contexts/AuthContext";
import { saveOfflineViewerSubscription } from "@/lib/offlineStore";

export type SubscriptionTier = "free" | "pro";
export type PaymentStatus = "free" | "paid" | "trial" | "expired";
interface SubscriptionContextType {
  isPaid: boolean;
  isTrial: boolean;
  isLoading: boolean;
  isBeta: boolean;
  hasPro: boolean;
  subscriptionTier: SubscriptionTier;
  paymentStatus: PaymentStatus;
  expiresAt: Date | null;
  trialEndsAt: Date | null;
  limits: typeof FREE_LIMITS | typeof PRO_LIMITS;
  usage: {
    journals: number;
    entries: number;
    screenshots: number;
    storageBytes: number;
  };
  lockedJournalIds: string[];
  freeJournalId: string | null;
  canChooseFreeJournal: boolean;
  autoRenew: {
    enabled: boolean;
    plan: "monthly" | "yearly" | null;
    amount: number | null;
    nextChargeAt: Date | null;
    last4: string | null;
    brand: string | null;
  };
  checkFeatureAccess: (feature: string) => boolean;
  refreshSubscription: () => Promise<void>;
  daysUntilExpiry: number | null;
  daysUntilTrialEnd: number | null;
}
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading: authLoading, authMode, viewerSubscription } = useAuth();
  const isAuthenticated = authMode === "online_authenticated";
  const [now, setNow] = useState(Date.now());
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const liveAccess = useQuery(
    api.proBilling.entitlements,
    isAuthenticated ? { nowMs: Math.floor(now / 15_000) * 15_000 } : "skip",
  );
  const cachedAccess = useRef<typeof liveAccess>();
  if (cachedAccess.current && user?.id && cachedAccess.current.userId !== user.id)
    cachedAccess.current = undefined;
  const belongsToViewer =
    liveAccess === null || liveAccess?.userId === viewer?.id;
  if (liveAccess !== undefined && belongsToViewer)
    cachedAccess.current = liveAccess;
  // A refreshed clock query must not flash Free/loading while its response arrives.
  const access =
    liveAccess !== undefined && belongsToViewer
      ? liveAccess
      : cachedAccess.current;

  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 15_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  const offlineExpiresAtMs = access?.expiresAtMs ?? viewerSubscription?.expiresAtMs ?? null;
  const offlineHasPro = authMode === "offline_verified_device"
    && (access?.beta || access?.paid || viewerSubscription?.subscriptionTier === "pro")
    && (offlineExpiresAtMs === null || offlineExpiresAtMs > now);
  const isBeta = isAuthenticated && !!access?.beta;
  const isPaid = isAuthenticated
    ? !!access?.paid && (access.expiresAtMs ?? 0) > now
    : offlineHasPro && (access?.paid || viewerSubscription?.paymentStatus === "paid");
  const hasPro = isAuthenticated ? isBeta || isPaid : offlineHasPro;
  const expiresAtMs = isAuthenticated ? access?.expiresAtMs ?? null : offlineExpiresAtMs;
  const expiresAt = expiresAtMs ? new Date(expiresAtMs) : null;
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !access) return;
    void saveOfflineViewerSubscription(user.id, {
      paymentStatus: access.paid ? "paid" : "free",
      subscriptionTier: access.beta || access.paid ? "pro" : "free",
      expiresAtMs: access.expiresAtMs ?? null,
      freeJournalId: access.freeJournalId ?? null,
      lockedJournalIds: access.lockedJournalIds ?? [],
      usage: access.usage,
    }).catch((error) => {
      console.warn("[subscription] Could not cache offline access", error);
    });
  }, [access, isAuthenticated, user?.id]);

  const value: SubscriptionContextType = {
    isPaid,
    isTrial: false,
    isBeta,
    hasPro,
    isLoading: authLoading || (isAuthenticated && access === undefined),
    subscriptionTier: hasPro ? "pro" : "free",
    paymentStatus: isPaid ? "paid" : expiresAt ? "expired" : "free",
    expiresAt,
    trialEndsAt: null,
    limits: hasPro ? PRO_LIMITS : FREE_LIMITS,
    usage: (isAuthenticated ? access?.usage : access?.usage ?? viewerSubscription?.usage) ?? {
      journals: 0,
      entries: 0,
      screenshots: 0,
      storageBytes: 0,
    },
    // A clock tick closes the expiry gap even when no database write occurs.
    lockedJournalIds: hasPro
      ? []
      : (isAuthenticated ? access?.lockedJournalIds : access?.lockedJournalIds ?? viewerSubscription?.lockedJournalIds)?.length
        ? (isAuthenticated ? access?.lockedJournalIds : access?.lockedJournalIds ?? viewerSubscription?.lockedJournalIds) ?? []
        : [],
    freeJournalId: (isAuthenticated ? access?.freeJournalId : access?.freeJournalId ?? viewerSubscription?.freeJournalId) ?? null,
    canChooseFreeJournal: !!access?.canChooseFreeJournal,
    autoRenew: {
      enabled: access?.autoRenew?.enabled ?? false,
      plan: access?.autoRenew?.plan ?? null,
      amount: access?.autoRenew?.amount ?? null,
      nextChargeAt: access?.autoRenew?.nextChargeAtMs
        ? new Date(access.autoRenew.nextChargeAtMs)
        : null,
      last4: access?.autoRenew?.last4 ?? null,
      brand: access?.autoRenew?.brand ?? null,
    },
    checkFeatureAccess: (feature) =>
      Boolean(user) &&
      (feature === "export_csv" ||
        ([
          "journal_unlimited",
          "signals_take",
          "news_feed",
          "history_unlimited",
          "import_csv",
          "advanced_analytics",
        ].includes(feature) &&
          hasPro)),
    refreshSubscription: async () => {
      setNow(Date.now());
    },
    daysUntilExpiry: expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / 86400_000))
      : null,
    daysUntilTrialEnd: null,
  };
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context)
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider",
    );
  return context;
};
export const useFeatureGate = (feature: string) => {
  const context = useSubscription();
  const hasAccess = context.checkFeatureAccess(feature);
  return {
    hasAccess,
    requiresUpgrade: !hasAccess,
    tier: context.subscriptionTier,
    isPaid: context.isPaid,
    isLoading: context.isLoading,
  };
};
