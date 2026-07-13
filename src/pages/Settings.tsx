import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CreditCard,
  LogOut,
  Mail,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Trash2,
  User as UserIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { clearCalculatorHistory } from "@/lib/calculatorHistory";
import { loadUserSettings, saveUserSettings } from "@/lib/convexUserSettings";
import { useHaptics } from "@/hooks/use-haptics";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { user, session, signOut } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { lightTap } = useHaptics();
  const [defaultRisk, setDefaultRisk] = useState("1");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [inAppToastsEnabled, setInAppToastsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  useEffect(() => {
    const syncSettings = async () => {
      const settings = await loadUserSettings(session?.access_token);

      if (
        typeof settings.defaultRiskPercent === "number" &&
        settings.defaultRiskPercent > 0
      ) {
        setDefaultRisk(String(settings.defaultRiskPercent));
      }

      const nextTheme =
        settings.theme ??
        (document.documentElement.classList.contains("dark")
          ? "dark"
          : "light");
      setTheme(nextTheme);
      document.documentElement.classList.toggle("dark", nextTheme === "dark");

      if (typeof settings.hapticsEnabled === "boolean") {
        setHapticsEnabled(settings.hapticsEnabled);
      }

      const nextCurrency = ACCOUNT_CURRENCIES.find(
        (option) => option.code === settings.accountCurrency,
      );
      if (nextCurrency) {
        setCurrency(nextCurrency);
      }
    };

    void syncSettings();
  }, [session?.access_token, setCurrency]);

  const persistSettings = async (overrides?: {
    defaultRiskPercent?: number;
    accountCurrency?: string;
    theme?: "light" | "dark";
  }) => {
    await saveUserSettings(
      {
        defaultRiskPercent:
          overrides?.defaultRiskPercent ?? Number(defaultRisk),
        accountCurrency: overrides?.accountCurrency ?? currency.code,
        theme: overrides?.theme ?? theme,
        hapticsEnabled,
      },
      session?.access_token,
    );
  };

  const handleRiskChange = async (value: string) => {
    setDefaultRisk(value);
    await persistSettings({ defaultRiskPercent: Number(value) });
    lightTap();
  };

  const handleThemeChange = async (value: "light" | "dark") => {
    setTheme(value);
    document.documentElement.classList.toggle("dark", value === "dark");
    await persistSettings({ theme: value });
    lightTap();
  };

  const handleHapticsChange = async () => {
    const nextValue = !hapticsEnabled;
    setHapticsEnabled(nextValue);
    await saveUserSettings(
      {
        defaultRiskPercent: Number(defaultRisk),
        accountCurrency: currency.code,
        hapticsEnabled: nextValue,
      },
      session?.access_token,
    );
    lightTap();
  };

  const handleClearHistory = async () => {
    await clearCalculatorHistory(user?.id);
    lightTap();
    toast.success("History cleared");
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/signin");
  };

  const settingsRow = (
    icon: React.ReactNode,
    title: string,
    description: string,
    action?: React.ReactNode,
  ) => (
    <div className="flex items-center gap-4 px-5 py-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white/90">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[1.05rem] font-medium text-white">{title}</p>
        <p className="mt-1 text-sm text-white/45">{description}</p>
      </div>
      {action}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col pb-32">
      <main className="mx-auto w-full max-w-[32rem] px-4 pb-8 pt-10">
        <header className="mb-10 flex items-start gap-6">
          <button
            onClick={() => navigate(-1)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.08] text-white transition active:scale-95"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-[2.25rem] font-semibold tracking-[-0.04em] text-white">
              Settings
            </h1>
            <p className="text-lg text-white/55">
              Manage your preferences and account
            </p>
          </div>
        </header>

        <section>
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Account
          </h2>
          <div className="overflow-hidden rounded-[2.25rem] border border-white/5 bg-white/[0.07]">
            <button
              onClick={() => navigate(user ? "/profile" : "/signin")}
              className="flex w-full items-center gap-4 px-5 py-5 text-left"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.07] text-white">
                <UserIcon className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1.15rem] font-semibold text-white">
                  {user?.email ?? "Sign in to sync data"}
                </p>
                <p className="mt-1 text-sm text-white/45">
                  Manage profile & preferences
                </p>
              </div>
              <ArrowLeft className="h-5 w-5 rotate-180 text-white/45" />
            </button>
            <div className="h-px bg-white/5" />
            {settingsRow(
              <CreditCard className="h-6 w-6" />,
              "Upgrade to Premium",
              "Open payment wall and choose a plan",
              <ArrowLeft className="h-5 w-5 rotate-180 text-white/45" />,
            )}
            <div className="h-px bg-white/5" />
            {settingsRow(
              <ArrowLeft className="h-6 w-6 -rotate-45" />,
              "Restore Purchase",
              "Recover your existing subscription",
              <span className="text-white/55">Run</span>,
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Appearance & Preferences
          </h2>
          <div className="overflow-hidden rounded-[2.25rem] border border-white/5 bg-white/[0.07]">
            {settingsRow(
              <Palette className="h-6 w-6" />,
              "Appearance",
              "Choose the app theme",
              <div className="flex rounded-full bg-black/20 p-1">
                {(["light", "dark"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => void handleThemeChange(option)}
                    className={`h-10 rounded-full px-4 text-sm capitalize transition ${
                      theme === option ? "bg-white text-black" : "text-white/55"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>,
            )}
            <div className="h-px bg-white/5" />
            {settingsRow(
              <Moon className="h-6 w-6" />,
              "Account Currency",
              `${currency.symbol} ${currency.code}`,
              <select
                value={currency.code}
                onChange={(event) => {
                  const code = event.target.value;
                  const nextCurrency = ACCOUNT_CURRENCIES.find(
                    (option) => option.code === code,
                  );
                  if (!nextCurrency) {
                    return;
                  }
                  setCurrency(nextCurrency);
                  void persistSettings({ accountCurrency: code });
                  lightTap();
                }}
                className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                {ACCOUNT_CURRENCIES.slice(0, 6).map((option) => (
                  <option
                    key={option.code}
                    value={option.code}
                    className="bg-black text-white"
                  >
                    {option.code}
                  </option>
                ))}
              </select>,
            )}
            <div className="h-px bg-white/5" />
            {settingsRow(
              <Smartphone className="h-6 w-6" />,
              "Haptic Feedback",
              hapticsEnabled ? "Audio feedback active" : "Haptics disabled",
              <button
                onClick={() => void handleHapticsChange()}
                className={`flex h-10 w-20 items-center rounded-full p-1 transition ${hapticsEnabled ? "bg-white" : "bg-white/10"}`}
              >
                <span
                  className={`h-8 w-8 rounded-full transition ${hapticsEnabled ? "translate-x-10 bg-black" : "translate-x-0 bg-white"}`}
                />
              </button>,
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Notifications
          </h2>
          <div className="space-y-3">
            <div className="rounded-[2.25rem] border border-white/5 bg-white/[0.07] p-5">
              <div className="flex items-center gap-3">
                <Bell className="h-6 w-6 text-white" />
                <p className="text-[1.3rem] font-semibold text-white">
                  Push Notifications
                </p>
              </div>
              <p className="mt-4 max-w-md text-[1rem] leading-7 text-white/45">
                Get alerts for new trading signals and app updates, even when
                the app is closed.
              </p>
              <p className="mt-5 text-[1.05rem] text-emerald-400">
                ✓ Push notifications are {pushEnabled ? "enabled" : "disabled"}
              </p>
              <div className="mt-6 flex gap-3">
                <button className="h-12 min-w-[11rem] rounded-2xl bg-black px-6 text-lg font-medium text-white">
                  Test
                </button>
                <button
                  onClick={() => setPushEnabled((current) => !current)}
                  className="h-12 min-w-[9rem] rounded-2xl px-6 text-lg font-medium text-white/65"
                >
                  {pushEnabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>

            <div className="rounded-[2.25rem] border border-white/5 bg-white/[0.07]">
              {settingsRow(
                <Bell className="h-6 w-6" />,
                "In-App Toasts",
                inAppToastsEnabled
                  ? "Enabled for calculator and signals"
                  : "Muted inside the app",
                <button
                  onClick={() => setInAppToastsEnabled((current) => !current)}
                  className={`flex h-10 w-20 items-center rounded-full p-1 transition ${inAppToastsEnabled ? "bg-white" : "bg-white/10"}`}
                >
                  <span
                    className={`h-8 w-8 rounded-full transition ${inAppToastsEnabled ? "translate-x-10 bg-black" : "translate-x-0 bg-white"}`}
                  />
                </button>,
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Calculator
          </h2>
          <div className="rounded-[2.25rem] border border-white/5 bg-white/[0.07] p-5">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white">
                <Moon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[1.15rem] font-semibold text-white">
                  Default Risk Percentage
                </p>
                <p className="text-sm text-white/45">
                  Applied whenever the calculator opens
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {["0.5", "1", "2", "3"].map((risk) => (
                <button
                  key={risk}
                  onClick={() => void handleRiskChange(risk)}
                  className={`h-14 rounded-[1.3rem] text-xl font-semibold transition-all ${
                    defaultRisk === risk
                      ? "bg-white text-black"
                      : "bg-black/40 text-white"
                  }`}
                >
                  {risk}%
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Advanced
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => void handleClearHistory()}
              className="w-full rounded-[2.25rem] border border-white/5 bg-white/[0.07] px-5 py-5 text-left transition-all active:scale-[0.98]"
            >
              <Trash2 className="h-6 w-6 text-red-500" />
              <div>
                <p className="text-[1.15rem] font-semibold text-white">
                  Clear Calculator History
                </p>
                <p className="text-sm text-white/45">
                  Remove all saved calculations
                </p>
              </div>
            </button>
            <div className="w-full rounded-[2.25rem] border border-white/5 bg-white/[0.07] px-5 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white">
                  <ArrowLeft className="h-6 w-6 -rotate-45" />
                </div>
                <div>
                  <p className="text-[1.15rem] font-semibold text-white">
                    View Welcome Screens
                  </p>
                  <p className="text-sm text-white/45">
                    Show onboarding guide again
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Help & Legal
          </h2>
          <div className="space-y-3">
            <a
              href="mailto:support@poscal.app"
              className="block w-full rounded-[2.25rem] border border-white/5 bg-white/[0.07] px-5 py-5"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
                  <Mail className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[1.15rem] font-semibold text-white">
                    Support Email
                  </p>
                  <p className="text-sm text-white/45">
                    Get help from our team
                  </p>
                </div>
                <ArrowLeft className="h-5 w-5 rotate-180 text-white/45" />
              </div>
            </a>
            <button
              onClick={() => navigate("/terms")}
              className="flex w-full items-center gap-4 rounded-[2.25rem] border border-white/5 bg-white/[0.07] px-5 py-5 text-left"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white">
                <Shield className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[1.15rem] font-semibold text-white">
                  Terms and Conditions
                </p>
                <p className="text-sm text-white/45">
                  View our terms of service
                </p>
              </div>
              <ArrowLeft className="h-5 w-5 rotate-180 text-white/45" />
            </button>
            <button
              onClick={() => navigate("/privacy")}
              className="flex w-full items-center gap-4 rounded-[2.25rem] border border-white/5 bg-white/[0.07] px-5 py-5 text-left"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white">
                <Shield className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[1.15rem] font-semibold text-white">
                  Privacy Policy
                </p>
                <p className="text-sm text-white/45">
                  How we protect your data
                </p>
              </div>
              <ArrowLeft className="h-5 w-5 rotate-180 text-white/45" />
            </button>
          </div>
        </section>

        {user && (
          <button
            onClick={() => void handleLogout()}
            className="mt-8 flex w-full items-center gap-4 rounded-[2.25rem] border border-red-500/20 bg-red-500/8 px-5 py-6 text-left"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/12 text-red-500">
              <LogOut className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[1.5rem] font-semibold text-red-500">
                Sign Out
              </p>
            </div>
          </button>
        )}
      </main>
    </div>
  );
};

export default Settings;
