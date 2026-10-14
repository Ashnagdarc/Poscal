import { useEffect, useState } from "react";
import {
  acceptAllConsent,
  CONSENT_OPEN_EVENT,
  readConsent,
  rejectNonEssentialConsent,
  saveConsent,
} from "@/lib/consent";

export function ConsentBanner() {
  const [open, setOpen] = useState(() => readConsent() === null);
  const [manage, setManage] = useState(false);
  const existing = readConsent();
  const [preferences, setPreferences] = useState(existing?.preferences ?? false);
  const [analytics, setAnalytics] = useState(existing?.analytics ?? false);
  const [marketing, setMarketing] = useState(existing?.marketing ?? false);

  useEffect(() => {
    const show = () => {
      const current = readConsent();
      setPreferences(current?.preferences ?? false);
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setManage(true);
      setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, show);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, show);
  }, []);

  if (!open) return null;

  const save = () => {
    saveConsent({ preferences, analytics, marketing });
    setOpen(false);
    setManage(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-border bg-background/95 p-4 shadow-2xl backdrop-blur">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Privacy choices</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Poscal uses necessary storage for sign-in and core app operation. Optional preferences,
            analytics and marketing storage stay off unless you allow them. You can change this
            choice later from the Privacy page.
          </p>
        </div>

        {manage ? (
          <div className="space-y-2 rounded-xl bg-secondary/50 p-3 text-sm">
            <label className="flex items-center justify-between gap-4">
              <span><strong>Necessary</strong><span className="block text-xs text-muted-foreground">Always on for authentication, security and consent records.</span></span>
              <input type="checkbox" checked disabled aria-label="Necessary storage always enabled" />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span><strong>Preferences</strong><span className="block text-xs text-muted-foreground">Remember optional interface choices.</span></span>
              <input type="checkbox" checked={preferences} onChange={(e) => setPreferences(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span><strong>Analytics</strong><span className="block text-xs text-muted-foreground">Help us measure usage and diagnose product quality.</span></span>
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span><strong>Marketing</strong><span className="block text-xs text-muted-foreground">Allow future marketing measurement. Poscal does not require this to use the app.</span></span>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            </label>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="h-10 rounded-xl border border-border px-3 text-sm font-medium"
            onClick={() => {
              rejectNonEssentialConsent();
              setOpen(false);
            }}
          >
            Reject non-essential
          </button>
          <button
            type="button"
            className="h-10 rounded-xl border border-border px-3 text-sm font-medium"
            onClick={() => (manage ? save() : setManage(true))}
          >
            {manage ? "Save choices" : "Manage choices"}
          </button>
          <button
            type="button"
            className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background"
            onClick={() => {
              acceptAllConsent();
              setOpen(false);
            }}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
