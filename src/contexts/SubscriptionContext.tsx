import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FREE_LIMITS, PRO_LIMITS } from "../../shared/proPolicy";

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
  checkFeatureAccess: (feature: string) => boolean;
  refreshSubscription: () => Promise<void>;
  daysUntilExpiry: number | null;
  daysUntilTrialEnd: number | null;
}
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

// Read Convex Auth directly: custom AuthContext can be recreated by HMR.
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [now, setNow] = useState(Date.now());
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const liveAccess = useQuery(
    api.proBilling.entitlements,
    isAuthenticated ? { nowMs: Math.floor(now / 15_000) * 15_000 } : "skip",
  );
  const cachedAccess = useRef<typeof liveAccess>();
  if (
    !isAuthenticated ||
    (cachedAccess.current && cachedAccess.current.userId !== viewer?.id)
  )
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
  const isBeta = !!access?.beta;
  const isPaid = !!access?.paid && (access.expiresAtMs ?? 0) > now;
  const hasPro = isBeta || isPaid;
  const expiresAt = access?.expiresAtMs ? new Date(access.expiresAtMs) : null;
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
    usage: access?.usage ?? {
      journals: 0,
      entries: 0,
      screenshots: 0,
      storageBytes: 0,
    },
    // A clock tick closes the expiry gap even when no database write occurs.
    lockedJournalIds: hasPro
      ? []
      : access?.lockedJournalIds?.length
        ? access.lockedJournalIds
        : [],
    freeJournalId: access?.freeJournalId ?? null,
    canChooseFreeJournal: !!access?.canChooseFreeJournal,
    checkFeatureAccess: (feature) =>
      isAuthenticated &&
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
