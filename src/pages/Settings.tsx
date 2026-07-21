import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronRight,
  Coins,
  Download,
  FileText,
  LogOut,
  Lock,
  Mail,
  Megaphone,
  Palette,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, ACCOUNT_CURRENCIES } from "@/contexts/CurrencyContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHaptics } from "@/hooks/use-haptics";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { NotificationSettings } from "@/components/NotificationSettings";
import { toast } from "sonner";
import { featureFlagApi, subscriptionApi } from "@/lib/api";
import { clearJournalEntries } from "@/lib/calculatorHistory";
import { cn } from "@/lib/utils";

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
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
  const { isPaid, isTrial, subscriptionTier, expiresAt, refreshSubscription } = useSubscription();
  const { isAdmin } = useAdmin();
  const [paidLockEnabled, setPaidLockEnabled] = useState<boolean | null>(null);
  const [defaultRisk, setDefaultRisk] = useState("1");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const { lightTap, isSupported } = useHaptics();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const { currency, setCurrency } = useCurrency();
  const [isRestoringPurchase, setIsRestoringPurchase] = useState(false);
  const supportsHaptics = typeof isSupported === "function" ? isSupported() : !!isSupported;

  const subscriptionLabel = getSubscriptionLabel({ isPaid, isTrial, subscriptionTier });
  const isPremium = isPaid || isTrial;

  useEffect(() => {
    const savedRisk = localStorage.getItem("defaultRisk");
    if (savedRisk) setDefaultRisk(savedRisk);

    const savedHaptics = localStorage.getItem("hapticsEnabled");
    setHapticsEnabled(savedHaptics !== "false");
  }, []);

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
  };

  const clearHistory = async () => {
    await clearJournalEntries(user?.id);
    lightTap();
    toast.success("Journal cleared");
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
      toast.error(getErrorMessage(error, "Restore failed. Please contact support."));
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

      <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 animate-slide-up space-y-6 overflow-y-auto overscroll-contain px-6 py-2 pb-28 md:max-w-3xl">
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
                subtitle="Sync journal, signals, and subscription"
                onClick={() => navigate("/signin")}
                showChevron
              />
            </SettingsGroup>
          )}
        </section>

        {/* Subscription */}
        {user && !isPremium && (
          <section>
            <SettingsSection title="Subscription" />
            <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/10 via-secondary/40 to-secondary/20">
              <div className="px-5 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand" />
                  <h3 className="font-semibold text-foreground">Unlock Premium</h3>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  Get full signals access, advanced journal analytics, and more.
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
        )}

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

            <SettingsRow
              icon={<Smartphone className="h-4 w-4" />}
              title="Haptic feedback"
              subtitle={supportsHaptics ? "Vibration on interactions" : "Audio feedback active"}
              trailing={<SettingsToggle enabled={hapticsEnabled} onToggle={toggleHaptics} />}
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
              title="Clear journal"
              subtitle="Remove all saved entries"
              onClick={clearHistory}
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
          <section>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 font-semibold text-destructive transition-all active:scale-[0.98] hover:bg-destructive/15"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </section>
        )}

        <footer className="space-y-1 pb-2 pt-2 text-center">
          <p className="text-xs text-muted-foreground">Poscal · Position Size Calculator</p>
          <p className="text-[11px] text-muted-foreground/60">Officially sponsored by MandeFX</p>
        </footer>
      </main>
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
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
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
