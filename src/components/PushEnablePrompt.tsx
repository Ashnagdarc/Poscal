import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

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
    avatarSrc: "/push-prompt/cynthia.png",
    showBadge: true,
  },
  {
    title: "Risk warning",
    body: "Trade size exceeds your 1% risk limit",
    time: "1h",
    avatarSrc: "/push-prompt/spark.png",
    showBadge: false,
  },
  {
    title: "Journal milestone",
    body: "You've logged 50 trades this month",
    time: "2h",
    avatarSrc: "/push-prompt/kevin.png",
    showBadge: true,
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
  const forcePreview =
    import.meta.env.DEV &&
    new URLSearchParams(location.search).has("previewPushPrompt");

  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [open, setOpen] = useState(forcePreview);
  const [attempted, setAttempted] = useState(false);
  const [iosInstallHint, setIosInstallHint] = useState(false);

  const eligible =
    forcePreview ||
    shouldShowPushEnablePrompt({
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
    if (!forcePreview) {
      setOpen(false);
    }
  }, [user?.id, forcePreview]);

  useEffect(() => {
    if (!eligible) {
      setOpen(false);
      return;
    }
    const delay = forcePreview ? 0 : OPEN_DELAY_MS;
    const timer = window.setTimeout(() => setOpen(true), delay);
    return () => window.clearTimeout(timer);
  }, [eligible, forcePreview]);

  const dismiss = () => {
    setDismissedThisVisit(true);
    if (!forcePreview) {
      snoozePushPrompt(user?.id);
      setSnoozed(true);
    }
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
          "fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 items-stretch justify-center gap-0 overflow-hidden rounded-none border-0 bg-[#F5F5F5] p-0 shadow-none dark:bg-background",
          "duration-300 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-bottom-2",
          "font-sans [&>button]:hidden",
        )}
      >
        <div className="mx-auto flex h-full w-full max-w-[390px] flex-col px-[28px] pb-[max(18px,env(safe-area-inset-bottom))] pt-[max(52px,calc(env(safe-area-inset-top)+24px))]">
          <header className="shrink-0 space-y-[14px] text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9E9E9] dark:bg-secondary">
              <Bell className="h-[17px] w-[17px] text-[#6B6B6B]" strokeWidth={2.2} />
            </div>
            <div className="space-y-[10px]">
              <DialogTitle className="text-left text-[34px] font-bold leading-none tracking-[-0.035em] text-black dark:text-foreground">
                Get Notified
              </DialogTitle>
              <DialogDescription className="max-w-[250px] text-left text-[15px] font-normal leading-[1.35] text-[#9A9A9A] dark:text-muted-foreground">
                Keep up with high-impact events, risk alerts, and journal updates from Poscal.
              </DialogDescription>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[4%] h-[92%] w-[228px] -translate-x-1/2 rounded-[42px] border border-[#D6D6D6] dark:border-border/60"
            >
              <div className="mx-auto mt-3 h-[23px] w-[90px] rounded-full bg-[#D6D6D6] dark:bg-muted" />
            </div>

            <ul className="relative z-10 w-full space-y-[14px]">
              {PREVIEW_NOTIFICATIONS.map((item) => (
                <li
                  key={item.title}
                  className="flex items-center gap-[12px] rounded-[22px] bg-white py-[14px] pl-[14px] pr-[16px] shadow-[0_10px_36px_rgba(0,0,0,0.07)] dark:bg-card dark:shadow-[0_10px_36px_rgba(0,0,0,0.4)]"
                >
                  <div className="relative h-11 w-11 shrink-0">
                    <img
                      src={item.avatarSrc}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full object-cover"
                      draggable={false}
                    />
                    {item.showBadge ? (
                      <img
                        src="/push-prompt/badge.png"
                        alt=""
                        width={18}
                        height={18}
                        className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
                        draggable={false}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[15px] font-semibold leading-[1.2] tracking-[-0.01em] text-black dark:text-foreground">
                        {item.title}
                      </p>
                      <span className="shrink-0 pt-px text-[12px] font-medium text-[#B4B4B4]">
                        {item.time}
                      </span>
                    </div>
                    <p className="mt-[2px] truncate text-[13.5px] leading-[1.3] text-[#9A9A9A] dark:text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <footer className="shrink-0 pt-1">
            {blocked ? (
              <p className="mb-3 text-center text-sm leading-relaxed text-[#9A9A9A]">
                Notifications are blocked for this browser. Allow them from the lock icon in the address bar, then come
                back and turn them on.
              </p>
            ) : null}

            {iosInstallHint && !blocked ? (
              <p className="mb-3 text-center text-sm leading-relaxed text-[#9A9A9A]">
                On iPhone, add Poscal to your home screen first, open it from there, then turn notifications on.
              </p>
            ) : null}

            {attempted && lastError && !blocked ? (
              <p className="mb-3 text-center text-sm leading-relaxed text-destructive">{lastError}</p>
            ) : null}

            {blocked ? null : (
              <button
                type="button"
                onClick={() => void enable()}
                disabled={loading}
                className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-black text-[16px] font-semibold text-white transition-transform active:scale-[0.985] disabled:opacity-60 dark:bg-foreground dark:text-background"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Turn On Notifications
              </button>
            )}

            <button
              type="button"
              onClick={dismiss}
              className="mt-1 flex h-11 w-full items-center justify-center text-[15px] font-medium text-[#9A9A9A] transition-colors hover:text-black dark:text-muted-foreground dark:hover:text-foreground"
            >
              Not Right Now
            </button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
};
