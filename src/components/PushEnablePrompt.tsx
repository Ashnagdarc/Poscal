import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CalendarDays, Loader2, Trophy } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  clearPushPromptSnooze,
  isPushPromptSnoozed,
  shouldShowPushEnablePrompt,
  snoozePushPrompt,
} from "@/lib/pushPrompt";
import { cn } from "@/lib/utils";

const OPEN_DELAY_MS = 900;

const PREVIEW_NOTIFICATIONS = [
  {
    title: "USD Non-Farm Payrolls",
    body: "High-impact event starts in 15 minutes",
    time: "2m",
    icon: CalendarDays,
    iconClassName: "bg-brand/15 text-brand",
  },
  {
    title: "Risk warning",
    body: "Trade size exceeds your 1% risk limit",
    time: "1h",
    icon: AlertTriangle,
    iconClassName: "bg-destructive/10 text-destructive",
  },
  {
    title: "Journal milestone",
    body: "You've logged 50 trades this month",
    time: "2h",
    icon: Trophy,
    iconClassName: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
] as const;

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
  const [snoozed, setSnoozed] = useState(false);
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
    permission,
    dismissedThisVisit,
    snoozed,
  });

  useEffect(() => {
    setIosInstallHint(isIosBrowser() && !isStandaloneDisplay());
  }, []);

  useEffect(() => {
    setDismissedThisVisit(false);
    setSnoozed(isPushPromptSnoozed(user?.id));
    setAttempted(false);
    setOpen(false);
  }, [user?.id]);

  useEffect(() => {
    if (!eligible) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  const dismiss = () => {
    setDismissedThisVisit(true);
    snoozePushPrompt(user?.id);
    setSnoozed(true);
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
      clearPushPromptSnooze(user?.id);
      setSnoozed(false);
      setDismissedThisVisit(true);
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
      <DialogContent
        className={cn(
          "fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none",
          "duration-300 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-bottom-2",
          "[&>button]:hidden",
        )}
      >
        <div className="mx-auto flex h-full w-full max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
          <div className="flex flex-1 flex-col">
            <div className="space-y-3 pt-2 animate-fade-in">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Bell className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <DialogTitle className="font-display text-3xl font-bold tracking-tight text-foreground">
                Get Notified
              </DialogTitle>
              <DialogDescription className="max-w-[18rem] text-base leading-relaxed text-muted-foreground">
                Keep up with high-impact calendar events, risk alerts, and account updates from Poscal.
              </DialogDescription>
            </div>

            <div className="relative flex flex-1 items-center justify-center py-8 animate-slide-up">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-8 top-6 bottom-10 rounded-[2.75rem] border-[1.5px] border-border/70 bg-secondary/30"
              >
                <div className="mx-auto mt-3 h-5 w-24 rounded-full bg-border/60" />
              </div>

              <ul className="relative z-10 flex w-full flex-col gap-3 px-1">
                {PREVIEW_NOTIFICATIONS.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.title}
                      className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-sm animate-slide-up"
                      style={{ animationDelay: `${80 + index * 70}ms` }}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          item.iconClassName,
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                        </div>
                        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="space-y-3 pb-2 animate-fade-in" style={{ animationDelay: "180ms" }}>
            {blocked ? (
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                Notifications are blocked for this browser. Allow them from the lock icon in the address bar, then come
                back and turn them on.
              </p>
            ) : null}

            {iosInstallHint && !blocked ? (
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                On iPhone, add Poscal to your home screen first, open it from there, then turn notifications on.
              </p>
            ) : null}

            {attempted && lastError && !blocked ? (
              <p className="text-center text-sm leading-relaxed text-destructive">{lastError}</p>
            ) : null}

            {blocked ? null : (
              <Button
                type="button"
                onClick={() => void enable()}
                disabled={loading}
                className="h-14 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
              >
                {loading ? <Loader2 className="animate-spin" /> : null}
                Turn On Notifications
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={dismiss}
              className="h-11 w-full rounded-full text-base font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              Not Right Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
