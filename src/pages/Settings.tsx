import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronRight,
  Coins,
  Download,
  FileText,
  Globe,
  LogOut,
  Lock,
  Mail,
  Megaphone,
  Palette,
  RotateCcw,
  RefreshCw,
  Settings as SettingsIcon,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  User,
  Users,
} from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/contexts/AuthContext";
import { useActionError } from "@/contexts/ActionErrorContext";
import { useAppFont } from "@/contexts/useAppFont";
import { useCurrency, ACCOUNT_CURRENCIES } from "@/contexts/CurrencyContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHaptics } from "@/hooks/use-haptics";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { usePWAUpdate } from "@/hooks/use-pwa-update";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { featureFlagApi, preferencesApi, subscriptionApi } from "@/lib/api";
import { clearJournalEntries } from "@/lib/calculatorHistory";
import { clearSensitiveLocalStorage } from "@/lib/privacyCleanup";
import type { AppFontId } from "@/lib/fonts";
import { COMMON_TIMEZONES, detectBrowserTimeZone } from "@/lib/timezones";
import { cn } from "@/lib/utils";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (
    !message
    || /VITE_|RESEND_|VAPID_|API_KEY|PaystackPop|Convex client|Request ID|@convex|\.ts:|\.js:/i.test(message)
    || message.length > 160
  ) {
    return fallback;
  }
  return message;
};

const getSubscriptionLabel = ({
  isPaid,
  isTrial,
  subscriptionTier,
}: {
  isPaid: boolean;
  isTrial: boolean;
  subscriptionTier: string;
}) => {
  if (isTrial) return "Trial";
  if (isPaid) return subscriptionTier === "pro" ? "Pro" : "Premium";
  return "Free";
};

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { showErrorFromUnknown } = useActionError();
  const { isPaid, isTrial, subscriptionTier, expiresAt, refreshSubscription } = useSubscription();
  const { isAdmin } = useAdmin();
  const { fontId, options: fontOptions, setFontId } = useAppFont();
  const [paidLockEnabled, setPaidLockEnabled] = useState<boolean | null>(null);
  const [defaultRisk, setDefaultRisk] = useState("1");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);
  const [timezone, setTimezone] = useState(detectBrowserTimeZone());
  const [isSavingFont, setIsSavingFont] = useState(false);
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);
  const { lightTap, isSupported } = useHaptics();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const { updateAvailable, isUpdating, updateApp, checkForUpdate } = usePWAUpdate();
  const { currency, setCurrency } = useCurrency();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isRestoringPurchase, setIsRestoringPurchase] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const supportsHaptics = typeof isSupported === "function" ? isSupported() : !!isSupported;

  const subscriptionLabel = getSubscriptionLabel({ isPaid, isTrial, subscriptionTier });
  const isPremium = isPaid || isTrial;

  useEffect(() => {
    const savedRisk = localStorage.getItem("defaultRisk");
    if (savedRisk) setDefaultRisk(savedRisk);

    const savedHaptics = localStorage.getItem("hapticsEnabled");
    setHapticsEnabled(savedHaptics !== "false");

    const savedTimezone = localStorage.getItem("preferredTimezone");
    if (savedTimezone) setTimezone(savedTimezone);
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const prefs = await preferencesApi.get();
        if (!mounted || !prefs) return;
        if (prefs.timezone) {
          setTimezone(prefs.timezone);
          localStorage.setItem("preferredTimezone", prefs.timezone);
        }
        if (prefs.default_risk_percent != null) {
          const risk = String(prefs.default_risk_percent);
          setDefaultRisk(risk);
          localStorage.setItem("defaultRisk", risk);
        }
      } catch {
        // Keep local defaults
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (isAdmin) {
      (async () => {
        try {
          const enabled = await featureFlagApi.getPaidLock();
          setPaidLockEnabled(enabled);
        } catch (err) {
          console.error("Could not fetch paid lock flag", err);
        }
      })();
    }
  }, [isAdmin]);

  const togglePaidLockFromSettings = async () => {
    try {
      const desiredState = !(paidLockEnabled ?? false);
      const updatedState = await featureFlagApi.setPaidLock(desiredState);
      setPaidLockEnabled(!!updatedState);
      toast.success(updatedState ? "Paid lock enabled" : "Paid lock disabled");
    } catch (err: unknown) {
      console.error("togglePaidLockFromSettings error", err);
      toast.error(getErrorMessage(err, "Failed to toggle paid lock"));
    }
  };

  const handleFontChange = async (nextFont: AppFontId) => {
    if (nextFont === fontId || isSavingFont) return;
    setIsSavingFont(true);
    try {
      const updated = await setFontId(nextFont);
      const option = fontOptions.find((item) => item.id === updated);
      toast.success(`App font set to ${option?.label ?? updated}`);
      setShowFontPicker(false);
      lightTap();
    } catch (err: unknown) {
      console.error("handleFontChange error", err);
      toast.error(getErrorMessage(err, "Failed to update app font"));
    } finally {
      setIsSavingFont(false);
    }
  };

  const toggleHaptics = () => {
    const newValue = !hapticsEnabled;
    setHapticsEnabled(newValue);
    localStorage.setItem("hapticsEnabled", String(newValue));
    if (newValue) lightTap();
  };

  const handleRiskChange = (value: string) => {
    setDefaultRisk(value);
    localStorage.setItem("defaultRisk", value);
    lightTap();
    if (user) {
      void preferencesApi
        .update({ defaultRiskPercent: Number(value) })
        .catch(() => {
          toast.error("Could not sync default risk to your profile");
        });
    }
  };

  const handleTimezoneChange = async (nextZone: string) => {
    if (nextZone === timezone || isSavingTimezone) return;
    setIsSavingTimezone(true);
    const previous = timezone;
    setTimezone(nextZone);
    localStorage.setItem("preferredTimezone", nextZone);
    try {
      if (user) {
        await preferencesApi.update({ timezone: nextZone });
      }
      const label = COMMON_TIMEZONES.find((zone) => zone.id === nextZone)?.label ?? nextZone;
      toast.success(`Timezone set to ${label}`);
      setShowTimezonePicker(false);
      lightTap();
    } catch {
      setTimezone(previous);
      localStorage.setItem("preferredTimezone", previous);
      toast.error("Could not update timezone");
    } finally {
      setIsSavingTimezone(false);
    }
  };

  const clearHistory = async () => {
    await clearJournalEntries(user?.id);
    lightTap();
    toast.success("Saved calculations cleared");
  };

  const resetOnboarding = () => {
    localStorage.removeItem("hasSeenOnboarding");
    lightTap();
    toast.success("Onboarding reset");
    navigate("/welcome");
  };

  const handleLogout = async () => {
    lightTap();
    await signOut();
    clearSensitiveLocalStorage();
    toast.success("Signed out");
    navigate("/signin");
  };

  const handleInstall = async () => {
    lightTap();
    const installed = await promptInstall();
    if (installed) {
      toast.success("App installed successfully!");
    }
  };

  const handleUpdateApp = async () => {
    lightTap();
    setIsCheckingUpdate(true);
    try {
      const found = await checkForUpdate();
      if (found || updateAvailable) {
        toast.message("Updating Poscal…");
        await updateApp();
        return;
      }

      // No waiting worker — hard reload to pick up a fresh NetworkFirst shell.
      toast.message("Refreshing Poscal…");
      window.location.reload();
    } catch {
      toast.error("Could not update the app");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleRestorePurchase = async () => {
    if (!user?.id) {
      toast.error("Please sign in to restore purchases.");
      navigate("/signin");
      return;
    }

    setIsRestoringPurchase(true);
    try {
      const result = await subscriptionApi.restorePurchase({ userId: user.id });
      if (!result?.success) {
        throw new Error(result?.message || "No eligible purchase found.");
      }

      await refreshSubscription();
      const tier = result?.data?.tier || "premium";
      toast.success(`Purchase restored successfully (${tier}).`);
    } catch (error: unknown) {
      showErrorFromUnknown(error, {
        title: "Restore failed",
        fallbackMessage: "We couldn’t restore your purchase. Try again or contact support.",
        code: "RESTORE",
      });
    } finally {
      setIsRestoringPurchase(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <PageHeader
        sticky={false}
        title="Settings"
        subtitle="Preferences and account"
        icon={<SettingsIcon className="h-5 w-5" />}
      />

      <main id="main-content" className="mx-auto min-h-0 w-full max-w-2xl flex-1 animate-slide-up space-y-6 overflow-y-auto overscroll-contain px-6 py-2 pb-36 md:max-w-3xl">
        {/* Account hero */}
        <section>
          {user ? (
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="group w-full overflow-hidden rounded-2xl border border-border/50 bg-secondary/50 text-left transition-all active:scale-[0.99] hover:bg-secondary/70"
            >
              <div className="flex items-center gap-4 px-5 py-5">
                <UserAvatar
                  size="md"
                  name={user.full_name}
                  email={user.email}
                  src={user.avatar_url}
                  className="rounded-2xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold text-foreground">
                    {user.full_name || user.email?.split("@")[0] || "Account"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={isPremium ? "default" : "secondary"}
                      className="rounded-full text-[10px] uppercase tracking-wide"
                    >
                      {subscriptionLabel}
                    </Badge>
                    {expiresAt && (
                      <span className="text-xs text-muted-foreground">
                        Renews {expiresAt.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ) : (
            <SettingsGroup>
              <SettingsRow
                icon={<User className="h-4 w-4" />}
                title="Sign in"
                subtitle="Sync journal, news alerts, and subscription"
                onClick={() => navigate("/signin")}
                showChevron
              />
            </SettingsGroup>
          )}
        </section>

        {/* Subscription upsell — only when the admin paid lock is on */}
        {user && !isPremium && paidLockEnabled ? (
          <section>
            <SettingsSection title="Subscription" />
            <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/10 via-secondary/40 to-secondary/20">
              <div className="px-5 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand" />
                  <h3 className="font-semibold text-foreground">Unlock Premium</h3>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  Get calendar alerts, advanced journal analytics, and more.
                </p>
                <Button
                  className="w-full rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
                  onClick={() => navigate("/upgrade?tier=premium&redirectPath=/settings")}
                >
                  View plans
                </Button>
              </div>
              <div className="border-t border-border/40 bg-background/30">
                <SettingsRow
                  icon={<RotateCcw className="h-4 w-4" />}
                  title="Restore purchase"
                  subtitle="Recover an existing subscription"
                  onClick={handleRestorePurchase}
                  trailing={
                    <span className="text-xs text-muted-foreground">
                      {isRestoringPurchase ? "Restoring…" : "Run"}
                    </span>
                  }
                  className="rounded-none border-0 bg-transparent hover:bg-background/40"
                />
              </div>
            </div>
          </section>
        ) : null}

        {/* Admin */}
        {isAdmin && (
          <section>
            <SettingsSection title="Admin" />
            <SettingsGroup className="border-brand/20">
              <SettingsRow
                icon={<Megaphone className="h-4 w-4 text-brand" />}
                iconClassName="bg-brand/10"
                title="App updates"
                subtitle="Broadcast changes to users"
                onClick={() => navigate("/admin/updates")}
                showChevron
                trailing={<AdminBadge />}
              />
              <SettingsRow
                icon={<Users className="h-4 w-4 text-brand" />}
                iconClassName="bg-brand/10"
                title="User management"
                onClick={() => navigate("/admin/users")}
                showChevron
                trailing={<AdminBadge />}
              />
              <SettingsRow
                icon={<Lock className="h-4 w-4" />}
                title="Paid features lock"
                subtitle="Restrict premium pages for free users"
                trailing={
                  <Button
                    size="sm"
                    variant={paidLockEnabled ? "default" : "outline"}
                    className="h-8 rounded-lg text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePaidLockFromSettings();
                    }}
                  >
                    {paidLockEnabled ? "On" : "Off"}
                  </Button>
                }
              />
              <div className="border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowFontPicker(!showFontPicker)}
                  className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-secondary/30"
                >
                  <SettingsRowContent
                    icon={<Type className="h-4 w-4 text-brand" />}
                    iconClassName="bg-brand/10"
                    title="App fonts"
                    subtitle="Change fonts for everyone"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {fontOptions.find((option) => option.id === fontId)?.label ?? "Markets"}
                    </span>
                    <AdminBadge />
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        showFontPicker && "rotate-90",
                      )}
                    />
                  </div>
                </button>
                {showFontPicker && (
                  <div className="border-t border-border/40 bg-background/40 px-5 pb-4 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      {fontOptions.map((option) => {
                        const isActive = fontId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={isSavingFont}
                            onClick={() => void handleFontChange(option.id)}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-all",
                              isActive
                                ? "border-brand bg-brand text-brand-foreground"
                                : "border-border bg-secondary/50 hover:border-foreground/20",
                              isSavingFont && "opacity-70",
                            )}
                          >
                            <p
                              className="text-2xl font-semibold leading-none"
                              style={{
                                fontFamily:
                                  option.id === "classic"
                                    ? '"Syne", "DM Sans", sans-serif'
                                    : '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
                              }}
                            >
                              {option.sample}
                            </p>
                            <p className="mt-2 text-sm font-semibold">{option.label}</p>
                            <p
                              className={cn(
                                "mt-0.5 text-xs",
                                isActive ? "opacity-80" : "text-muted-foreground",
                              )}
                            >
                              {option.subtitle}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </SettingsGroup>
          </section>
        )}

        {/* Preferences */}
        <section>
          <SettingsSection title="Preferences" />
          <SettingsGroup>
            <div className="flex items-center justify-between px-5 py-4">
              <SettingsRowContent
                icon={<Palette className="h-4 w-4" />}
                title="Appearance"
                subtitle="Light or dark mode"
              />
              <ThemeToggle />
            </div>

            <div className="border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <SettingsRowContent
                  icon={<Coins className="h-4 w-4" />}
                  title="Account currency"
                  subtitle={`Calculator displays ${currency.name}`}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {currency.symbol} {currency.code}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      showCurrencyPicker && "rotate-90",
                    )}
                  />
                </div>
              </button>
              {showCurrencyPicker && (
                <div className="border-t border-border/40 bg-background/40 px-5 pb-4 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {ACCOUNT_CURRENCIES.map((curr) => (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => {
                          setCurrency(curr);
                          setShowCurrencyPicker(false);
                          lightTap();
                          toast.success(`Currency set to ${curr.name}`);
                        }}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all",
                          currency.code === curr.code
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border bg-secondary/50 hover:border-foreground/20",
                        )}
                      >
                        <p className="text-sm font-semibold">
                          {curr.symbol} {curr.code}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            currency.code === curr.code ? "opacity-80" : "text-muted-foreground",
                          )}
                        >
                          {curr.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowTimezonePicker(!showTimezonePicker)}
                className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <SettingsRowContent
                  icon={<Globe className="h-4 w-4" />}
                  title="Timezone"
                  subtitle="Date labels in journal analytics"
                />
                <div className="flex items-center gap-2">
                  <span className="max-w-[9rem] truncate text-sm font-medium text-muted-foreground">
                    {COMMON_TIMEZONES.find((zone) => zone.id === timezone)?.label ?? timezone}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      showTimezonePicker && "rotate-90",
                    )}
                  />
                </div>
              </button>
              {showTimezonePicker && (
                <div className="border-t border-border/40 bg-background/40 px-5 pb-4 pt-3">
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Formats trade dates and day buckets. Session rollups stay on UTC market hours.
                  </p>
                  <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto">
                    {COMMON_TIMEZONES.map((zone) => (
                      <button
                        key={zone.id}
                        type="button"
                        disabled={isSavingTimezone}
                        onClick={() => {
                          void handleTimezoneChange(zone.id);
                        }}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all",
                          timezone === zone.id
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border bg-secondary/50 hover:border-foreground/20",
                          isSavingTimezone && "opacity-70",
                        )}
                      >
                        <p className="text-sm font-semibold">{zone.label}</p>
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            timezone === zone.id ? "opacity-80" : "text-muted-foreground",
                          )}
                        >
                          {zone.id}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <SettingsRow
              icon={<Smartphone className="h-4 w-4" />}
              title="Haptic feedback"
              subtitle={supportsHaptics ? "Vibration on interactions" : "Audio feedback active"}
              trailing={
                <SettingsToggle
                  enabled={hapticsEnabled}
                  onToggle={toggleHaptics}
                  ariaLabel="Haptic feedback"
                />
              }
              className="border-t border-border/40"
            />

            {isInstallable && !isInstalled && (
              <SettingsRow
                icon={<Download className="h-4 w-4" />}
                title="Install app"
                subtitle="Add Poscal to your home screen"
                onClick={handleInstall}
                showChevron
                className="border-t border-border/40"
              />
            )}

            <SettingsRow
              icon={<RefreshCw className={cn("h-4 w-4", (isCheckingUpdate || isUpdating) && "animate-spin")} />}
              title="Update app"
              subtitle={
                updateAvailable
                  ? "A newer version is ready"
                  : isCheckingUpdate || isUpdating
                    ? "Checking for a newer version…"
                    : "Check for a newer version and reload"
              }
              onClick={() => {
                void handleUpdateApp();
              }}
              trailing={
                <span className="text-xs font-medium text-muted-foreground">
                  {isUpdating || isCheckingUpdate ? "Updating…" : updateAvailable ? "Update" : "Check"}
                </span>
              }
              className="border-t border-border/40"
            />
          </SettingsGroup>
        </section>

        {/* Notifications */}
        <section>
          <SettingsSection title="Notifications" />
          <SettingsGroup>
            <NotificationSettings embedded />
          </SettingsGroup>
        </section>

        {/* Calculator */}
        <section>
          <SettingsSection title="Calculator" />
          <SettingsGroup>
            <div className="px-5 py-4">
              <SettingsRowContent
                icon={<BarChart3 className="h-4 w-4" />}
                title="Default risk %"
                subtitle="Pre-selected on the calculator"
              />
              <div className="mt-4 grid grid-cols-4 gap-2">
                {["0.5", "1", "2", "3"].map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => handleRiskChange(risk)}
                    className={cn(
                      "h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]",
                      defaultRisk === risk
                        ? "bg-brand text-brand-foreground"
                        : "bg-background text-foreground hover:bg-secondary",
                    )}
                  >
                    {risk}%
                  </button>
                ))}
              </div>
            </div>
          </SettingsGroup>
        </section>

        {/* Advanced & legal */}
        <section>
          <SettingsSection title="More" />
          <SettingsGroup>
            <SettingsRow
              icon={<Trash2 className="h-4 w-4 text-destructive" />}
              iconClassName="bg-destructive/10"
              title="Clear saved calculations"
              subtitle="Deletes calculator history only — not journal trades"
              onClick={() => setShowClearHistoryConfirm(true)}
            />
            <SettingsRow
              icon={<RotateCcw className="h-4 w-4" />}
              title="View welcome screens"
              subtitle="Show onboarding again"
              onClick={resetOnboarding}
              className="border-t border-border/40"
            />
            <SettingsRow
              icon={<Mail className="h-4 w-4 text-blue-500" />}
              iconClassName="bg-blue-500/10"
              title="Support"
              subtitle="info@poscalfx.com"
              href="mailto:info@poscalfx.com"
              showChevron
              className="border-t border-border/40"
            />
            <SettingsRow
              icon={<FileText className="h-4 w-4" />}
              title="Terms of service"
              onClick={() => window.open("/terms", "_blank")}
              showChevron
              className="border-t border-border/40"
            />
            <SettingsRow
              icon={<Shield className="h-4 w-4" />}
              title="Privacy policy"
              onClick={() => window.open("/privacy", "_blank")}
              showChevron
              className="border-t border-border/40"
            />
          </SettingsGroup>
        </section>

        {user && (
          <section className="pb-4">
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 font-semibold text-destructive transition-all active:scale-[0.98] hover:bg-destructive/15"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </section>
        )}

        <footer className="space-y-1 pb-8 pt-2 text-center">
          <p className="text-xs text-muted-foreground">Poscal · Position Size Calculator</p>
          <p className="text-[11px] text-muted-foreground/60">Officially sponsored by MandeFX</p>
        </footer>
      </main>

      <ConfirmDialog
        isOpen={showClearHistoryConfirm}
        onClose={() => setShowClearHistoryConfirm(false)}
        onConfirm={() => {
          void clearHistory();
        }}
        title="Clear saved calculations?"
        description="This removes calculator history only. Your journal trades, progress notes, and account data stay intact."
        confirmText="Clear calculations"
        cancelText="Cancel"
        variant="destructive"
      />

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={() => {
          void handleLogout();
        }}
        title="Sign out?"
        description="You will need your email and password to sign back in."
        confirmText="Sign out"
        cancelText="Stay signed in"
        variant="destructive"
      />
    </div>
  );
};

function SettingsSection({ title }: { title: string }) {
  return (
    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </h2>
  );
}

function SettingsGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/50 bg-secondary/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SettingsRowContent({
  icon,
  title,
  subtitle,
  iconClassName,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  iconClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/10",
          iconClassName,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <p className="font-medium text-foreground">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  iconClassName,
  trailing,
  showChevron = false,
  onClick,
  href,
  className,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  iconClassName?: string;
  trailing?: ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <SettingsRowContent
        icon={icon}
        title={title}
        subtitle={subtitle}
        iconClassName={iconClassName}
      />
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {showChevron ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
      </div>
    </>
  );

  const rowClass = cn(
    "flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/30 active:scale-[0.99]",
    className,
  );

  if (href) {
    return (
      <a href={href} className={rowClass}>
        {inner}
      </a>
    );
  }

  if (!onClick) {
    return <div className={rowClass}>{inner}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={rowClass}>
      {inner}
    </button>
  );
}

function SettingsToggle({
  enabled,
  onToggle,
  ariaLabel,
}: {
  enabled: boolean;
  onToggle: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel ?? "Toggle"}
      onClick={onToggle}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        enabled ? "bg-brand" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-background shadow-sm transition-all",
          enabled ? "left-6" : "left-1",
        )}
      />
    </button>
  );
}

function AdminBadge() {
  return (
    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
      Admin
    </span>
  );
}

export default Settings;
