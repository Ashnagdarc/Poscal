import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useProPaywall } from "@/contexts/ProPaywallContext";

const DISMISS_KEY = "poscal:pro-intro-dismissed";

export function ProLaunchPrompt() {
  const location = useLocation();
  const configuration = useQuery(api.proBilling.publicConfiguration, {});
  const { user } = useAuth();
  const { isPaid, isLoading } = useSubscription();
  const openPro = useProPaywall();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    if (!configuration || configuration.beta || !user || isLoading || isPaid) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const onPlans =
      location.pathname === "/pro" ||
      location.pathname.startsWith("/pro/") ||
      location.pathname === "/upgrade" ||
      location.pathname === "/pricing";
    if (onPlans) return;
    opened.current = true;
    localStorage.setItem(DISMISS_KEY, "1");
    openPro("Poscal Pro");
  }, [configuration, user, isLoading, isPaid, location.pathname, openPro]);

  return null;
}
