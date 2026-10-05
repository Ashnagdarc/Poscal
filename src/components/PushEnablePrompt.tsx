import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { shouldShowPushEnablePrompt } from "@/lib/pushPrompt";

const OPEN_DELAY_MS = 900;

function isIosBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOS && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export const PushEnablePrompt = () => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { checked, isSupported, isConfigured, isSubscribed, permission, loading, lastError, subscribe } =
    usePushNotifications();
  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);
  const [visitId, setVisitId] = useState(0);
  const [open, setOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [iosInstallHint, setIosInstallHint] = useState(false);

  const eligible = shouldShowPushEnablePrompt({
    pathname: location.pathname,
    isAuthenticated: Boolean(user),
    authLoading,
    checked,
    isSupported,
    isConfigured,
    isSubscribed,
    dismissedThisVisit,
  });

  useEffect(() => {
    setIosInstallHint(isIosBrowser() && !isStandaloneDisplay());
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      setDismissedThisVisit(false);
      setVisitId((current) => current + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!eligible) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [eligible, visitId]);

  useEffect(() => {
    setAttempted(false);
  }, [visitId]);

  const dismiss = () => {
    setDismissedThisVisit(true);
    setOpen(false);
  };

  const enable = async () => {
    setAttempted(true);
    const result = await subscribe();
    if (result) {
      toast.success(
        result === "already_subscribed"
          ? "This device is already subscribed to Poscal notifications."
          : result === "rebound"
            ? "Push notifications are now linked to this Poscal account."
            : "Push notifications are on. Alerts can reach you when Poscal is closed.",
      );
      setOpen(false);
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      toast.error("Notifications are blocked in the browser. Allow them from the address bar, then try again.");
      return;
    }
    toast.error("Push notifications could not be turned on. Try again in a moment.");
  };

  const blocked = permission === "denied";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="max-w-md gap-5 sm:rounded-2xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
            <Bell className="h-5 w-5" />
          </div>
          <DialogTitle className="font-display text-xl">Turn on push notifications</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            High-impact calendar events and account alerts can reach you even when Poscal is closed.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Notifications are blocked for this browser. Allow them from the lock icon in the address bar, then come
            back and turn them on.
          </p>
        ) : null}

        {iosInstallHint && !blocked ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            On iPhone, add Poscal to your home screen first, open it from there, then turn notifications on.
          </p>
        ) : null}

        {attempted && lastError && !blocked ? (
          <p className="text-sm leading-relaxed text-destructive">{lastError}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          {blocked ? null : (
            <Button type="button" onClick={() => void enable()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Bell />}
              Enable notifications
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
